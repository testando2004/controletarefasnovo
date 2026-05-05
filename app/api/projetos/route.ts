import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { getIp, registrarLog } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// Garante que o enum e a tabela existem (idempotente).
// Fornece ambiente funcional mesmo antes da migração SQL ser aplicada —
// mas a migração oficial está em prisma/migration_projeto_dossie.sql.
let schemaEnsured = false;
async function ensureProjetoSchema() {
  if (schemaEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusProjeto') THEN
          CREATE TYPE "StatusProjeto" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDO', 'PAUSADO', 'CANCELADO');
        END IF;
      END$$;
    `);
    schemaEnsured = true;
  } catch {
    // Se falhar, deixa passar — a migração SQL deve ter sido aplicada.
  }
}

type ProjetoRow = {
  id: number;
  nome: string;
  descricao: string | null;
  empresaId: number | null;
  status: string;
  responsavelId: number | null;
  criadoPorId: number | null;
  dataEntrega: Date | null;
  dataFinalizacao: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
};

function sanitizeStatus(raw: any): string {
  const s = String(raw || '').toUpperCase();
  if (['EM_ANDAMENTO', 'CONCLUIDO', 'PAUSADO', 'CANCELADO'].includes(s)) return s;
  return 'EM_ANDAMENTO';
}

// ============================================================================
// GET /api/projetos — lista projetos com contagem de processos e empresa
// Query params (opcionais):
//   ?empresaId=123 — filtra por empresa
//   ?status=EM_ANDAMENTO — filtra por status
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    await ensureProjetoSchema();

    const { searchParams } = new URL(request.url);
    const empresaIdParam = searchParams.get('empresaId');
    const statusParam = searchParams.get('status');

    const conds: string[] = [];
    if (empresaIdParam && Number.isFinite(Number(empresaIdParam))) {
      conds.push(`p."empresaId" = ${Number(empresaIdParam)}`);
    }
    if (statusParam) {
      conds.push(`p."status" = '${sanitizeStatus(statusParam)}'::"StatusProjeto"`);
    }
    const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await prisma.$queryRawUnsafe<Array<ProjetoRow & {
      empresaNome: string | null;
      empresaCodigo: string | null;
      responsavelNome: string | null;
      responsavelEmail: string | null;
      criadoPorNome: string | null;
      processosCount: number;
    }>>(`
      SELECT
        p.id, p.nome, p.descricao, p."empresaId", p.status::text AS status,
        p."responsavelId", p."criadoPorId", p."dataEntrega", p."dataFinalizacao",
        p."criadoEm", p."atualizadoEm",
        e."razao_social" AS "empresaNome", e.codigo AS "empresaCodigo",
        ur.nome AS "responsavelNome", ur.email AS "responsavelEmail",
        uc.nome AS "criadoPorNome",
        (SELECT COUNT(*)::int FROM "Processo" pr WHERE pr."projetoId" = p.id) AS "processosCount"
      FROM "Projeto" p
      LEFT JOIN "Empresa" e  ON e.id = p."empresaId"
      LEFT JOIN "Usuario" ur ON ur.id = p."responsavelId"
      LEFT JOIN "Usuario" uc ON uc.id = p."criadoPorId"
      ${whereClause}
      ORDER BY p."criadoEm" DESC
    `);

    const projetos = (rows || []).map((r) => ({
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
      empresa: r.empresaId ? { id: r.empresaId, razao_social: r.empresaNome, codigo: r.empresaCodigo } : null,
      responsavel: r.responsavelId ? { id: r.responsavelId, nome: r.responsavelNome, email: r.responsavelEmail } : null,
      criadoPor: r.criadoPorId ? { id: r.criadoPorId, nome: r.criadoPorNome } : null,
      processosCount: Number(r.processosCount) || 0,
    }));

    return NextResponse.json(projetos);
  } catch (error) {
    console.error('Erro ao listar projetos:', error);
    return NextResponse.json({ error: 'Erro ao listar projetos' }, { status: 500 });
  }
}

// ============================================================================
// POST /api/projetos — cria um projeto
// Body: { nome, descricao?, empresaId?, status?, responsavelId?, dataEntrega? }
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    await ensureProjetoSchema();

    const data = await request.json();

    const nome = String(data?.nome ?? '').trim();
    if (!nome) {
      return NextResponse.json({ error: 'Nome do projeto é obrigatório' }, { status: 400 });
    }

    const descricao = data?.descricao ? String(data.descricao) : null;
    const empresaId = Number.isFinite(Number(data?.empresaId)) && Number(data.empresaId) > 0
      ? Number(data.empresaId)
      : null;
    const responsavelId = Number.isFinite(Number(data?.responsavelId)) && Number(data.responsavelId) > 0
      ? Number(data.responsavelId)
      : null;
    const status = sanitizeStatus(data?.status);
    const dataEntrega = data?.dataEntrega ? new Date(data.dataEntrega) : null;

    const rows = await prisma.$queryRawUnsafe<ProjetoRow[]>(`
      INSERT INTO "Projeto" ("nome", "descricao", "empresaId", "status", "responsavelId", "criadoPorId", "dataEntrega", "atualizadoEm")
      VALUES (
        $1, $2,
        ${empresaId === null ? 'NULL' : Number(empresaId)},
        '${status}'::"StatusProjeto",
        ${responsavelId === null ? 'NULL' : Number(responsavelId)},
        ${Number(user.id)},
        ${dataEntrega ? `'${dataEntrega.toISOString()}'::timestamp` : 'NULL'},
        CURRENT_TIMESTAMP
      )
      RETURNING id, nome, descricao, "empresaId", status::text AS status, "responsavelId",
                "criadoPorId", "dataEntrega", "dataFinalizacao", "criadoEm", "atualizadoEm"
    `, nome, descricao);

    const criado = rows?.[0];
    if (!criado) {
      return NextResponse.json({ error: 'Falha ao criar projeto' }, { status: 500 });
    }

    await registrarLog({
      usuarioId: user.id,
      acao: 'CRIAR',
      entidade: 'PROJETO',
      entidadeId: criado.id,
      entidadeNome: criado.nome,
      empresaId: criado.empresaId ?? undefined,
      ip: getIp(request),
    });

    return NextResponse.json(criado, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    return NextResponse.json({ error: 'Erro ao criar projeto' }, { status: 500 });
  }
}
