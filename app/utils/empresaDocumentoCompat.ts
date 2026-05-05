import { prisma } from '@/app/utils/prisma';

type ColumnRow = { column_name: string };

const EMPRESA_DOCUMENTO_LEGACY_COLUMNS = new Set([
  'id',
  'empresaId',
  'nome',
  'tipo',
  'descricao',
  'tamanho',
  'url',
  'path',
  'dataUpload',
  'uploadPorId',
  'validadeAte',
  'alertarDiasAntes',
]);

export type EmpresaDocumentoAclSupport = {
  visibility: boolean;
  allowedRoles: boolean;
  allowedUserIds: boolean;
  allowedDepartamentos: boolean;
};

const EMPRESA_DOCUMENTO_BASE_SELECT = {
  id: true,
  empresaId: true,
  nome: true,
  tipo: true,
  descricao: true,
  tamanho: true,
  url: true,
  path: true,
  dataUpload: true,
  uploadPorId: true,
  validadeAte: true,
  alertarDiasAntes: true,
} as const;

let empresaDocumentoColumnsPromise: Promise<Set<string>> | null = null;

export async function getEmpresaDocumentoColumns(): Promise<Set<string>> {
  if (!empresaDocumentoColumnsPromise) {
    empresaDocumentoColumnsPromise = prisma
      .$queryRaw<ColumnRow[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND lower(table_name) = lower('EmpresaDocumento')
      `
      .then((rows) => {
        const columns = new Set(rows.map((row) => String(row.column_name)));
        if (columns.size > 0) return columns;

        console.warn('[EmpresaDocumento] information_schema retornou vazio; usando fallback legado.');
        return new Set(EMPRESA_DOCUMENTO_LEGACY_COLUMNS);
      })
      .catch((error) => {
        console.error('[EmpresaDocumento] Falha ao ler schema:', error);
        return new Set(EMPRESA_DOCUMENTO_LEGACY_COLUMNS);
      });
  }

  return empresaDocumentoColumnsPromise;
}

export function getEmpresaDocumentoAclSupport(columns: Set<string>): EmpresaDocumentoAclSupport {
  return {
    visibility: columns.has('visibility'),
    allowedRoles: columns.has('allowedRoles'),
    allowedUserIds: columns.has('allowedUserIds'),
    allowedDepartamentos: columns.has('allowedDepartamentos'),
  };
}

export function buildEmpresaDocumentoQueryConfig(
  columns: Set<string>,
  extraSelect: Record<string, any> = {}
) {
  const acl = getEmpresaDocumentoAclSupport(columns);
  const select: Record<string, any> = {
    ...EMPRESA_DOCUMENTO_BASE_SELECT,
    ...extraSelect,
  };

  if (acl.visibility) select.visibility = true;
  if (acl.allowedRoles) select.allowedRoles = true;
  if (acl.allowedUserIds) select.allowedUserIds = true;
  if (acl.allowedDepartamentos) select.allowedDepartamentos = true;

  return { select, acl };
}

export async function getEmpresaDocumentoQueryConfig(extraSelect: Record<string, any> = {}) {
  const columns = await getEmpresaDocumentoColumns();
  return buildEmpresaDocumentoQueryConfig(columns, extraSelect);
}

export function hasEmpresaDocumentoAclStorage(acl: EmpresaDocumentoAclSupport): boolean {
  return acl.visibility && acl.allowedRoles && acl.allowedUserIds && acl.allowedDepartamentos;
}

function quoteIdent(name: string) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

export async function createEmpresaDocumentoCompat(
  client: any,
  data: Record<string, any>,
  select?: Record<string, any>,
  preloadedColumns?: Set<string>
) {
  const columns = preloadedColumns ?? await getEmpresaDocumentoColumns();
  const acl = getEmpresaDocumentoAclSupport(columns);

  if (hasEmpresaDocumentoAclStorage(acl)) {
    const created = await client.empresaDocumento.create({
      data,
      ...(select ? { select } : {}),
    });

    return normalizeEmpresaDocumento(created as any, acl);
  }

  const entries = Object.entries(data).filter(([key, value]) => columns.has(key) && value !== undefined);
  if (entries.length === 0) {
    throw new Error('Nenhuma coluna compatível encontrada para inserir EmpresaDocumento');
  }

  const insertColumns = entries.map(([key]) => key);
  const insertValues = entries.map(([, value]) => value);
  const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(', ');

  const returnColumns = select
    ? Object.entries(select)
        .filter(([, value]) => value === true)
        .map(([key]) => key)
        .filter((key) => columns.has(key))
    : ['id'];

  const sql =
    `INSERT INTO "EmpresaDocumento" (${insertColumns.map(quoteIdent).join(', ')}) ` +
    `VALUES (${placeholders}) ` +
    `RETURNING ${returnColumns.map(quoteIdent).join(', ')}`;

  const rows = await client.$queryRawUnsafe(sql, ...insertValues);
  const created = Array.isArray(rows) ? rows[0] : rows;

  return normalizeEmpresaDocumento(created as any, acl);
}

export function normalizeEmpresaDocumento<T extends Record<string, any>>(
  documento: T,
  acl: EmpresaDocumentoAclSupport
) {
  const allowedUserIds = acl.allowedUserIds && Array.isArray((documento as any).allowedUserIds)
    ? (documento as any).allowedUserIds
        .map((value: any) => Number(value))
        .filter((value: number) => Number.isFinite(value))
    : [];

  const allowedDepartamentos = acl.allowedDepartamentos && Array.isArray((documento as any).allowedDepartamentos)
    ? (documento as any).allowedDepartamentos
        .map((value: any) => Number(value))
        .filter((value: number) => Number.isFinite(value))
    : [];

  return {
    ...documento,
    visibility: acl.visibility ? String((documento as any).visibility || 'PUBLIC').toUpperCase() : 'PUBLIC',
    allowedRoles: acl.allowedRoles && Array.isArray((documento as any).allowedRoles)
      ? (documento as any).allowedRoles.map((value: any) => String(value))
      : [],
    allowedUserIds,
    allowedDepartamentos,
  } as T & {
    visibility: string;
    allowedRoles: string[];
    allowedUserIds: number[];
    allowedDepartamentos: number[];
  };
}
