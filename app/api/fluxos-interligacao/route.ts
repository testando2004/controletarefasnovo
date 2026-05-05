import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/fluxos-interligacao
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const fluxos = await prisma.fluxoInterligacao.findMany({
      orderBy: { criadoEm: 'desc' },
    });

    return NextResponse.json(fluxos);
  } catch (error) {
    console.error('Erro ao buscar fluxos de interligacao:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar fluxos de interligacao' },
      { status: 500 }
    );
  }
}

// POST /api/fluxos-interligacao
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const data = await request.json();

    if (!data.nome || !Array.isArray(data.templateIds) || data.templateIds.length === 0) {
      return NextResponse.json(
        { error: 'Nome e templateIds sao obrigatorios' },
        { status: 400 }
      );
    }

    const fluxo = await prisma.fluxoInterligacao.create({
      data: {
        nome: data.nome,
        descricao: data.descricao || null,
        templateIds: data.templateIds.map(Number),
        criadoPorId: user.id as number,
      },
    });

    return NextResponse.json(fluxo, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar fluxo de interligacao:', error);
    return NextResponse.json(
      { error: 'Erro ao criar fluxo de interligacao' },
      { status: 500 }
    );
  }
}
