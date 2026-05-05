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

// GET: verificar status do modo manutenção (acessível por todos)
export async function GET(request: NextRequest) {
  try {
    const config = await (prisma as any).configuracaoSistema?.findUnique?.({
      where: { chave: 'modo_manutencao' },
    }).catch(() => null);

    return NextResponse.json({
      ativo: config?.valor === 'true',
      atualizadoEm: config?.atualizadoEm || null,
    });
  } catch (error: any) {
    return NextResponse.json({ ativo: false });
  }
}

// POST: ativar/desativar modo manutenção (apenas super users)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || !isSuperUser(user)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { ativo } = await request.json();

    await (prisma as any).configuracaoSistema?.upsert?.({
      where: { chave: 'modo_manutencao' },
      update: {
        valor: String(!!ativo),
        atualizadoPorId: user.id,
      },
      create: {
        chave: 'modo_manutencao',
        valor: String(!!ativo),
        atualizadoPorId: user.id,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      ativo: !!ativo,
    });
  } catch (error: any) {
    console.error('Erro ao alterar manutenção:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
