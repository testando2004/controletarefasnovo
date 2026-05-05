/**
 * Helpers para a cadeia de interligação entre solicitações.
 *
 * Suporta dois formatos (compatíveis):
 *
 *  1) "interligacaoTemplateIds" — fila linear de IDs.
 *     Ex.: [A, B, C] → ao finalizar, cria A; depois B; depois C. Todos sequenciais.
 *
 *  2) "interligacaoGrupos" — blocos com modo:
 *     [{ modo: 'sequencial', templateIds: [A] }, { modo: 'paralelo', templateIds: [B, C, D] }]
 *     → ao finalizar, cria A. Quando A terminar, cria B, C, D de uma vez (paralelo).
 *
 * Se ambos estiverem presentes, "interligacaoGrupos" tem prioridade.
 * Se só há "interligacaoTemplateIds", é convertido em 1 grupo sequencial por ID (retrocompat).
 */

export type GrupoInterligacao = {
  modo: 'sequencial' | 'paralelo';
  templateIds: number[];
};

export type ProximoPasso =
  | { tipo: 'nada' }
  | { tipo: 'um'; templateId: number; grupoRestante: GrupoInterligacao[]; modoAtualEraParalelo: false }
  | { tipo: 'varios'; templateIds: number[]; grupoRestante: GrupoInterligacao[]; modoAtualEraParalelo: true };

/**
 * Normaliza a cadeia: prioriza `grupos` quando houver; senão, converte a fila linear
 * em grupos sequenciais (1 template por grupo).
 */
export function normalizarCadeia(
  interligacaoGrupos?: unknown,
  interligacaoTemplateIds?: unknown
): GrupoInterligacao[] {
  const grupos = parseGrupos(interligacaoGrupos);
  if (grupos.length > 0) return grupos;

  const fila = parseTemplateIds(interligacaoTemplateIds);
  return fila.map<GrupoInterligacao>((id) => ({ modo: 'sequencial', templateIds: [id] }));
}

function parseGrupos(raw: unknown): GrupoInterligacao[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) arr = p;
    } catch {
      // string inválida
    }
  }
  return arr
    .map((g: any): GrupoInterligacao | null => {
      const modo = g?.modo === 'paralelo' ? 'paralelo' : 'sequencial';
      const ids = Array.isArray(g?.templateIds)
        ? g.templateIds.map((x: any) => Number(x)).filter((x: any) => Number.isFinite(x) && x > 0)
        : [];
      if (ids.length === 0) return null;
      return { modo, templateIds: ids };
    })
    .filter((g): g is GrupoInterligacao => g !== null);
}

function parseTemplateIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * Consome o próximo passo da cadeia.
 * - Se o próximo grupo é sequencial → retorna 1 templateId e o "resto" da cadeia.
 * - Se é paralelo → retorna TODOS os templateIds do grupo e o resto.
 */
export function proximoPasso(grupos: GrupoInterligacao[]): ProximoPasso {
  if (grupos.length === 0) return { tipo: 'nada' };

  const [head, ...rest] = grupos;
  if (head.modo === 'sequencial') {
    // Consome 1 id do grupo sequencial. Se sobrarem no mesmo grupo (raro), recompoe.
    const [id, ...resto] = head.templateIds;
    const grupoRestante: GrupoInterligacao[] =
      resto.length > 0
        ? [{ modo: 'sequencial', templateIds: resto }, ...rest]
        : rest;
    return { tipo: 'um', templateId: id, grupoRestante, modoAtualEraParalelo: false };
  }

  // Paralelo: retorna todos de uma vez e passa ao próximo grupo
  return {
    tipo: 'varios',
    templateIds: [...head.templateIds],
    grupoRestante: rest,
    modoAtualEraParalelo: true,
  };
}

/** Achata grupos em uma fila plana (para o campo `interligacaoTemplateIds` legado). */
export function achatarParaFila(grupos: GrupoInterligacao[]): number[] {
  const out: number[] = [];
  for (const g of grupos) out.push(...g.templateIds);
  return out;
}

/** Converte uma fila simples (lista de IDs + "tudo paralelo?") em grupos. */
export function filaParaGrupos(templateIds: number[], tudoParalelo = false): GrupoInterligacao[] {
  const ids = (templateIds || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length === 0) return [];
  if (tudoParalelo) return [{ modo: 'paralelo', templateIds: ids }];
  return ids.map<GrupoInterligacao>((id) => ({ modo: 'sequencial', templateIds: [id] }));
}
