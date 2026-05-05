import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';
import { registrarLog, getIp } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/departamentos
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const departamentos = await prisma.departamento.findMany({
      where: { ativo: true },
      orderBy: { ordem: 'asc' },
      include: {
        _count: {
          select: { processos: true },
        },
      },
    });
    
    return NextResponse.json(departamentos);
  } catch (error) {
    console.error('Erro ao buscar departamentos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar departamentos' },
      { status: 500 }
    );
  }
}

// POST /api/departamentos
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    if (!requireRole(user, ['ADMIN'])) {
      return NextResponse.json({ error: 'Sem permissão para criar departamento' }, { status: 403 });
    }

    const data = await request.json();
    
    // Validar campos obrigatórios
    if (!data.nome || !data.responsavel) {
      return NextResponse.json(
        { error: 'Nome e responsável são obrigatórios' },
        { status: 400 }
      );
    }
    
    const departamento = await prisma.departamento.create({
      data: {
        nome: String(data.nome).trim(),
        descricao: data.descricao ? String(data.descricao).trim() : null,
        responsavel: String(data.responsavel).trim(),
        cor: data.cor || 'from-cyan-500 to-blue-600',
        icone: data.icone ? String(data.icone) : 'FileText',
        ordem: data.ordem !== undefined ? Number(data.ordem) : 0,
        ativo: data.ativo !== undefined ? Boolean(data.ativo) : true,
      },
    });

    await registrarLog({
      usuarioId: user.id as number,
      acao: 'CRIAR',
      entidade: 'DEPARTAMENTO',
      entidadeId: departamento.id,
      entidadeNome: departamento.nome,
      ip: getIp(request),
    });

    return NextResponse.json(departamento, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar departamento:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao criar departamento' },
      { status: 500 }
    );
  }
}

