import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { getUserFromToken } from '@/app/utils/auth';
import { GHOST_USER_EMAIL, MASTER_USER_EMAIL } from '@/app/utils/constants';

export const dynamic = 'force-dynamic';

function isSuperUser(user: any): boolean {
  if (!user) return false;
  return user.isGhost === true || user.email === GHOST_USER_EMAIL || user.email === MASTER_USER_EMAIL;
}

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  if (!token) return null;
  return getUserFromToken(token);
}

// GET: listar sessões ativas
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || !isSuperUser(user)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Buscar sessões ativas (último acesso nos últimos 7 dias)
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const sessoes = await prisma.sessaoAtiva.findMany({
      where: {
        ativo: true,
        ultimoAcesso: { gte: seteDiasAtras },
      },
      orderBy: { ultimoAcesso: 'desc' },
    });

    // Enriquecer com dados do usuário
    const userIds = [...new Set(sessoes.map((s: any) => s.usuarioId))];
    const usuarios = userIds.length > 0
      ? await prisma.usuario.findMany({
          where: { id: { in: userIds as number[] } },
          select: { id: true, nome: true, email: true, role: true },
        })
      : [];
    const userMap = new Map(usuarios.map(u => [u.id, u]));

    const sessoesComUsuario = sessoes.map((s: any) => ({
      ...s,
      usuario: userMap.get(s.usuarioId) || null,
    }));

    return NextResponse.json({ sessoes: sessoesComUsuario });
  } catch (error: any) {
    console.error('Erro ao listar sessões:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// DELETE: desconectar sessão(ões)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || !isSuperUser(user)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { sessaoId, todas } = body;

    if (todas) {
      // Desconectar todas exceto a sessão atual do ghost
      await prisma.sessaoAtiva.updateMany({
        where: {
          ativo: true,
          usuarioId: { not: user.id },
        },
        data: { ativo: false },
      });
    } else if (sessaoId) {
      await prisma.sessaoAtiva.update({
        where: { id: sessaoId },
        data: { ativo: false },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao desconectar sessão:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
