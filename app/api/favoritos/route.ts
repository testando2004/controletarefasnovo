import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';

// GET - Listar processos favoritos do usuário
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const favoritos = await (prisma as any).processoFavorito.findMany({
      where: {
        usuarioId: user.id,
      },
      include: {
        processo: {
          include: {
            empresa: true,
            departamentoAtualRel: true,
            responsavel: {
              select: { id: true, nome: true, email: true }
            },
            tags: {
              include: { tag: true }
            },
            _count: {
              select: { comentarios: true, documentos: true }
            }
          }
        }
      },
      orderBy: {
        // Ordem cronológica de fixação: primeiro que foi fixado aparece em primeiro,
        // último fixado vai pro fim da lista. Isso preserva a ordem de prioridade
        // que o usuário definiu ao ir fixando.
        criadoEm: 'asc'
      }
    });

    // Retornar apenas os processos (já formatados)
    const processosFormatados = favoritos.map((fav: any) => ({
      ...fav.processo,
      favoritoId: fav.id,
      favoritadoEm: fav.criadoEm,
      isFavorito: true
    }));

    return NextResponse.json(processosFormatados);
  } catch (error: any) {
    console.error('Erro ao buscar favoritos:', error);
    return NextResponse.json({ error: 'Erro ao buscar favoritos' }, { status: 500 });
  }
}

// POST - Adicionar processo aos favoritos
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { processoId } = body;

    if (!processoId) {
      return NextResponse.json({ error: 'ID do processo é obrigatório' }, { status: 400 });
    }

    // Verificar se o processo existe
    const processo = await prisma.processo.findUnique({
      where: { id: Number(processoId) }
    });

    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 });
    }

    // Verificar se já é favorito
    const existente = await (prisma as any).processoFavorito.findUnique({
      where: {
        usuarioId_processoId: {
          usuarioId: user.id,
          processoId: Number(processoId)
        }
      }
    });

    if (existente) {
      return NextResponse.json({ error: 'Processo já está nos favoritos' }, { status: 409 });
    }

    // Criar favorito
    const favorito = await (prisma as any).processoFavorito.create({
      data: {
        usuarioId: user.id,
        processoId: Number(processoId)
      },
      include: {
        processo: {
          include: {
            empresa: true,
            departamentoAtualRel: true
          }
        }
      }
    });

    return NextResponse.json({
      message: 'Processo adicionado aos favoritos',
      favorito
    }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao adicionar favorito:', error);
    return NextResponse.json({ error: 'Erro ao adicionar aos favoritos' }, { status: 500 });
  }
}

// DELETE - Remover processo dos favoritos (por processoId no body)
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { processoId } = body;

    if (!processoId) {
      return NextResponse.json({ error: 'ID do processo é obrigatório' }, { status: 400 });
    }

    // Remover favorito
    await (prisma as any).processoFavorito.deleteMany({
      where: {
        usuarioId: user.id,
        processoId: Number(processoId)
      }
    });

    return NextResponse.json({ message: 'Removido dos favoritos' });
  } catch (error: any) {
    console.error('Erro ao remover favorito:', error);
    return NextResponse.json({ error: 'Erro ao remover dos favoritos' }, { status: 500 });
  }
}
