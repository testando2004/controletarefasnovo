import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { assertProcessAccess } from '@/app/utils/processAccess';
import { validarDepartamentoProcesso } from '@/app/utils/processValidation';
import { getIp, registrarLog } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/processos/[id]/checklist
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const processoId = parseInt(params.id);
    const access = await assertProcessAccess(user, processoId, 'read');
    if (access.error) return access.error;

    try {
      const checklist = await (prisma as any).checklistDepartamento.findMany({
        where: { processoId },
        orderBy: { id: 'asc' },
      });
      return NextResponse.json(checklist);
    } catch {
      // Leitura pode degradar se a tabela ainda nao existir.
      return NextResponse.json([]);
    }
  } catch (error) {
    console.error('Erro ao buscar checklist:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/processos/[id]/checklist
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const processoId = parseInt(params.id);
    const data = await request.json();
    const { departamentoId, concluido } = data;

    if (!departamentoId) {
      return NextResponse.json({ error: 'departamentoId obrigatorio' }, { status: 400 });
    }

    const access = await assertProcessAccess(user, processoId, 'checklist', {
      departamentoId: Number(departamentoId),
    });
    if (access.error) return access.error;

    try {
      const processo = await (prisma as any).processo.findUnique({
        where: { id: processoId },
        select: { fluxoDepartamentos: true, deptIndependente: true },
      });

      if (!processo) {
        return NextResponse.json({ error: 'Processo nao encontrado' }, { status: 404 });
      }

      const fluxo: number[] = Array.isArray(processo.fluxoDepartamentos)
        ? processo.fluxoDepartamentos.map(Number)
        : [];

      // Carrega dependenciasDept via raw (Prisma client antigo pode não conhecer a coluna)
      let dependenciasDept: Record<string, string[]> = {};
      try {
        const depRows = await prisma.$queryRawUnsafe<Array<{ dependenciasDept: any }>>(
          `SELECT "dependenciasDept" FROM "Processo" WHERE id = ${Number(processoId)}`
        );
        const dd = depRows?.[0]?.dependenciasDept;
        if (dd && typeof dd === 'object' && !Array.isArray(dd)) dependenciasDept = dd as any;
      } catch {
        dependenciasDept = {};
      }

      const temDependenciasCustomizadas = Object.keys(dependenciasDept).length > 0;

      if (concluido && fluxo.length > 1) {
        const idx = fluxo.indexOf(Number(departamentoId));
        if (idx >= 0) {
          // Calcula a chave da etapa atual (deptId ou deptId:ocorrencia)
          const deptId = fluxo[idx];
          let ocorrencia = 0;
          for (let i = 0; i <= idx; i++) if (fluxo[i] === deptId) ocorrencia++;
          const chaveAtual = ocorrencia === 1 ? String(deptId) : `${deptId}:${ocorrencia}`;

          if (temDependenciasCustomizadas) {
            // ═══ Dependências customizadas (Fase 3) ═══
            const deps = Array.isArray(dependenciasDept[chaveAtual])
              ? dependenciasDept[chaveAtual]
              : Array.isArray(dependenciasDept[String(deptId)])
                ? dependenciasDept[String(deptId)]
                : null;

            if (Array.isArray(deps) && deps.length > 0) {
              // Para cada dep, confere se a etapa correspondente tem checklist concluído
              for (const depChave of deps) {
                const partes = String(depChave).split(':');
                const depDeptId = Number(partes[0]);
                if (!Number.isFinite(depDeptId)) continue;
                const check = await (prisma as any).checklistDepartamento.findFirst({
                  where: { processoId, departamentoId: depDeptId },
                });
                if (!check || !check.concluido) {
                  const depNome = await prisma.departamento.findUnique({
                    where: { id: depDeptId },
                    select: { nome: true },
                  });
                  return NextResponse.json(
                    { error: `"${depNome?.nome || `Dept #${depDeptId}`}" precisa dar check primeiro.` },
                    { status: 400 }
                  );
                }
              }
            }
            // Se não há deps listadas para esta etapa → livre para dar check
          } else if (idx > 0) {
            // ═══ Lógica antiga (sequencial puro): anterior tem que estar concluído ═══
            const anterior = await (prisma as any).checklistDepartamento.findFirst({
              where: { processoId, departamentoId: fluxo[idx - 1] },
            });

            if (!anterior || !anterior.concluido) {
              const deptAnterior = await prisma.departamento.findUnique({
                where: { id: fluxo[idx - 1] },
                select: { nome: true },
              });

              return NextResponse.json(
                { error: `"${deptAnterior?.nome || `Dept #${fluxo[idx - 1]}`}" precisa dar check primeiro.` },
                { status: 400 }
              );
            }
          }
        }
      }

      if (concluido) {
        const resultadoValidacao = await validarDepartamentoProcesso(processoId, Number(departamentoId));

        if (!resultadoValidacao.encontrado) {
          return NextResponse.json(
            { error: resultadoValidacao.validacao.erros[0]?.mensagem || 'Departamento nao encontrado' },
            { status: resultadoValidacao.status }
          );
        }

        if (!resultadoValidacao.valido) {
          const errosCriticos = resultadoValidacao.validacao.erros.filter((erro) => erro.tipo === 'erro');
          return NextResponse.json(
            {
              error: 'Requisitos obrigatorios nao preenchidos',
              detalhes: errosCriticos.map((erro) => erro.mensagem),
              validacao: resultadoValidacao.validacao.erros,
            },
            { status: 400 }
          );
        }
      }

      const existing = await (prisma as any).checklistDepartamento.findFirst({
        where: { processoId, departamentoId: Number(departamentoId) },
      });

      if (existing) {
        const updated = await (prisma as any).checklistDepartamento.update({
          where: { id: existing.id },
          data: {
            concluido: Boolean(concluido),
            concluidoPorId: concluido ? user.id : null,
            concluidoEm: concluido ? new Date() : null,
          },
        });

        if (concluido) {
          try {
            const dept = await prisma.departamento.findUnique({
              where: { id: Number(departamentoId) },
              select: { nome: true },
            });
            await prisma.historicoEvento.create({
              data: {
                processoId,
                tipo: 'CONCLUSAO',
                acao: `Departamento "${dept?.nome || `#${departamentoId}`}" concluiu sua parte (check paralelo)`,
                responsavelId: user.id,
                departamento: dept?.nome || `Dept #${departamentoId}`,
                dataTimestamp: BigInt(Date.now()),
              },
            });
            await registrarLog({
              usuarioId: user.id,
              acao: 'CHECK',
              entidade: 'PROCESSO',
              entidadeId: processoId,
              entidadeNome: `Processo #${processoId}`,
              campo: 'checklistDepartamento',
              valorAnterior: null,
              valorNovo: dept?.nome || `Dept #${departamentoId}`,
              detalhes: `Departamento "${dept?.nome || `#${departamentoId}`}" concluiu sua etapa.`,
              processoId,
              departamentoId: Number(departamentoId),
              ip: getIp(request),
            });
          } catch {
            // Nao bloquear por falha de historico.
          }
        }

        return NextResponse.json(updated);
      }

      const created = await (prisma as any).checklistDepartamento.create({
        data: {
          processoId,
          departamentoId: Number(departamentoId),
          concluido: Boolean(concluido),
          concluidoPorId: concluido ? user.id : null,
          concluidoEm: concluido ? new Date() : null,
        },
      });

      if (concluido) {
        try {
          const dept = await prisma.departamento.findUnique({
            where: { id: Number(departamentoId) },
            select: { nome: true },
          });
          await prisma.historicoEvento.create({
            data: {
              processoId,
              tipo: 'CONCLUSAO',
              acao: `Departamento "${dept?.nome || `#${departamentoId}`}" concluiu sua parte (check paralelo)`,
              responsavelId: user.id,
              departamento: dept?.nome || `Dept #${departamentoId}`,
              dataTimestamp: BigInt(Date.now()),
            },
          });
          await registrarLog({
            usuarioId: user.id,
            acao: 'CHECK',
            entidade: 'PROCESSO',
            entidadeId: processoId,
            entidadeNome: `Processo #${processoId}`,
            campo: 'checklistDepartamento',
            valorAnterior: null,
            valorNovo: dept?.nome || `Dept #${departamentoId}`,
            detalhes: `Departamento "${dept?.nome || `#${departamentoId}`}" concluiu sua etapa.`,
            processoId,
            departamentoId: Number(departamentoId),
            ip: getIp(request),
          });
        } catch {
          // Nao bloquear por falha de historico.
        }
      }

      return NextResponse.json(created);
    } catch (err) {
      console.error('Erro ao salvar checklist departamento:', err);
      const code = (err as any)?.code;
      return NextResponse.json(
        { error: code === 'P2021' ? 'Checklist indisponivel no momento' : 'Nao foi possivel registrar o check deste departamento.' },
        { status: code === 'P2021' ? 503 : 500 }
      );
    }
  } catch (error) {
    console.error('Erro ao salvar checklist:', error);
    return NextResponse.json(
      { error: 'Nao foi possivel atualizar o checklist desta solicitacao.' },
      { status: 500 }
    );
  }
}
