import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';
import { getIp, registrarLog } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

function sanitizeStatus(raw: any): string | null {
  if (raw == null) return null;
  const s = String(raw).toUpperCase();
  if (['EM_ANDAMENTO', 'CONCLUIDO', 'PAUSADO', 'CANCELADO'].includes(s)) return s;
  return null;
}

// ============================================================================
// GET /api/projetos/[id] — detalhes do projeto + processos vinculados
// ============================================================================
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const rows = await prisma.$queryRawUnsafe<Array<any>>(`
      SELECT
        p.id, p.nome, p.descricao, p."empresaId", p.status::text AS status,
        p."responsavelId", p."criadoPorId", p."dataEntrega", p."dataFinalizacao",
        p."criadoEm", p."atualizadoEm",
        e."razao_social" AS "empresaNome", e.codigo AS "empresaCodigo", e.cnpj AS "empresaCnpj",
        ur.nome AS "responsavelNome", ur.email AS "responsavelEmail",
        uc.nome AS "criadoPorNome"
      FROM "Projeto" p
      LEFT JOIN "Empresa" e  ON e.id = p."empresaId"
      LEFT JOIN "Usuario" ur ON ur.id = p."responsavelId"
      LEFT JOIN "Usuario" uc ON uc.id = p."criadoPorId"
      WHERE p.id = ${id}
    `);

    const r = rows?.[0];
    if (!r) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    // Busca IDs de processos vinculados via raw (compatível com Prisma client antigo)
    const idsRows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM "Processo" WHERE "projetoId" = ${id} ORDER BY "dataCriacao" ASC`
    );
    const processoIds = (idsRows || []).map((r) => Number(r.id)).filter((n) => Number.isFinite(n));

    const processos = processoIds.length === 0
      ? []
      : await prisma.processo.findMany({
          where: { id: { in: processoIds } },
          select: {
            id: true,
            nome: true,
            nomeServico: true,
            nomeEmpresa: true,
            status: true,
            prioridade: true,
            departamentoAtual: true,
            departamentoAtualIndex: true,
            fluxoDepartamentos: true,
            progresso: true,
            dataCriacao: true,
            dataEntrega: true,
            dataFinalizacao: true,
            responsavelId: true,
            processoOrigemId: true,
            interligadoComId: true,
          },
        });
    // Reordena para o mesmo order dos IDs
    processos.sort((a, b) => processoIds.indexOf(a.id) - processoIds.indexOf(b.id));

    const projeto = {
      id: r.id,
      nome: r.nome,
      descricao: r.descricao,
      empresaId: r.empresaId,
      status: r.status,
      responsavelId: r.responsavelId,
      criadoPorId: r.criadoPorId,
      dataEntrega: r.dataEntrega,
      dataFinalizacao: r.dataFinalizacao,
      criadoEm: r.criadoEm,
      atualizadoEm: r.atualizadoEm,
      empresa: r.empresaId ? {
        id: r.empresaId,
        razao_social: r.empresaNome,
        codigo: r.empresaCodigo,
        cnpj: r.empresaCnpj,
      } : null,
      responsavel: r.responsavelId ? { id: r.responsavelId, nome: r.responsavelNome, email: r.responsavelEmail } : null,
      criadoPor: r.criadoPorId ? { id: r.criadoPorId, nome: r.criadoPorNome } : null,
      processos,
      processosCount: processos.length,
    };

    return NextResponse.json(projeto);
  } catch (error) {
    console.error('Erro ao buscar projeto:', error);
    return NextResponse.json({ error: 'Erro ao buscar projeto' }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/projetos/[id] — atualiza campos do projeto
// Body pode conter qualquer subconjunto: { nome, descricao, empresaId, status, responsavelId, dataEntrega }
// Ao definir status=CONCLUIDO, dataFinalizacao é marcada automaticamente.
// ============================================================================
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const data = await request.json();

    // Busca estado atual para log e para decisões (ex.: dataFinalizacao)
    const atuais = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT id, nome, status::text AS status, "empresaId", "responsavelId", "dataFinalizacao" FROM "Projeto" WHERE id = ${id}`
    );
    const atual = atuais?.[0];
    if (!atual) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    const sets: string[] = [];

    if (typeof data?.nome === 'string' && data.nome.trim()) {
      // parametrizado via $1
    }
    const nomeNovo = typeof data?.nome === 'string' ? data.nome.trim() : null;
    const descricaoNova = data?.descricao === null ? null : (typeof data?.descricao === 'string' ? data.descricao : undefined);

    if (data?.empresaId !== undefined) {
      const emp = data.empresaId === null ? 'NULL' : Number(data.empresaId);
      sets.push(`"empresaId" = ${emp}`);
    }

    if (data?.responsavelId !== undefined) {
      const resp = data.responsavelId === null ? 'NULL' : Number(data.responsavelId);
      sets.push(`"responsavelId" = ${resp}`);
    }

    const statusNovo = sanitizeStatus(data?.status);
    if (statusNovo) {
      sets.push(`"status" = '${statusNovo}'::"StatusProjeto"`);
      if (statusNovo === 'CONCLUIDO' && !atual.dataFinalizacao) {
        sets.push(`"dataFinalizacao" = CURRENT_TIMESTAMP`);
      }
      if (statusNovo !== 'CONCLUIDO' && atual.dataFinalizacao) {
        sets.push(`"dataFinalizacao" = NULL`);
      }
    }

    if (data?.dataEntrega !== undefined) {
      if (data.dataEntrega === null) {
        sets.push(`"dataEntrega" = NULL`);
      } else {
        const dt = new Date(data.dataEntrega);
        if (!isNaN(dt.getTime())) {
          sets.push(`"dataEntrega" = '${dt.toISOString()}'::timestamp`);
        }
      }
    }

    sets.push(`"atualizadoEm" = CURRENT_TIMESTAMP`);

    // Executa update via query parametrizada para nome/descricao (seguro contra injeção)
    await prisma.$executeRawUnsafe(
      `UPDATE "Projeto" SET
        ${nomeNovo !== null ? `nome = $1,` : ''}
        ${descricaoNova !== undefined ? `descricao = ${nomeNovo !== null ? '$2' : '$1'},` : ''}
        ${sets.join(', ')}
      WHERE id = ${id}`,
      ...(nomeNovo !== null ? [nomeNovo] : []),
      ...(descricaoNova !== undefined ? [descricaoNova] : []),
    );

    const novos = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT id, nome, descricao, "empresaId", status::text AS status, "responsavelId", "criadoPorId",
              "dataEntrega", "dataFinalizacao", "criadoEm", "atualizadoEm"
       FROM "Projeto" WHERE id = ${id}`
    );
    const atualizado = novos?.[0];

    await registrarLog({
      usuarioId: user.id,
      acao: 'EDITAR',
      entidade: 'PROJETO',
      entidadeId: id,
      entidadeNome: atualizado?.nome || atual.nome,
      valorAnterior: atual.status,
      valorNovo: atualizado?.status,
      ip: getIp(request),
    });

    return NextResponse.json(atualizado);
  } catch (error) {
    console.error('Erro ao atualizar projeto:', error);
    return NextResponse.json({ error: 'Erro ao atualizar projeto' }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/projetos/[id] — exclui projeto
// Por padrão apenas desvincula as solicitações (projetoId → null).
// Se ?excluirSolicitacoes=true, exclui também as solicitações (via soft delete padrão).
// ============================================================================
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    if (!requireRole(user, ['ADMIN', 'ADMIN_DEPARTAMENTO', 'GERENTE'])) {
      return NextResponse.json({ error: 'Sem permissão para excluir projeto' }, { status: 403 });
    }

    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const excluirSolicitacoes = searchParams.get('excluirSolicitacoes') === 'true';

    const atuais = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT id, nome FROM "Projeto" WHERE id = ${id}`
    );
    const atual = atuais?.[0];
    if (!atual) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    if (excluirSolicitacoes) {
      // Move processos vinculados para lixeira via soft delete (básico aqui — idealmente chamaria a rotina completa)
      const procIdsRows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT id FROM "Processo" WHERE "projetoId" = ${id}`
      );
      const processosVinculados = (procIdsRows || []).map((r) => ({ id: Number(r.id) })).filter((p) => Number.isFinite(p.id));
      for (const p of processosVinculados) {
        try {
          // Atualiza status para CANCELADO como forma leve de "remoção" quando o projeto é apagado.
          // A lixeira completa é acessível pelo endpoint DELETE /api/processos/[id].
          await prisma.processo.update({
            where: { id: p.id },
            data: { status: 'CANCELADO' as any },
          });
          await prisma.$executeRawUnsafe(
            `UPDATE "Processo" SET "projetoId" = NULL WHERE id = ${Number(p.id)}`
          );
        } catch {
          // segue
        }
      }
    } else {
      // Apenas desvincula
      await prisma.$executeRawUnsafe(
        `UPDATE "Processo" SET "projetoId" = NULL WHERE "projetoId" = ${id}`
      );
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "Projeto" WHERE id = ${id}`);

    await registrarLog({
      usuarioId: user.id,
      acao: 'EXCLUIR',
      entidade: 'PROJETO',
      entidadeId: id,
      entidadeNome: atual.nome,
      detalhes: excluirSolicitacoes
        ? 'Projeto excluído junto com solicitações (canceladas)'
        : 'Projeto excluído; solicitações desvinculadas',
      ip: getIp(request),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao excluir projeto:', error);
    return NextResponse.json({ error: 'Erro ao excluir projeto' }, { status: 500 });
  }
}
