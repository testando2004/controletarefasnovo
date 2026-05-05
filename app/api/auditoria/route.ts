import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { GHOST_USER_EMAIL, MASTER_USER_EMAIL } from '@/app/utils/constants';
import { coletarProcessosInterligados } from '@/app/utils/processChain';
import { ensureLogAuditoriaSoftDeleteSchema } from '@/app/utils/logAuditoriaSchema';

function construirAcaoLog(log: any) {
  if (log.campo) {
    if (log.acao === 'ANEXAR') {
      return `Documento anexado: ${log.valorNovo || log.entidadeNome || ''}`.trim();
    }
    if (log.acao === 'PREENCHER') {
      return `Resposta preenchida: ${log.campo}`;
    }
    if (log.acao === 'INTERLIGAR') {
      return `Interligacao registrada: ${log.campo}`;
    }
    return `Campo "${log.campo}" alterado`;
  }

  if (log.detalhes) return String(log.detalhes);

  return `${log.acao} em ${log.entidade}${log.entidadeNome ? `: ${log.entidadeNome}` : ''}`;
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    await ensureLogAuditoriaSoftDeleteSchema();

    const superUser =
      (user as any).isGhost === true ||
      (user as any).email === GHOST_USER_EMAIL ||
      (user as any).email === MASTER_USER_EMAIL;

    const { searchParams } = new URL(request.url);
    const processoId = Number(searchParams.get('processoId'));

    if (!Number.isFinite(processoId) || processoId <= 0) {
      return NextResponse.json({ error: 'processoId e obrigatorio' }, { status: 400 });
    }

    const cadeia = await coletarProcessosInterligados(processoId);
    const processosIds = cadeia.ids.length > 0 ? cadeia.ids : [processoId];

    const historico = await prisma.historicoEvento.findMany({
      where: {
        processoId: { in: processosIds },
        responsavel: { email: { not: GHOST_USER_EMAIL }, isGhost: { not: true } },
      },
      include: {
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
      orderBy: { data: 'desc' },
    });

    const logsAuditoria = await prisma.logAuditoria.findMany({
      where: {
        processoId: { in: processosIds },
        usuario: { email: { not: GHOST_USER_EMAIL }, isGhost: { not: true } },
        ...(superUser ? {} : { apagado: false }),
      },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true },
        },
      },
      orderBy: { criadoEm: 'desc' },
    });

    const historicoSerializado = historico.map((evento) => ({
      ...evento,
      dataTimestamp: evento.dataTimestamp ? evento.dataTimestamp.toString() : null,
      processoOrigemId: evento.processoId,
      processoOrigemNome: cadeia.nomes[evento.processoId] || `#${evento.processoId}`,
      isInterligado: evento.processoId !== processoId,
    }));

    const logsSerializados = logsAuditoria.map((log) => ({
      id: `log-${log.id}`,
      tipo: log.campo ? 'ALTERACAO_CAMPO' : 'ALTERACAO',
      acao: construirAcaoLog(log),
      responsavel: log.usuario,
      data: log.criadoEm,
      campo: log.campo,
      valorAnterior: log.valorAnterior,
      valorNovo: log.valorNovo,
      detalhes: log.detalhes,
      entidade: log.entidade,
      entidadeNome: log.entidadeNome,
      isFieldLevel: Boolean(log.campo),
      apagado: (log as any).apagado ?? false,
      apagadoEm: (log as any).apagadoEm ?? null,
      apagadoPorId: (log as any).apagadoPorId ?? null,
      apagadoPorNome: (log as any).apagadoPorNome ?? null,
      apagadoMotivo: (log as any).apagadoMotivo ?? null,
      processoOrigemId: log.processoId,
      processoOrigemNome: log.processoId ? cadeia.nomes[log.processoId] || `#${log.processoId}` : null,
      isInterligado: log.processoId !== processoId,
    }));

    const timeline = [...historicoSerializado, ...logsSerializados].sort((a: any, b: any) => {
      const dataA = new Date(a.data).getTime();
      const dataB = new Date(b.data).getTime();
      return dataB - dataA;
    });

    return NextResponse.json(timeline);
  } catch (error) {
    console.error('Erro ao buscar historico:', error);
    return NextResponse.json(
      { error: 'Nao foi possivel carregar o historico desta solicitacao.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const ghostCheck = await prisma.usuario.findUnique({
      where: { id: user.id as number },
      select: { isGhost: true, email: true },
    });
    if (ghostCheck?.isGhost || ghostCheck?.email === GHOST_USER_EMAIL) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const body = await request.json();
    const { processoId, tipo, acao, responsavelId, departamento, dataTimestamp } = body;

    if (!processoId || !tipo || !acao) {
      return NextResponse.json(
        { error: 'processoId, tipo e acao sao obrigatorios' },
        { status: 400 }
      );
    }

    const tiposValidos = ['INICIO', 'ALTERACAO', 'MOVIMENTACAO', 'CONCLUSAO', 'FINALIZACAO', 'DOCUMENTO', 'COMENTARIO'];
    if (!tiposValidos.includes(tipo)) {
      return NextResponse.json(
        { error: `Tipo de evento invalido. Use: ${tiposValidos.join(', ')}` },
        { status: 400 }
      );
    }

    const evento = await prisma.historicoEvento.create({
      data: {
        processoId: Number(processoId),
        tipo,
        acao,
        responsavelId: responsavelId || user.id,
        departamento,
        dataTimestamp: dataTimestamp || Date.now(),
      },
      include: {
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(evento, { status: 201 });
  } catch (error) {
    console.error('Erro ao registrar evento:', error);
    return NextResponse.json(
      { error: 'Nao foi possivel registrar este evento no historico.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'O historico da solicitacao e permanente e nao pode ser apagado.' },
    { status: 403 }
  );
}
