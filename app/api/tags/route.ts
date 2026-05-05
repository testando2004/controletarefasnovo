import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';
import { registrarLog, getIp } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/tags
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const tags = await prisma.tag.findMany({
      orderBy: { nome: 'asc' },
      include: {
        _count: {
          select: { processos: true },
        },
      },
    });
    
    return NextResponse.json(tags);
  } catch (error) {
    console.error('Erro ao buscar tags:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar tags' },
      { status: 500 }
    );
  }
}

// POST /api/tags
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    if (!requireRole(user, ['ADMIN', 'GERENTE', 'USUARIO'])) {
      return NextResponse.json({ error: 'Sem permissão para criar tags' }, { status: 403 });
    }

    const data = await request.json();
    
    const tag = await prisma.tag.create({
      data: {
        nome: data.nome,
        cor: data.cor || 'bg-blue-500',
        texto: data.texto || 'text-white',
      },
    });

    await registrarLog({
      usuarioId: user.id,
      acao: 'CRIAR',
      entidade: 'TAG',
      entidadeId: tag.id,
      entidadeNome: tag.nome,
      ip: getIp(request),
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar tag:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Tag já existe' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Erro ao criar tag' },
      { status: 500 }
    );
  }
}




