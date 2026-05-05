import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';
import { registrarLog, getIp, detectarMudancas } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/departamentos/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const departamento = await prisma.departamento.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        questionarios: {
          orderBy: { ordem: 'asc' },
        },
        documentosObrigatorios: true,
        _count: {
          select: { processos: true },
        },
      },
    });
    
    if (!departamento) {
      return NextResponse.json(
        { error: 'Departamento não encontrado' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(departamento);
  } catch (error) {
    console.error('Erro ao buscar departamento:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar departamento' },
      { status: 500 }
    );
  }
}

// PUT /api/departamentos/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    if (!requireRole(user, ['ADMIN'])) {
      return NextResponse.json({ error: 'Sem permissão para editar departamento' }, { status: 403 });
    }

    const data = await request.json();

    const departamentoAntigo = await prisma.departamento.findUnique({
      where: { id: parseInt(params.id) },
    });

    const departamento = await prisma.departamento.update({
      where: { id: parseInt(params.id) },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.descricao !== undefined && { descricao: data.descricao }),
        ...(data.responsavel !== undefined && { responsavel: data.responsavel }),
        ...(data.cor !== undefined && { cor: data.cor }),
        ...(data.icone !== undefined && { icone: data.icone }),
        ...(data.ordem !== undefined && { ordem: data.ordem }),
        ...(data.ativo !== undefined && { ativo: data.ativo }),
      },
    });

    if (departamentoAntigo) {
      const mudancas = detectarMudancas(departamentoAntigo as Record<string, any>, departamento as Record<string, any>);
      for (const m of mudancas) {
        await registrarLog({
          usuarioId: user.id as number,
          acao: 'EDITAR',
          entidade: 'DEPARTAMENTO',
          entidadeId: departamento.id,
          entidadeNome: departamento.nome,
          campo: m.campo,
          valorAnterior: m.valorAnterior,
          valorNovo: m.valorNovo,
          ip: getIp(request),
        });
      }
      if (mudancas.length === 0) {
        await registrarLog({
          usuarioId: user.id as number,
          acao: 'EDITAR',
          entidade: 'DEPARTAMENTO',
          entidadeId: departamento.id,
          entidadeNome: departamento.nome,
          ip: getIp(request),
        });
      }
    } else {
      await registrarLog({
        usuarioId: user.id as number,
        acao: 'EDITAR',
        entidade: 'DEPARTAMENTO',
        entidadeId: departamento.id,
        entidadeNome: departamento.nome,
        ip: getIp(request),
      });
    }

    return NextResponse.json(departamento);
  } catch (error) {
    console.error('Erro ao atualizar departamento:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar departamento' },
      { status: 500 }
    );
  }
}

// DELETE /api/departamentos/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    if (!requireRole(user, ['ADMIN'])) {
      return NextResponse.json({ error: 'Sem permissão para excluir departamento' }, { status: 403 });
    }

    // Buscar departamento atual e salvar na lixeira
    const deptId = parseInt(params.id);
    const departamento = await prisma.departamento.findUnique({ where: { id: deptId } });
    if (!departamento) {
      return NextResponse.json({ error: 'Departamento não encontrado' }, { status: 404 });
    }

    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 15);

    let backupWarning: string | null = null;
    try {
      // Serialize departamento to plain JSON (removes Date objects) before saving
      const dadosOriginais = JSON.parse(JSON.stringify(departamento));

      const created = await prisma.itemLixeira.create({
        data: {
          tipoItem: 'DEPARTAMENTO',
          itemIdOriginal: departamento.id,
          dadosOriginais,
          departamentoId: departamento.id,
          visibility: 'PUBLIC',
          allowedRoles: [],
          allowedUserIds: [],
          deletadoPorId: user.id as number,
          expiraEm: dataExpiracao,
          nomeItem: departamento.nome,
          descricaoItem: departamento.descricao || null,
        }
      });
      console.log('ItemLixeira criado para departamento:', { itemLixeiraId: created.id, departamentoId: departamento.id, criadoPor: user.id });
    } catch (e: any) {
      // Log full error details for debugging but do not block deletion
      console.error('Erro ao criar ItemLixeira for departamento:', { error: e, params, deptId, departamento });
      try {
        // attach some useful info for the client
        backupWarning = String(e.message || e);
      } catch {
        backupWarning = 'Erro ao salvar backup na lixeira';
      }
    }

    // Desativar departamento (soft-delete)
    await prisma.departamento.update({ where: { id: deptId }, data: { ativo: false } });

    await registrarLog({
      usuarioId: user.id as number,
      acao: 'EXCLUIR',
      entidade: 'DEPARTAMENTO',
      entidadeId: departamento.id,
      entidadeNome: departamento.nome,
      ip: getIp(request),
    });

    const respBody: any = { message: 'Departamento movido para lixeira e desativado' };
    if (backupWarning) respBody.warning = backupWarning;
    return NextResponse.json(respBody);
  } catch (error: any) {
    console.error('Erro ao excluir departamento:', error?.stack || error, { params });
    // Em ambiente de desenvolvimento retornamos a mensagem para ajudar debug.
    return NextResponse.json(
      { error: 'Erro ao excluir departamento', message: error?.message || String(error) },
      { status: 500 }
    );
  }
}




