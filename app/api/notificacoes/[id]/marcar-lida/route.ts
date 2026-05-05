import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// PATCH /api/notificacoes/:id/marcar-lida
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    
    // Verificar se a notificação pertence ao usuário
    const notificacao = await prisma.notificacao.findUnique({
      where: { id: parseInt(params.id) },
    });
    
    if (!notificacao) {
      return NextResponse.json(
        { error: 'Notificação não encontrada' },
        { status: 404 }
      );
    }
    
    if (notificacao.usuarioId !== user.id) {
      return NextResponse.json(
        { error: 'Sem permissão' },
        { status: 403 }
      );
    }
    
    const notificacaoAtualizada = await prisma.notificacao.update({
      where: { id: parseInt(params.id) },
      data: { lida: true },
    });
    
    return NextResponse.json(notificacaoAtualizada);
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
    return NextResponse.json(
      { error: 'Erro ao marcar notificação como lida' },
      { status: 500 }
    );
  }
}




