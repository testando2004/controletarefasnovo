import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// DELETE /api/analytics/exclusoes
// Apaga permanentemente todos os registros de exclusão de processos (ItemLixeira do tipo PROCESSO).
// Usado para zerar o gráfico de "Análise de Exclusões" após testes.
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    if (!requireRole(user, ['ADMIN'])) {
      return NextResponse.json({ error: 'Apenas administradores podem limpar o histórico de exclusões' }, { status: 403 });
    }

    const result = await prisma.itemLixeira.deleteMany({ where: { tipoItem: 'PROCESSO' } });
    return NextResponse.json({ ok: true, removidos: result.count });
  } catch (e) {
    console.error('Erro ao limpar exclusões:', e);
    return NextResponse.json({ error: 'Erro ao limpar histórico de exclusões' }, { status: 500 });
  }
}
