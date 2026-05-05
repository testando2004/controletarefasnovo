import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { getIp, registrarLog } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// POST /api/processos/:id/voltar
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const roleUpper = String((user as any).role || '').toUpperCase();
    if (roleUpper === 'USUARIO') {
      return NextResponse.json({ error: 'Sem permissão para mover processo' }, { status: 403 });
    }

    const processoId = parseInt(params.id);

    // Permite especificar um departamento destino específico (voltar para qualquer dept anterior do fluxo)
    let destinoDepartamentoIdBody: number | undefined;
    try {
      const body = await request.json().catch(() => null);
      if (body && typeof body === 'object') {
        const raw = (body as any).destinoDepartamentoId ?? (body as any).departamentoId;
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) destinoDepartamentoIdBody = parsed;
      }
    } catch {
      // body opcional
    }

    const processo = await prisma.processo.findUnique({
      where: { id: processoId },
      include: { historicoFluxos: { orderBy: { ordem: 'desc' } } },
    });

    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 });
    }

    const atualIndex = Number(processo.departamentoAtualIndex ?? 0);
    if (isNaN(atualIndex) || atualIndex <= 0) {
      return NextResponse.json({ error: 'Processo já está no primeiro departamento' }, { status: 400 });
    }

    // Se foi especificado um dept destino, buscar seu índice no fluxo
    let destinoIndex: number;
    if (destinoDepartamentoIdBody !== undefined) {
      const idx = processo.fluxoDepartamentos.indexOf(destinoDepartamentoIdBody);
      if (idx < 0) {
        return NextResponse.json({ error: 'Departamento destino não faz parte do fluxo desta solicitação' }, { status: 400 });
      }
      if (idx >= atualIndex) {
        return NextResponse.json({ error: 'Para voltar, o departamento destino precisa ser anterior ao atual' }, { status: 400 });
      }
      destinoIndex = idx;
    } else {
      destinoIndex = atualIndex - 1;
    }

    const destinoId = processo.fluxoDepartamentos[destinoIndex];

    if (!destinoId) {
      return NextResponse.json({ error: 'Departamento destino inválido' }, { status: 400 });
    }

    // Gerente só pode mover para um dos seus departamentos (destino)
    if (roleUpper === 'GERENTE') {
      const { getUserDepartmentIds } = await import('@/app/utils/processAccess');
      const deptosUsuario = getUserDepartmentIds(user);
      if (deptosUsuario.length === 0) {
        return NextResponse.json({ error: 'Usuário sem departamento definido' }, { status: 403 });
      }
      if (!deptosUsuario.includes(Number(destinoId))) {
        return NextResponse.json({ error: 'Sem permissão para mover processo para outro departamento' }, { status: 403 });
      }
    }

    const destinoDepartamento = await prisma.departamento.findUnique({ where: { id: destinoId } });
    const atualDepartamento = await prisma.departamento.findUnique({ where: { id: processo.departamentoAtual } });

    // Atualizar processo para departamento anterior
    const processoAtualizado = await prisma.processo.update({
      where: { id: processoId },
      data: {
        departamentoAtual: destinoId,
        departamentoAtualIndex: destinoIndex,
        progresso: Math.round(((destinoIndex + 1) / processo.fluxoDepartamentos.length) * 100),
        dataAtualizacao: new Date(),
      },
      include: {
        empresa: true,
        tags: { include: { tag: true } },
      },
    });

    // Encerrar histórico do fluxo atual
    const ultimoFluxo = processo.historicoFluxos && processo.historicoFluxos.length > 0 ? processo.historicoFluxos[0] : null;
    if (ultimoFluxo) {
      await prisma.historicoFluxo.update({ where: { id: ultimoFluxo.id }, data: { status: 'concluido', saidaEm: new Date() } });
    }

    // Criar novo histórico de fluxo para o destino (reativado)
    await prisma.historicoFluxo.create({
      data: {
        processoId,
        departamentoId: destinoId,
        ordem: destinoIndex,
        status: 'em_andamento',
        entradaEm: new Date(),
      },
    });

    // Evento histórico
    await prisma.historicoEvento.create({
      data: {
        processoId,
        tipo: 'MOVIMENTACAO',
        acao: `Processo movido de "${atualDepartamento?.nome || 'N/A'}" para "${destinoDepartamento?.nome || 'N/A'}" (retorno)`,
        responsavelId: user.id,
        departamento: destinoDepartamento?.nome ?? undefined,
        dataTimestamp: BigInt(Date.now()),
      },
    });

    await registrarLog({
      usuarioId: user.id,
      acao: 'VOLTAR',
      entidade: 'PROCESSO',
      entidadeId: processoId,
      entidadeNome: processo.nomeServico || processo.nomeEmpresa || `#${processoId}`,
      campo: 'departamentoAtual',
      valorAnterior: atualDepartamento?.nome || null,
      valorNovo: destinoDepartamento?.nome || null,
      detalhes: `Processo retornado de "${atualDepartamento?.nome || 'N/A'}" para "${destinoDepartamento?.nome || 'N/A'}".`,
      processoId,
      departamentoId: destinoId,
      ip: getIp(request),
    });

    // Auto-atribuir responsável ao responsável do departamento destino
    try {
      // 1. Buscar gerente do departamento destino
      let novoResponsavel = await prisma.usuario.findFirst({
        where: {
          ativo: true,
          role: 'GERENTE',
          departamentoId: destinoId,
        },
        select: { id: true, nome: true },
      });

      // 2. Se não há gerente, buscar pelo nome do responsável cadastrado no departamento
      if (!novoResponsavel && destinoDepartamento?.responsavel) {
        novoResponsavel = await prisma.usuario.findFirst({
          where: {
            ativo: true,
            nome: { equals: destinoDepartamento.responsavel, mode: 'insensitive' },
          },
          select: { id: true, nome: true },
        });
      }

      // 3. Fallback: qualquer usuário ativo vinculado ao departamento
      if (!novoResponsavel) {
        novoResponsavel = await prisma.usuario.findFirst({
          where: {
            ativo: true,
            departamentoId: destinoId,
          },
          orderBy: { role: 'asc' },
          select: { id: true, nome: true },
        });
      }

      if (novoResponsavel) {
        await prisma.processo.update({
          where: { id: processoId },
          data: { responsavelId: novoResponsavel.id },
        });
      }
    } catch {
      // Não bloquear retorno se falhar
    }

    return NextResponse.json(processoAtualizado);
  } catch (error) {
    console.error('Erro ao voltar processo:', error);
    return NextResponse.json(
      { error: 'Nao foi possivel retornar a solicitacao agora. Tente novamente.' },
      { status: 500 }
    );
  }
}
