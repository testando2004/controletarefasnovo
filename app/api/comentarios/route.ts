import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { assertProcessAccess } from '@/app/utils/processAccess';
import { coletarProcessosInterligados } from '@/app/utils/processChain';
import { getIp, registrarLog } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/comentarios?processoId=123
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const { searchParams } = new URL(request.url);
    const processoId = searchParams.get('processoId');
    
    if (!processoId) {
      return NextResponse.json(
        { error: 'processoId é obrigatório' },
        { status: 400 }
      );
    }

    const pid = parseInt(processoId);
    const access = await assertProcessAccess(user, pid, 'read');
    if (access.error) return access.error;

    let processosIds = [pid];
    let processosNomes: Record<number, string> = { [pid]: `#${pid}` };

    try {
      const cadeia = await coletarProcessosInterligados(pid);
      processosIds = cadeia.ids.length > 0 ? cadeia.ids : [pid];
      processosNomes = Object.keys(cadeia.nomes).length > 0 ? cadeia.nomes : { [pid]: `#${pid}` };
    } catch (e) {
      console.error('Erro ao buscar processos interligados para comentarios:', e);
    }
    
    const comentarios = await prisma.comentario.findMany({
      where: { processoId: { in: processosIds } },
      include: {
        autor: {
          select: { id: true, nome: true, email: true },
        },
        departamento: {
          select: { id: true, nome: true },
        },
      },
      orderBy: { criadoEm: 'desc' },
    });
    const comentariosFiltrados = access.visibleDepartmentIds
      ? comentarios.filter((comentario) => {
          const departamentoComentario = Number(comentario.departamentoId);
          if (!Number.isFinite(departamentoComentario)) return true;
          return access.visibleDepartmentIds!.includes(departamentoComentario);
        })
      : comentarios;

    // Adicionar info de processo de origem para o front
    const comentariosComOrigem = comentariosFiltrados.map((c) => ({
      ...c,
      processoOrigemId: c.processoId,
      processoOrigemNome: processosNomes[c.processoId] || `#${c.processoId}`,
      isInterligado: c.processoId !== pid,
    }));
    
    return NextResponse.json(comentariosComOrigem);
  } catch (error) {
    console.error('Erro ao buscar comentários:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar comentários' },
      { status: 500 }
    );
  }
}

