import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { assertProcessAccess } from '@/app/utils/processAccess';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

export async function GET(
  request: NextRequest,
  { params }: { params: { processoId: string; departamentoId: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const processoId = parseInt(params.processoId);
    const departamentoId = parseInt(params.departamentoId);
    const access = await assertProcessAccess(user, processoId, 'read', { departamentoId });
    if (access.error) return access.error;

    const respostas = await prisma.respostaQuestionario.findMany({
      where: {
        processoId,
        questionario: {
          departamentoId,
        },
      },
      include: {
        questionario: true,
        respondidoPor: {
          select: { id: true, nome: true },
        },
      },
      orderBy: { respondidoEm: 'desc' },
    });
    
    return NextResponse.json(respostas);
  } catch (error) {
    console.error('Erro ao buscar respostas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar respostas' },
      { status: 500 }
    );
  }
}




