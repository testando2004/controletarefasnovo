import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/app/utils/auth';

export type AuthUser = Awaited<ReturnType<typeof getUserFromToken>>;

function getTokenFromAuthorizationHeader(request: NextRequest): string | null {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!auth) return null;
  const [scheme, token] = auth.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  return token || null;
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser> {
  const headerToken = getTokenFromAuthorizationHeader(request);
  const cookieToken = request.cookies.get('token')?.value;
  const token = headerToken || cookieToken;
  if (!token) return null;
  return getUserFromToken(token);
}

export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.ativo === false) {
    return { user: null as AuthUser, error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) };
  }
  return { user, error: null as unknown as NextResponse };
}

export function requireRole(user: AuthUser, allowedRoles: string[]) {
  if (!user) return false;
  const role = String((user as any).role || '').toUpperCase();
  const allowed = allowedRoles.map(r => r.toUpperCase());
  if (role === 'ADMIN_DEPARTAMENTO' && allowed.includes('ADMIN')) {
    return true;
  }
  return allowed.includes(role);
}