// POST /api/comentarios
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    
    const data = await request.json();
    const access = await assertProcessAccess(user, Number(data?.processoId), 'comment', {
      departamentoId: Number(data?.departamentoId),
    });
    if (access.error) return access.error;
    const departamentoComentario = Number.isFinite(Number(data?.departamentoId))
      ? Number(data.departamentoId)
      : (access.userDeptId ?? access.processo.departamentoAtual);
    
    // Dados base do comentário
    const comentarioData: any = {
      processoId: data.processoId,
      texto: data.texto,
      autorId: user.id,
      departamentoId: departamentoComentario,
      mencoes: data.mencoes || [],
    };
    
    // Adicionar parentId apenas se existir e se o campo existir no schema
    if (data.parentId) {
      try {
        comentarioData.parentId = data.parentId;
      } catch (e) {
        console.warn('Campo parentId não disponível no schema. Execute: npx prisma migrate dev');
      }
    }
    
    const comentario = await prisma.comentario.create({
      data: comentarioData,
      include: {
        autor: {
          select: { id: true, nome: true, email: true },
        },
        departamento: {
          select: { id: true, nome: true },
        },
      },
    });
    
    // Criar evento no histórico
    await prisma.historicoEvento.create({
      data: {
        processoId: data.processoId,
        tipo: 'COMENTARIO',
        acao: 'Comentário adicionado',
        responsavelId: user.id,
        dataTimestamp: BigInt(Date.now()),
      },
    });

    await registrarLog({
      usuarioId: user.id,
      acao: 'COMENTAR',
      entidade: 'COMENTARIO',
      entidadeId: comentario.id,
      entidadeNome: `Comentario #${comentario.id}`,
      campo: 'texto',
      valorAnterior: null,
      valorNovo: comentario.texto,
      detalhes: Number.isFinite(Number(data.parentId))
        ? `Comentario de resposta adicionado ao comentario #${Number(data.parentId)}.`
        : 'Comentario adicionado.',
      processoId: comentario.processoId,
      departamentoId: comentario.departamentoId,
      ip: getIp(request),
    });

    // Se for uma resposta (parentId), notifica o autor do comentário pai
    if (Number.isFinite(Number(data.parentId))) {
      try {
        const parentId = Number(data.parentId);
        const parent = await prisma.comentario.findUnique({
          where: { id: parentId },
          select: { id: true, autorId: true, processoId: true },
        });

        // Só notifica se existir, for do mesmo processo, e não for o próprio autor
        if (parent && Number(parent.processoId) === Number(data.processoId) && Number(parent.autorId) !== Number(user.id)) {
          const processo = await prisma.processo.findUnique({
            where: { id: data.processoId },
            include: {
              empresa: {
                select: { razao_social: true, apelido: true, codigo: true },
              },
            },
          });

          const nomeEmpresa = processo?.empresa
            ? (processo.empresa.apelido || processo.empresa.razao_social || processo.empresa.codigo)
            : `Processo #${data.processoId}`;

          await prisma.notificacao.create({
            data: {
              usuarioId: parent.autorId,
              mensagem: `${user.nome} respondeu seu comentário no processo ${nomeEmpresa}`,
              tipo: 'INFO',
              processoId: data.processoId,
              link: `/processos/${data.processoId}`,
            },
          });
        }
      } catch (notifReplyError) {
        console.error('Erro ao criar notificação de resposta:', notifReplyError);
        // Não falhar o comentário se notificação falhar
      }
    }

    // Criar notificações para usuários mencionados
    if (data.mencoes && Array.isArray(data.mencoes) && data.mencoes.length > 0) {
      try {
        // Buscar processo para pegar nome da empresa
        const processo = await prisma.processo.findUnique({
          where: { id: data.processoId },
          include: {
            empresa: {
              select: { razao_social: true, apelido: true, codigo: true },
            },
          },
        });

        const nomeEmpresa = processo?.empresa
          ? (processo.empresa.apelido || processo.empresa.razao_social || processo.empresa.codigo)
          : `Processo #${data.processoId}`;

        const normalizarNome = (s: unknown) =>
          String(s ?? '')
            .replace(/^@/, '')
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Extrair nomes de usuários das menções (formato @nome_usuario)
        const nomesMencionados = Array.from(
          new Set((data.mencoes as any[]).map(normalizarNome).filter(Boolean))
        );

        // Buscar usuários mencionados (case-insensitive)
        // Obs: evita falhas comuns por diferença de maiúsculas/minúsculas e espaços.
        const usuariosMencionados = nomesMencionados.length
          ? await prisma.usuario.findMany({
              where: {
                id: { not: user.id }, // Não notificar o próprio autor
                OR: nomesMencionados.map((nome: string) => ({
                  nome: { equals: nome, mode: 'insensitive' },
                })),
              },
            })
          : [];

        // Criar notificações
        await Promise.all(
          usuariosMencionados.map((usuario) =>
            prisma.notificacao.create({
              data: {
                usuarioId: usuario.id,
                mensagem: `${user.nome} mencionou você em um comentário no processo ${nomeEmpresa}`,
                tipo: 'INFO',
                processoId: data.processoId,
                link: `/processos/${data.processoId}`,
              },
            })
          )
        );
      } catch (notifError) {
        console.error('Erro ao criar notificações de menção:', notifError);
        // Não falhar o comentário se notificação falhar
      }
    }
    
    return NextResponse.json(comentario, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar comentário:', error);
    return NextResponse.json(
      { error: 'Erro ao criar comentário' },
      { status: 500 }
    );
  }
}




