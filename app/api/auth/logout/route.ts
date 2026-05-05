import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;

    if (token) {
      // Marcar sessão como inativa
      await prisma.sessaoAtiva.updateMany({
        where: { token, ativo: true },
        data: { ativo: false },
      });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set('token', '', { maxAge: 0 });
    return response;
  } catch (error: any) {
    console.error('Erro no logout:', error);
    const response = NextResponse.json({ success: true });
    response.cookies.set('token', '', { maxAge: 0 });
    return response;
  }
}
