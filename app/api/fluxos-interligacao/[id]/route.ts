import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// PUT /api/fluxos-interligacao/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const id = parseInt(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const data = await request.json();

    const fluxo = await prisma.fluxoInterligacao.update({
      where: { id },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.descricao !== undefined && { descricao: data.descricao }),
        ...(Array.isArray(data.templateIds) && { templateIds: data.templateIds.map(Number) }),
      },
    });

    return NextResponse.json(fluxo);
  } catch (error: any) {
    console.error('Erro ao atualizar fluxo de interligacao:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Fluxo nao encontrado' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Erro ao atualizar fluxo de interligacao' },
      { status: 500 }
    );
  }
}

// DELETE /api/fluxos-interligacao/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const id = parseInt(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    await prisma.fluxoInterligacao.delete({ where: { id } });

    return NextResponse.json({ message: 'Fluxo excluido com sucesso' });
  } catch (error: any) {
    console.error('Erro ao excluir fluxo de interligacao:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Fluxo nao encontrado' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Erro ao excluir fluxo de interligacao' },
      { status: 500 }
    );
  }
}
