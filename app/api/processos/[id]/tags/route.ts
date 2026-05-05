import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { registrarLog, getIp } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// POST /api/processos/:id/tags - Adicionar tag ao processo
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const { tagId } = await request.json();
    
    if (!tagId) {
      return NextResponse.json(
        { error: 'tagId é obrigatório' },
        { status: 400 }
      );
    }
    
    await prisma.processoTag.create({
      data: {
        processoId: parseInt(params.id),
        tagId: parseInt(tagId),
      },
    });

    const tag = await prisma.tag.findUnique({ where: { id: parseInt(tagId) } });

    await registrarLog({
      usuarioId: user.id,
      acao: 'TAG',
      entidade: 'TAG',
      entidadeId: parseInt(tagId),
      entidadeNome: tag?.nome || 'N/A',
      processoId: parseInt(params.id),
      ip: getIp(request),
    });

    const processo = await prisma.processo.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        tags: { include: { tag: true } },
      },
    });
    
    return NextResponse.json(processo);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Tag já está associada ao processo' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Erro ao adicionar tag' },
      { status: 500 }
    );
  }
}

// PUT /api/processos/:id/tags - Substituir todas as tags do processo
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const { tags } = await request.json();
    
    if (!Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'tags deve ser um array' },
        { status: 400 }
      );
    }
    
    const processoId = parseInt(params.id);
    
    // Remove todas as tags existentes
    await prisma.processoTag.deleteMany({
      where: { processoId },
    });
    
    // Adiciona as novas tags
    if (tags.length > 0) {
      await prisma.processoTag.createMany({
        data: tags.map((tagId: number) => ({
          processoId,
          tagId: parseInt(String(tagId)),
        })),
      });
    }
    
    // Retorna o processo atualizado
    const processo = await prisma.processo.findUnique({
      where: { id: processoId },
      include: {
        tags: { include: { tag: true } },
      },
    });

    const tagNames = processo?.tags?.map((t: any) => t.tag.nome).join(', ') || 'N/A';

    await registrarLog({
      usuarioId: user.id,
      acao: 'TAG',
      entidade: 'TAG',
      entidadeId: processoId,
      entidadeNome: tagNames,
      processoId,
      detalhes: 'Substituicao de tags do processo',
      ip: getIp(request),
    });

    return NextResponse.json(processo);
  } catch (error: any) {
    console.error('Erro ao atualizar tags:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar tags' },
      { status: 500 }
    );
  }
}

// DELETE /api/processos/:id/tags/:tagId - Remover tag do processo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; tagId: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    await prisma.processoTag.deleteMany({
      where: {
        processoId: parseInt(params.id),
        tagId: parseInt(params.tagId),
      },
    });

    await registrarLog({
      usuarioId: user.id,
      acao: 'TAG',
      entidade: 'TAG',
      entidadeId: parseInt(params.tagId),
      entidadeNome: 'N/A',
      processoId: parseInt(params.id),
      detalhes: 'Remocao de tag do processo',
      ip: getIp(request),
    });

    return NextResponse.json({ message: 'Tag removida do processo' });
  } catch (error) {
    console.error('Erro ao remover tag:', error);
    return NextResponse.json(
      { error: 'Erro ao remover tag' },
      { status: 500 }
    );
  }
}

