import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { GHOST_USER_EMAIL } from '@/app/utils/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';
export const fetchCache = 'force-no-store';

// GET /api/usuarios/responsaveis
// - ADMIN: retorna usuários (pode filtrar por ?departamentoId=)
// - GERENTE: retorna usuários (sem restringir por departamento)
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const roleUpper = String((user as any).role || '').toUpperCase();

    const { searchParams } = new URL(request.url);
    const departamentoIdParam = searchParams.get('departamentoId');
    // ATENÇÃO: `searchParams.get(...)` retorna `null` quando ausente.
    // `Number(null) === 0`, então precisamos tratar explicitamente para não filtrar por departamentoId=0.
    const departamentoIdCandidate =
      typeof departamentoIdParam === 'string' && departamentoIdParam.trim() !== ''
        ? Number(departamentoIdParam)
        : undefined;
    const departamentoId =
      Number.isFinite(departamentoIdCandidate as any) && (departamentoIdCandidate as number) > 0
        ? (departamentoIdCandidate as number)
        : undefined;

    if (roleUpper !== 'ADMIN' && roleUpper !== 'ADMIN_DEPARTAMENTO' && roleUpper !== 'GERENTE') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const baseWhere: any = { ativo: true, isGhost: { not: true }, email: { not: GHOST_USER_EMAIL } };

    // Se filtro por dept foi passado, busca IDs elegíveis via raw SQL
    // (inclui usuários cujo dept principal é X OU que têm X em departamentosExtras).
    let idsElegiveis: number[] | null = null;
    if ((roleUpper === 'ADMIN' || roleUpper === 'ADMIN_DEPARTAMENTO') && typeof departamentoId === 'number') {
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
          `SELECT id FROM "Usuario"
           WHERE "departamentoId" = ${Number(departamentoId)}
              OR ${Number(departamentoId)} = ANY("departamentosExtras")`
        );
        idsElegiveis = (rows || []).map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
      } catch {
        // Coluna departamentosExtras ainda não aplicada — fallback sem extras
        idsElegiveis = null;
        baseWhere.departamentoId = departamentoId;
      }
      if (idsElegiveis !== null) {
        if (idsElegiveis.length === 0) {
          const res = NextResponse.json([]);
          res.headers.set('Cache-Control', 'no-store');
          return res;
        }
        baseWhere.id = { in: idsElegiveis };
      }
    }

    const select = {
      id: true,
      nome: true,
      email: true,
      role: true,
      ativo: true,
      departamentoId: true,
    } as const;

    const usuarios = await prisma.usuario.findMany({
      where: baseWhere,
      select,
      orderBy: { nome: 'asc' },
    });

    // Anexa departamentosExtras
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: number; departamentosExtras: number[] | null }>>(
        `SELECT id, "departamentosExtras" FROM "Usuario" WHERE id IN (${usuarios.map((u) => Number(u.id)).join(',') || '0'})`
      );
      const mapa = new Map<number, number[]>();
      for (const r of rows || []) {
        mapa.set(Number(r.id), Array.isArray(r.departamentosExtras) ? r.departamentosExtras.map(Number) : []);
      }
      for (const u of usuarios as any[]) {
        (u as any).departamentosExtras = mapa.get(Number(u.id)) || [];
      }
    } catch {
      for (const u of usuarios as any[]) {
        (u as any).departamentosExtras = [];
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      try {
        console.log('[responsaveis] retornando', usuarios.length, 'usuarios');
      } catch {
        // ignore
      }
    }

    const res = NextResponse.json(usuarios);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (e) {
    console.error('Erro ao buscar usuários responsáveis:', e);
    return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 });
  }
}
