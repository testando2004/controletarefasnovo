import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/usuarios/me
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    
    const usuario = await prisma.usuario.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        permissoes: true,
        ativo: true,
        departamento: {
          select: { id: true, nome: true },
        },
        criadoEm: true,
      },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Anexa departamentosExtras via raw (Prisma client antigo pode não conhecer)
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ departamentoId: number | null; departamentosExtras: number[] | null }>>(
        `SELECT "departamentoId", "departamentosExtras" FROM "Usuario" WHERE id = ${Number(user.id)}`
      );
      if (rows?.[0]) {
        (usuario as any).departamentoId = rows[0].departamentoId;
        (usuario as any).departamentosExtras = Array.isArray(rows[0].departamentosExtras) ? rows[0].departamentosExtras.map(Number) : [];
      }
    } catch {
      (usuario as any).departamentosExtras = [];
    }

    return NextResponse.json(usuario);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar usuário' },
      { status: 500 }
    );
  }
}




