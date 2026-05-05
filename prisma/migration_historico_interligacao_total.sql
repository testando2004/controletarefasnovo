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

CREATE INDEX IF NOT EXISTS "Processo_processoOrigemId_idx"
  ON "Processo" ("processoOrigemId");
