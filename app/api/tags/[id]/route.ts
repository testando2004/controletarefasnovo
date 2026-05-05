import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';
import { registrarLog, getIp } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// PUT /api/tags/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    if (!requireRole(user, ['ADMIN', 'GERENTE', 'USUARIO'])) {
      return NextResponse.json({ error: 'Sem permissão para editar tags' }, { status: 403 });
    }

    const data = await request.json();
    
    const tag = await prisma.tag.update({
      where: { id: parseInt(params.id) },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.cor !== undefined && { cor: data.cor }),
        ...(data.texto !== undefined && { texto: data.texto }),
      },
    });

    await registrarLog({
      usuarioId: user.id,
      acao: 'EDITAR',
      entidade: 'TAG',
      entidadeId: tag.id,
      entidadeNome: tag.nome,
      ip: getIp(request),
    });

    return NextResponse.json(tag);
  } catch (error: any) {
    console.error('Erro ao atualizar tag:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Tag já existe' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Erro ao atualizar tag' },
      { status: 500 }
    );
  }
}

// DELETE /api/tags/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    if (!requireRole(user, ['ADMIN', 'GERENTE', 'USUARIO'])) {
      return NextResponse.json({ error: 'Sem permissão para excluir tags' }, { status: 403 });
    }

    const tag = await prisma.tag.findUnique({ where: { id: parseInt(params.id) } });
    if (!tag) return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 });

    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 15);

    try {
      const dadosOriginais = JSON.parse(JSON.stringify(tag));
      await prisma.itemLixeira.create({
        data: {
          tipoItem: 'TAG',
          itemIdOriginal: tag.id,
          dadosOriginais,
          visibility: 'PUBLIC',
          allowedRoles: [],
          allowedUserIds: [],
          deletadoPorId: user.id as number,
          expiraEm: dataExpiracao,
          nomeItem: tag.nome,
          descricaoItem: null,
        }
      });
    } catch (e) {
      console.error('Erro ao criar ItemLixeira for tag:', e);
    }

    await prisma.tag.delete({ where: { id: tag.id } });

    await registrarLog({
      usuarioId: user.id,
      acao: 'EXCLUIR',
      entidade: 'TAG',
      entidadeId: tag.id,
      entidadeNome: tag.nome,
      ip: getIp(request),
    });

    return NextResponse.json({ message: 'Tag movida para lixeira' });
  } catch (error) {
    console.error('Erro ao excluir tag:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir tag' },
      { status: 500 }
    );
  }
}

// POST /api/tags/:id/processos/:processoId - Adicionar tag a processo
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const { processoId } = await request.json();
    
    await prisma.processoTag.create({
      data: {
        processoId: parseInt(processoId),
        tagId: parseInt(params.id),
      },
    });

    await registrarLog({
      usuarioId: user.id,
      acao: 'TAG',
      entidade: 'TAG',
      entidadeId: parseInt(params.id),
      entidadeNome: 'N/A',
      processoId: parseInt(processoId),
      ip: getIp(request),
    });

    return NextResponse.json({ message: 'Tag adicionada ao processo' });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Tag já está associada ao processo' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Erro ao adicionar tag' },
      { status: 500 }
    );
  }
}




