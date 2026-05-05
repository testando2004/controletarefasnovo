import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/notificacoes
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    
    const { searchParams } = new URL(request.url);
    const apenasNaoLidas = searchParams.get('apenasNaoLidas') === 'true';
    
    const notificacoes = await prisma.notificacao.findMany({
      where: {
        usuarioId: user.id,
        ...(apenasNaoLidas && { lida: false }),
      },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });
    
    return NextResponse.json(notificacoes);
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar notificações' },
      { status: 500 }
    );
  }
}

// POST /api/notificacoes - Criar notificação (geralmente usado pelo sistema)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const roleUpper = String((user as any).role || '').toUpperCase();
    if (roleUpper !== 'ADMIN' && roleUpper !== 'ADMIN_DEPARTAMENTO') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const data = await request.json();
    
    const notificacao = await prisma.notificacao.create({
      data: {
        usuarioId: data.usuarioId,
        mensagem: data.mensagem,
        tipo: data.tipo || 'INFO',
        processoId: data.processoId || null,
        link: data.link || null,
      },
    });
    
    return NextResponse.json(notificacao, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    return NextResponse.json(
      { error: 'Erro ao criar notificação' },
      { status: 500 }
    );
  }
}




