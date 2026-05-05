import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// DELETE /api/notificacoes/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const notificacao = await prisma.notificacao.findUnique({ where: { id } });
    if (!notificacao) {
      return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 });
    }

    if (notificacao.usuarioId !== user.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Deleta notificação diretamente (não armazenamos notificações na lixeira)
    await prisma.notificacao.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao excluir notificação:', error);
    return NextResponse.json({ error: 'Erro ao excluir notificação' }, { status: 500 });
  }
}
