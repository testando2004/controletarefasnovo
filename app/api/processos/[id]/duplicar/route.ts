import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// POST /api/processos/:id/duplicar - Duplicar um processo existente
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const processoId = parseInt(params.id);

    // Buscar processo original com todos os dados
    const processoOriginal = await prisma.processo.findUnique({
      where: { id: processoId },
      include: {
        empresa: true,
        tags: { include: { tag: true } },
        questionarios: true,
        respostasQuestionario: true,
      },
    });

    if (!processoOriginal) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 });
    }

    // Ler opções do body (se houver)
    let opcoes = {
      copiarQuestionarios: true,
      copiarRespostas: false, // Por padrão não copia respostas
      copiarTags: true,
      novoNomeEmpresa: null as string | null,
      novoDepartamento: null as number | null,
      reiniciarFluxo: false, // Por padrão mantém a etapa atual (evita "sumir" respostas em etapas posteriores)
    };

    try {
      const body = await request.json();
      opcoes = { ...opcoes, ...body };
    } catch {
      // Body vazio é ok
    }

    // Se o usuário pediu para copiar respostas, precisamos garantir que as perguntas existam
    // no novo processo; então forçamos copiarQuestionarios.
    if (opcoes.copiarRespostas) opcoes.copiarQuestionarios = true;

    const novoProcesso = await prisma.$transaction(async (tx) => {
      const fluxoIds: number[] = Array.isArray(processoOriginal.fluxoDepartamentos)
        ? processoOriginal.fluxoDepartamentos.map((x: any) => Number(x)).filter((x: any) => Number.isFinite(x))
        : [];
      const primeiroDept = fluxoIds.length > 0 ? fluxoIds[0] : undefined;

      const manterDeptId = opcoes.novoDepartamento || processoOriginal.departamentoAtual;
      const deptIdNovo = opcoes.reiniciarFluxo ? (primeiroDept ?? manterDeptId) : manterDeptId;
      const idxNovo = opcoes.reiniciarFluxo
        ? 0
        : (Number.isFinite(Number(processoOriginal.departamentoAtualIndex)) ? Number(processoOriginal.departamentoAtualIndex) : 0);

      const novo = await tx.processo.create({
        data: {
          nome: processoOriginal.nome ? `${processoOriginal.nome} (Cópia)` : null,
          nomeServico: processoOriginal.nomeServico,
          nomeEmpresa: opcoes.novoNomeEmpresa || `${processoOriginal.nomeEmpresa} (Cópia)`,
          cliente: processoOriginal.cliente,
          email: processoOriginal.email,
          telefone: processoOriginal.telefone,
          empresaId: processoOriginal.empresaId,
          status: 'EM_ANDAMENTO',
          prioridade: processoOriginal.prioridade,
          departamentoAtual: deptIdNovo,
          departamentoAtualIndex: idxNovo,
          fluxoDepartamentos: processoOriginal.fluxoDepartamentos,
          descricao: processoOriginal.descricao,
          notasCriador: processoOriginal.notasCriador,
          criadoPorId: user.id,
          responsavelId: null,
          dataInicio: new Date(),
          dataEntrega: opcoes.reiniciarFluxo
            ? addDays(new Date(), 15)
            : (processoOriginal.dataEntrega ?? addDays(new Date(), 15)),
          progresso: opcoes.reiniciarFluxo
            ? 0
            : (Number.isFinite(Number(processoOriginal.progresso)) ? Number(processoOriginal.progresso) : 0),
        },
      });

      // Copiar tags
      if (opcoes.copiarTags && Array.isArray(processoOriginal.tags) && processoOriginal.tags.length > 0) {
        for (const tagRel of processoOriginal.tags) {
          await (tx as any).processoTag.create({
            data: {
              processoId: novo.id,
              tagId: tagRel.tagId,
            },
          }).catch(() => {});
        }
      }

      // Copiar questionários necessários e remapear respostas
      const questionarioIdMap = new Map<number, number>();

      if (opcoes.copiarQuestionarios) {
        const questionariosOriginais = Array.isArray(processoOriginal.questionarios)
          ? processoOriginal.questionarios
          : [];

        const idsReferenciadosPorRespostas = new Set<number>(
          Array.isArray(processoOriginal.respostasQuestionario)
            ? processoOriginal.respostasQuestionario.map((r) => Number(r.questionarioId)).filter((id) => Number.isFinite(id))
            : []
        );

        const idsJaCarregados = new Set<number>(questionariosOriginais.map((q) => Number(q.id)).filter((id) => Number.isFinite(id)));
        const idsFaltantes = [...idsReferenciadosPorRespostas].filter((id) => !idsJaCarregados.has(id));

        const questionariosFaltantes = idsFaltantes.length
          ? await (tx as any).questionarioDepartamento.findMany({
              where: { id: { in: idsFaltantes } },
            })
          : [];

        const todosQuestionarios = [...questionariosOriginais, ...(questionariosFaltantes || [])];

        // 1) criar cópias (sem condicaoPerguntaId por enquanto)
        for (const q of todosQuestionarios) {
          const oldId = Number(q.id);
          if (!Number.isFinite(oldId)) continue;

          const created = await (tx as any).questionarioDepartamento.create({
            data: {
              processoId: novo.id,
              departamentoId: q.departamentoId,
              label: q.label,
              tipo: q.tipo,
              obrigatorio: q.obrigatorio,
              ordem: q.ordem,
              opcoes: q.opcoes || [],
              placeholder: q.placeholder,
              descricao: q.descricao,
              condicaoPerguntaId: null,
              condicaoOperador: q.condicaoOperador,
              condicaoValor: q.condicaoValor,
            },
          });
          questionarioIdMap.set(oldId, created.id);
        }

        // 2) atualizar condicaoPerguntaId com ids novos
        for (const q of todosQuestionarios) {
          const oldId = Number(q.id);
          const oldCond = q.condicaoPerguntaId ? Number(q.condicaoPerguntaId) : NaN;
          if (!Number.isFinite(oldId) || !Number.isFinite(oldCond)) continue;

          const newId = questionarioIdMap.get(oldId);
          const newCond = questionarioIdMap.get(oldCond);
          if (!newId || !newCond) continue;

          await (tx as any).questionarioDepartamento.update({
            where: { id: newId },
            data: { condicaoPerguntaId: newCond },
          }).catch(() => {});
        }

        // 3) copiar respostas (se solicitado)
        if (opcoes.copiarRespostas && Array.isArray(processoOriginal.respostasQuestionario) && processoOriginal.respostasQuestionario.length > 0) {
          for (const r of processoOriginal.respostasQuestionario) {
            const oldQid = Number(r.questionarioId);
            if (!Number.isFinite(oldQid)) continue;

            const newQid = questionarioIdMap.get(oldQid);
            if (!newQid) continue; // sem pergunta no novo processo => ignora (evita respostas “invisíveis”)

            await tx.respostaQuestionario.create({
              data: {
                processoId: novo.id,
                questionarioId: newQid,
                resposta: r.resposta,
                respondidoPorId: user.id,
              },
            }).catch((err) => {
              console.log('Erro ao copiar resposta:', err);
            });
          }
        }
      }

      // Criar histórico inicial
      await tx.historicoEvento.create({
        data: {
          processoId: novo.id,
          tipo: 'INICIO',
          acao: `Processo duplicado a partir de #${processoOriginal.id} (${processoOriginal.nomeEmpresa})`,
          responsavelId: user.id,
          departamento: 'Sistema',
          dataTimestamp: BigInt(Date.now()),
        },
      });

      // Criar histórico de fluxo inicial
      await tx.historicoFluxo.create({
        data: {
          processoId: novo.id,
          departamentoId: novo.departamentoAtual,
          ordem: idxNovo,
          status: 'em_andamento',
          entradaEm: new Date(),
        },
      });

      return novo;
    });

    // Buscar processo completo para retornar (inclui respostas para o UI montar `respostasHistorico`)
    const processoCompleto = await prisma.processo.findUnique({
      where: { id: novoProcesso.id },
      include: {
        empresa: true,
        tags: { include: { tag: true } },
        questionarios: {
          include: {
            respostas: {
              include: { respondidoPor: { select: { id: true, nome: true } } },
            },
          },
          orderBy: { ordem: 'asc' },
        },
      },
    });

    return NextResponse.json({
      message: 'Processo duplicado com sucesso',
      processo: processoCompleto,
      processoOriginalId: processoOriginal.id,
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao duplicar processo:', error);
    return NextResponse.json(
      { error: 'Erro ao duplicar processo' },
      { status: 500 }
    );
  }
}
