import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';
import { registrarLog, getIp } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// PUT /api/comentarios/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    
    const { texto } = await request.json();
    
    // Verificar se o comentário pertence ao usuário
    const comentarioExistente = await prisma.comentario.findUnique({
      where: { id: parseInt(params.id) },
    });
    
    if (!comentarioExistente) {
      return NextResponse.json(
        { error: 'Comentário não encontrado' },
        { status: 404 }
      );
    }
    
    if (comentarioExistente.autorId !== user.id) {
      return NextResponse.json(
        { error: 'Sem permissão para editar este comentário' },
        { status: 403 }
      );
    }
    
    const comentario = await prisma.comentario.update({
      where: { id: parseInt(params.id) },
      data: {
        texto,
        editado: true,
        editadoEm: new Date(),
      },
      include: {
        autor: {
          select: { id: true, nome: true, email: true },
        },
        departamento: {
          select: { id: true, nome: true },
        },
      },
    });

    await registrarLog({
      usuarioId: user.id,
      acao: 'COMENTAR',
      entidade: 'COMENTARIO',
      entidadeId: comentario.id,
      entidadeNome: `Comentario #${comentario.id}`,
      campo: 'texto',
      valorAnterior: comentarioExistente.texto,
      valorNovo: texto,
      detalhes: 'Comentario editado.',
      processoId: comentario.processoId || null,
      departamentoId: comentario.departamentoId || null,
      ip: getIp(request),
    });

    return NextResponse.json(comentario);
  } catch (error) {
    console.error('Erro ao atualizar comentário:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar comentário' },
      { status: 500 }
    );
  }
}

// DELETE /api/comentarios/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    
    // Verificar se o comentário pertence ao usuário ou se é admin
    const comentario = await prisma.comentario.findUnique({
      where: { id: parseInt(params.id) },
    });
    
    if (!comentario) {
      return NextResponse.json(
        { error: 'Comentário não encontrado' },
        { status: 404 }
      );
    }
    
    if (comentario.autorId !== user.id && !requireRole(user, ['ADMIN'])) {
      return NextResponse.json(
        { error: 'Sem permissão para excluir este comentário' },
        { status: 403 }
      );
    }
    
    // Salvar na lixeira antes de excluir
    const dadosComentario = comentario;
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 15);

    try {
      const dadosOriginais = JSON.parse(JSON.stringify(dadosComentario));
      await prisma.itemLixeira.create({
        data: {
          tipoItem: 'COMENTARIO',
          itemIdOriginal: comentario.id,
          dadosOriginais,
          processoId: comentario.processoId,
          departamentoId: comentario.departamentoId,
          visibility: 'PUBLIC',
          allowedRoles: [],
          allowedUserIds: [],
          deletadoPorId: user.id as number,
          expiraEm: dataExpiracao,
          nomeItem: `Comentário #${comentario.id}`,
          descricaoItem: (comentario.texto || '').substring(0, 200),
        }
      });
    } catch (e) {
      console.error('Erro ao criar ItemLixeira for comentario:', e);
    }

    // Agora remove o comentário permanentemente
    await prisma.comentario.delete({ where: { id: parseInt(params.id) } });

    await registrarLog({
      usuarioId: user.id,
      acao: 'EXCLUIR',
      entidade: 'COMENTARIO',
      entidadeId: comentario.id,
      entidadeNome: `Comentario #${comentario.id}`,
      campo: 'texto',
      valorAnterior: comentario.texto,
      valorNovo: null,
      detalhes: 'Comentario movido para lixeira.',
      processoId: comentario.processoId || null,
      departamentoId: comentario.departamentoId || null,
      ip: getIp(request),
    });

    return NextResponse.json({ message: 'Comentário movido para lixeira' });
  } catch (error) {
    console.error('Erro ao excluir comentário:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir comentário' },
      { status: 500 }
    );
  }
}




