DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'LogAuditoria'
      AND column_name = 'apagado'
  ) THEN
    ALTER TABLE "LogAuditoria"
      ADD COLUMN "apagado" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'LogAuditoria'
      AND column_name = 'apagadoEm'
  ) THEN
    ALTER TABLE "LogAuditoria"
      ADD COLUMN "apagadoEm" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'LogAuditoria'
      AND column_name = 'apagadoPorId'
  ) THEN
    ALTER TABLE "LogAuditoria"
      ADD COLUMN "apagadoPorId" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'LogAuditoria'
      AND column_name = 'apagadoPorNome'
  ) THEN
    ALTER TABLE "LogAuditoria"
      ADD COLUMN "apagadoPorNome" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'LogAuditoria'
      AND column_name = 'apagadoMotivo'
  ) THEN
    ALTER TABLE "LogAuditoria"
      ADD COLUMN "apagadoMotivo" TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "LogAuditoria_apagado_idx"
  ON "LogAuditoria" ("apagado");
