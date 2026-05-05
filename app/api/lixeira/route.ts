import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// Dias para expiração na lixeira
const DIAS_EXPIRACAO = 15;

function jsonBigInt(data: unknown, init?: { status?: number }) {
  return new NextResponse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ),
    {
      status: init?.status ?? 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    }
  );
}

// Verifica se usuário pode ver item na lixeira (baseado nas permissões originais)
function usuarioPodeVerItem(item: any, userId: number, userRole: string): boolean {
  const vis = String(item.visibility || 'PUBLIC').toUpperCase();
  const allowedRoles: string[] = Array.isArray(item.allowedRoles) 
    ? item.allowedRoles.map((r: any) => String(r).toUpperCase()) 
    : [];
  const allowedUserIds: number[] = Array.isArray(item.allowedUserIds) 
    ? item.allowedUserIds.map((n: any) => Number(n)) 
    : [];

  // Quem deletou sempre pode ver
  if (item.deletadoPorId === userId) return true;

  // Admin sempre pode ver
  if (userRole === 'ADMIN' || userRole === 'ADMIN_DEPARTAMENTO') return true;

  // Verificação de visibilidade original
  if (vis === 'PUBLIC') return true;
  if (vis === 'ROLES') {
    if (allowedRoles.length === 0) return false;
    return allowedRoles.includes(userRole);
  }
  if (vis === 'USERS') {
    if (allowedUserIds.length === 0) return false;
    return allowedUserIds.includes(userId);
  }
  
  return false;
}

// GET /api/lixeira - Lista itens na lixeira
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const { searchParams } = new URL(request.url);
    const tipoItem = searchParams.get('tipoItem'); // PROCESSO, DOCUMENTO
    
    const userId = Number(user.id);
    const userRole = String((user as any).role || '').toUpperCase();

    // Buscar itens não expirados
    const itens = await prisma.itemLixeira.findMany({
      where: {
        expiraEm: { gt: new Date() },
        ...(tipoItem && { tipoItem: tipoItem as any }),
      },
      orderBy: { deletadoEm: 'desc' },
    });

    // Filtrar por permissões
    const itensFiltrados = itens.filter(item => usuarioPodeVerItem(item, userId, userRole));

    // Adicionar dias restantes e informações de quem deletou
    const agora = new Date();
    const itensComDias = itensFiltrados.map(item => ({
      ...item,
      diasRestantes: Math.max(0, Math.ceil((new Date(item.expiraEm).getTime() - agora.getTime()) / (1000 * 60 * 60 * 24))),
    }));

    // Buscar usuários que deletaram (para exibir nome/email)
    const deletorIds = Array.from(new Set(itensComDias.map(i => i.deletadoPorId)));
    const usuarios = await prisma.usuario.findMany({ where: { id: { in: deletorIds } }, select: { id: true, nome: true, email: true } });
    const usuariosById = usuarios.reduce((acc: any, u: any) => { acc[u.id] = u; return acc; }, {});

    const itensComUsuario = itensComDias.map((it: any) => ({
      ...it,
      deletadoPor: usuariosById[it.deletadoPorId] || null,
    }));

    return jsonBigInt(itensComUsuario);
  } catch (error) {
    console.error('Erro ao buscar lixeira:', error);
    return jsonBigInt({ error: 'Erro ao buscar lixeira' }, { status: 500 });
  }
}

// POST /api/lixeira - Limpar itens expirados (chamado manualmente ou por cron)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const userRole = String((user as any).role || '').toUpperCase();
    
    // Apenas admin pode forçar limpeza
    if (userRole !== 'ADMIN' && userRole !== 'ADMIN_DEPARTAMENTO') {
      return jsonBigInt({ error: 'Sem permissão para esta ação' }, { status: 403 });
    }

    // Excluir itens expirados
    const resultado = await prisma.itemLixeira.deleteMany({
      where: {
        expiraEm: { lte: new Date() },
      },
    });

    return jsonBigInt({ 
      message: 'Limpeza da lixeira concluída',
      itensRemovidos: resultado.count,
    });
  } catch (error) {
    console.error('Erro na limpeza da lixeira:', error);
    return jsonBigInt({ error: 'Erro na limpeza da lixeira' }, { status: 500 });
  }
}

// DELETE /api/lixeira - Esvaziar lixeira (todos os itens que o usuário pode ver)
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const userRole = String((user as any).role || '').toUpperCase();
    
    // Apenas admin pode esvaziar toda a lixeira
    if (userRole !== 'ADMIN' && userRole !== 'ADMIN_DEPARTAMENTO') {
      return jsonBigInt({ error: 'Sem permissão para esvaziar lixeira' }, { status: 403 });
    }

    const resultado = await prisma.itemLixeira.deleteMany({});

    return jsonBigInt({ 
      message: 'Lixeira esvaziada com sucesso',
      itensRemovidos: resultado.count,
    });
  } catch (error) {
    console.error('Erro ao esvaziar lixeira:', error);
    return jsonBigInt({ error: 'Erro ao esvaziar lixeira' }, { status: 500 });
  }
}
