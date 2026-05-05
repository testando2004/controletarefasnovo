import { prisma } from '@/app/utils/prisma';
import { GHOST_USER_EMAIL } from './constants';
import { ensureLogAuditoriaSoftDeleteSchema } from './logAuditoriaSchema';

// Cache de IDs de ghost users para evitar queries repetidas
let ghostUserIdsCache: Set<number> | null = null;
let ghostCacheTime = 0;

async function getGhostUserIds(): Promise<Set<number>> {
  // Cache por 5 minutos
  if (ghostUserIdsCache && Date.now() - ghostCacheTime < 300_000) return ghostUserIdsCache;
  try {
    const ghosts = await prisma.usuario.findMany({
      where: { OR: [{ isGhost: true }, { email: GHOST_USER_EMAIL }] },
      select: { id: true },
    });
    ghostUserIdsCache = new Set(ghosts.map(g => g.id));
    ghostCacheTime = Date.now();
  } catch {
    ghostUserIdsCache = new Set();
  }
  return ghostUserIdsCache;
}

/**
 * Registra um log de auditoria global no banco de dados.
 * Chamado direto nos API routes (server-side) – não depende de fetch/HTTP.
 * Falha silenciosamente se a tabela ainda não existir.
 * NÃO registra ações do ghost user.
 */
export async function registrarLog(opts: {
  usuarioId: number;
  acao: string;       // TipoAcaoLog: CRIAR, EDITAR, EXCLUIR, VISUALIZAR, AVANCAR, VOLTAR, FINALIZAR, PREENCHER, COMENTAR, ANEXAR, TAG, TRANSFERIR, INTERLIGAR, CHECK, LOGIN, LOGOUT, IMPORTAR
  entidade: string;   // ex: 'PROCESSO', 'EMPRESA', 'DEPARTAMENTO', 'USUARIO', 'TAG', 'TEMPLATE', 'COMENTARIO', 'DOCUMENTO', 'CALENDARIO', 'QUESTIONARIO'
  entidadeId?: number | null;
  entidadeNome?: string | null;
  campo?: string | null;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  detalhes?: string | null;
  processoId?: number | null;
  empresaId?: number | null;
  departamentoId?: number | null;
  ip?: string | null;
}) {
  try {
    await ensureLogAuditoriaSoftDeleteSchema();

    // Ghost user: não registrar logs
    const ghosts = await getGhostUserIds();
    if (ghosts.has(opts.usuarioId)) return;

    await (prisma as any).logAuditoria.create({
      data: {
        usuarioId: opts.usuarioId,
        acao: opts.acao,
        entidade: opts.entidade,
        entidadeId: opts.entidadeId ?? null,
        entidadeNome: opts.entidadeNome ?? null,
        campo: opts.campo ?? null,
        valorAnterior: opts.valorAnterior != null ? String(opts.valorAnterior) : null,
        valorNovo: opts.valorNovo != null ? String(opts.valorNovo) : null,
        detalhes: opts.detalhes ?? null,
        processoId: opts.processoId ?? null,
        empresaId: opts.empresaId ?? null,
        departamentoId: opts.departamentoId ?? null,
        ip: opts.ip ?? null,
      },
    });
  } catch (e: any) {
    // Silencioso se tabela não existir ainda
    if (e?.code === 'P2021' || e?.message?.includes('does not exist')) return;
    console.error('[AuditLog] Falha ao registrar:', e?.message);
  }
}

function normalizeAuditValue(value: any): any {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((item) => normalizeAuditValue(item));
  if (value && typeof value === 'object') {
    const normalized: Record<string, any> = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key] = normalizeAuditValue(value[key]);
    }
    return normalized;
  }
  return value;
}

export function serializarValorAuditoria(value: any): string {
  const normalized = normalizeAuditValue(value);
  if (normalized === null) return '';
  return typeof normalized === 'string' ? normalized : JSON.stringify(normalized);
}

export async function registrarLogsCampos(opts: {
  usuarioId: number;
  acao: string;
  entidade: string;
  entidadeId?: number | null;
  entidadeNome?: string | null;
  processoId?: number | null;
  empresaId?: number | null;
  departamentoId?: number | null;
  ip?: string | null;
  campos: Array<{
    campo: string;
    valorAnterior?: any;
    valorNovo?: any;
    detalhes?: string | null;
  }>;
}) {
  for (const campo of opts.campos) {
    const valorAnterior = serializarValorAuditoria(campo.valorAnterior);
    const valorNovo = serializarValorAuditoria(campo.valorNovo);
    if (valorAnterior === valorNovo && !campo.detalhes) continue;

    await registrarLog({
      usuarioId: opts.usuarioId,
      acao: opts.acao,
      entidade: opts.entidade,
      entidadeId: opts.entidadeId ?? null,
      entidadeNome: opts.entidadeNome ?? null,
      campo: campo.campo,
      valorAnterior: valorAnterior || null,
      valorNovo: valorNovo || null,
      detalhes: campo.detalhes ?? null,
      processoId: opts.processoId ?? null,
      empresaId: opts.empresaId ?? null,
      departamentoId: opts.departamentoId ?? null,
      ip: opts.ip ?? null,
    });
  }
}

/**
 * Helper: compara dois objetos e retorna os campos que mudaram.
 * Útil para registrar cada campo editado individualmente.
 */
export function detectarMudancas(
  antes: Record<string, any>,
  depois: Record<string, any>,
  camposParaIgnorar: string[] = ['atualizadoEm', 'atualizado_em', 'dataAtualizacao', 'updatedAt']
): { campo: string; valorAnterior: string; valorNovo: string }[] {
  const mudancas: { campo: string; valorAnterior: string; valorNovo: string }[] = [];
  const todosOsCampos = new Set([...Object.keys(antes), ...Object.keys(depois)]);

  for (const campo of todosOsCampos) {
    if (camposParaIgnorar.includes(campo)) continue;
    const a = antes[campo];
    const d = depois[campo];
    const aStr = serializarValorAuditoria(a);
    const dStr = serializarValorAuditoria(d);
    if (aStr !== dStr) {
      mudancas.push({ campo, valorAnterior: aStr, valorNovo: dStr });
    }
  }

  return mudancas;
}

/** Extrai IP do request */
export function getIp(request: { headers: { get(name: string): string | null } }): string | null {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
}
