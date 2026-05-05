import { prisma } from '@/app/utils/prisma';

let schemaEnsured = false;

export async function ensureProcessInterligacaoSchema() {
  if (schemaEnsured) return;

  try {
    await prisma.$executeRawUnsafe(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Processo'
      AND column_name = 'processoOrigemId'
  ) THEN
    ALTER TABLE "Processo" ADD COLUMN "processoOrigemId" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Processo'
      AND column_name = 'interligacaoTemplateIds'
  ) THEN
    ALTER TABLE "Processo"
      ADD COLUMN "interligacaoTemplateIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
  END IF;
END $$;
`);

    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "Processo_processoOrigemId_idx"
  ON "Processo" ("processoOrigemId")
`);

    schemaEnsured = true;
  } catch (error) {
    console.warn('Aviso: nao foi possivel garantir schema de interligacao de processos:', error);
  }
}

export function normalizeInterligacaoTemplateIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  const ids = value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);

  return ids.filter((id, index) => ids.indexOf(id) === index);
}
