import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

export interface TokenPayload {
  userId: number;
  email: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(payload: TokenPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET não configurado');
  
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as string;
  
  return jwt.sign(payload, secret, {
    expiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET não configurado');
  
  return jwt.verify(token, secret) as TokenPayload;
}

export async function getUserFromToken(token: string) {
  try {
    const payload = verifyToken(token);

    // Cache simples por instância (útil em Vercel/Serverless quando o runtime está "quente")
    // Evita bater no banco a cada request apenas para buscar o usuário.
    const userId = payload.userId;
    const cacheTtlMs = Number(process.env.AUTH_USER_CACHE_TTL_MS || 60_000);
    const globalAny = globalThis as any;
    globalAny.__authUserCache = globalAny.__authUserCache || new Map<number, { expiresAt: number; value: any }>();
    const cache: Map<number, { expiresAt: number; value: any }> = globalAny.__authUserCache;

    if (Number.isFinite(cacheTtlMs) && cacheTtlMs > 0) {
      const hit = cache.get(userId);
      if (hit && hit.expiresAt > Date.now()) return hit.value;
    }

    const user = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        departamentoId: true,
        permissoes: true,
        ativo: true,
        isGhost: true,
      },
    });

    // Anexa departamentosExtras via raw (compatível com Prisma client antigo)
    if (user) {
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ departamentosExtras: number[] | null }>>(
          `SELECT "departamentosExtras" FROM "Usuario" WHERE id = ${Number(user.id)}`
        );
        const extras = rows?.[0]?.departamentosExtras;
        (user as any).departamentosExtras = Array.isArray(extras) ? extras.map(Number) : [];
      } catch {
        (user as any).departamentosExtras = [];
      }
    }

    if (Number.isFinite(cacheTtlMs) && cacheTtlMs > 0) {
      cache.set(userId, { expiresAt: Date.now() + cacheTtlMs, value: user });
    }
    return user;
  } catch {
    return null;
  }
}

