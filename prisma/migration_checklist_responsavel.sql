-- ============================================
-- MIGRACAO: Adicionar responsavel por departamento no ChecklistDepartamento
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Adicionar colunas responsavelId e responsavelNome na tabela ChecklistDepartamento
DO $$
BEGIN
  -- Coluna responsavelId (gerente/responsavel do departamento no momento da criacao)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ChecklistDepartamento' AND column_name = 'responsavelId'
  ) THEN
    ALTER TABLE "ChecklistDepartamento" ADD COLUMN "responsavelId" INTEGER;
    RAISE NOTICE 'Coluna responsavelId adicionada em ChecklistDepartamento!';
  ELSE
    RAISE NOTICE 'Coluna responsavelId ja existe em ChecklistDepartamento.';
  END IF;

  -- Coluna responsavelNome (nome do responsavel para exibicao rapida)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ChecklistDepartamento' AND column_name = 'responsavelNome'
  ) THEN
    ALTER TABLE "ChecklistDepartamento" ADD COLUMN "responsavelNome" TEXT;
    RAISE NOTICE 'Coluna responsavelNome adicionada em ChecklistDepartamento!';
  ELSE
    RAISE NOTICE 'Coluna responsavelNome ja existe em ChecklistDepartamento.';
  END IF;
END $$;

-- Preencher responsavelNome para registros existentes usando o campo responsavel do Departamento
UPDATE "ChecklistDepartamento" cl
SET "responsavelNome" = d."responsavel"
FROM "Departamento" d
WHERE cl."departamentoId" = d."id"
  AND cl."responsavelNome" IS NULL
  AND d."responsavel" IS NOT NULL;

-- Preencher responsavelId para registros existentes usando o gerente ativo do departamento
UPDATE "ChecklistDepartamento" cl
SET "responsavelId" = sub."gerenteId"
FROM (
  SELECT DISTINCT ON (u."departamentoId")
    u."departamentoId",
    u."id" AS "gerenteId"
  FROM "Usuario" u
  WHERE u."role" = 'GERENTE'
    AND u."ativo" = true
    AND u."departamentoId" IS NOT NULL
  ORDER BY u."departamentoId", u."id"
) sub
WHERE cl."departamentoId" = sub."departamentoId"
  AND cl."responsavelId" IS NULL;

-- Verificacao
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'ChecklistDepartamento'
  AND column_name IN ('responsavelId', 'responsavelNome')
ORDER BY column_name;

-- FIM DA MIGRACAO
