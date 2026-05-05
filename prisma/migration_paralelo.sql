-- ============================================
-- MIGRAÇÃO: Departamentos Paralelos + Interligação + Auditoria
-- Execute este SQL no Supabase SQL Editor
-- https://supabase.com/dashboard → SQL Editor → New Query
-- ============================================

-- 1. ADICIONAR COLUNAS NA TABELA Processo (se não existirem)
DO $$
BEGIN
  -- Coluna deptIndependente (CRÍTICA para departamentos paralelos)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Processo' AND column_name = 'deptIndependente'
  ) THEN
    ALTER TABLE "Processo" ADD COLUMN "deptIndependente" BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Coluna deptIndependente adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna deptIndependente já existe.';
  END IF;

  -- Coluna interligadoComId
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Processo' AND column_name = 'interligadoComId'
  ) THEN
    ALTER TABLE "Processo" ADD COLUMN "interligadoComId" INTEGER;
    RAISE NOTICE 'Coluna interligadoComId adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna interligadoComId já existe.';
  END IF;

  -- Coluna interligadoNome
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Processo' AND column_name = 'interligadoNome'
  ) THEN
    ALTER TABLE "Processo" ADD COLUMN "interligadoNome" TEXT;
    RAISE NOTICE 'Coluna interligadoNome adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna interligadoNome já existe.';
  END IF;

  -- Coluna interligadoParalelo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Processo' AND column_name = 'interligadoParalelo'
  ) THEN
    ALTER TABLE "Processo" ADD COLUMN "interligadoParalelo" BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Coluna interligadoParalelo adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna interligadoParalelo já existe.';
  END IF;

  -- Coluna responsavelId (se não existir)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Processo' AND column_name = 'responsavelId'
  ) THEN
    ALTER TABLE "Processo" ADD COLUMN "responsavelId" INTEGER;
    RAISE NOTICE 'Coluna responsavelId adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna responsavelId já existe.';
  END IF;
END $$;

-- 2. CRIAR ENUM TipoAcaoLog (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoAcaoLog') THEN
    CREATE TYPE "TipoAcaoLog" AS ENUM (
      'CRIAR', 'EDITAR', 'EXCLUIR', 'VISUALIZAR', 'AVANCAR', 'VOLTAR',
      'FINALIZAR', 'PREENCHER', 'COMENTAR', 'ANEXAR', 'TAG', 'TRANSFERIR',
      'INTERLIGAR', 'CHECK', 'LOGIN', 'LOGOUT', 'IMPORTAR'
    );
    RAISE NOTICE 'Enum TipoAcaoLog criado com sucesso!';
  ELSE
    RAISE NOTICE 'Enum TipoAcaoLog já existe.';
  END IF;
END $$;

-- 3. CRIAR TABELA LogAuditoria (se não existir)
CREATE TABLE IF NOT EXISTS "LogAuditoria" (
  "id" SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL,
  "acao" "TipoAcaoLog" NOT NULL,
  "entidade" TEXT NOT NULL,
  "entidadeId" INTEGER,
  "entidadeNome" TEXT,
  "campo" TEXT,
  "valorAnterior" TEXT,
  "valorNovo" TEXT,
  "detalhes" TEXT,
  "processoId" INTEGER,
  "empresaId" INTEGER,
  "departamentoId" INTEGER,
  "ip" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "LogAuditoria_usuarioId_idx" ON "LogAuditoria"("usuarioId");
CREATE INDEX IF NOT EXISTS "LogAuditoria_entidade_idx" ON "LogAuditoria"("entidade");
CREATE INDEX IF NOT EXISTS "LogAuditoria_processoId_idx" ON "LogAuditoria"("processoId");
CREATE INDEX IF NOT EXISTS "LogAuditoria_empresaId_idx" ON "LogAuditoria"("empresaId");
CREATE INDEX IF NOT EXISTS "LogAuditoria_criadoEm_idx" ON "LogAuditoria"("criadoEm");
CREATE INDEX IF NOT EXISTS "LogAuditoria_acao_idx" ON "LogAuditoria"("acao");

-- 4. CRIAR TABELA InterligacaoProcesso (se não existir)
CREATE TABLE IF NOT EXISTS "InterligacaoProcesso" (
  "id" SERIAL PRIMARY KEY,
  "processoOrigemId" INTEGER NOT NULL,
  "processoDestinoId" INTEGER NOT NULL,
  "criadoPorId" INTEGER NOT NULL,
  "automatica" BOOLEAN NOT NULL DEFAULT false,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("processoOrigemId", "processoDestinoId")
);

CREATE INDEX IF NOT EXISTS "InterligacaoProcesso_processoOrigemId_idx" ON "InterligacaoProcesso"("processoOrigemId");
CREATE INDEX IF NOT EXISTS "InterligacaoProcesso_processoDestinoId_idx" ON "InterligacaoProcesso"("processoDestinoId");

-- 5. CRIAR TABELA ChecklistDepartamento (CRÍTICA para departamentos paralelos)
CREATE TABLE IF NOT EXISTS "ChecklistDepartamento" (
  "id" SERIAL PRIMARY KEY,
  "processoId" INTEGER NOT NULL,
  "departamentoId" INTEGER NOT NULL,
  "concluido" BOOLEAN NOT NULL DEFAULT false,
  "concluidoPorId" INTEGER,
  "concluidoEm" TIMESTAMP(3),
  UNIQUE ("processoId", "departamentoId")
);

CREATE INDEX IF NOT EXISTS "ChecklistDepartamento_processoId_idx" ON "ChecklistDepartamento"("processoId");
CREATE INDEX IF NOT EXISTS "ChecklistDepartamento_departamentoId_idx" ON "ChecklistDepartamento"("departamentoId");

-- 6. CRIAR TABELA MotivoExclusao (se não existir)
CREATE TABLE IF NOT EXISTS "MotivoExclusao" (
  "id" SERIAL PRIMARY KEY,
  "nome" TEXT NOT NULL UNIQUE,
  "padrao" BOOLEAN NOT NULL DEFAULT false,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. INSERIR MOTIVOS DE EXCLUSÃO PADRÃO
INSERT INTO "MotivoExclusao" ("nome", "padrao") VALUES
  ('Solicitação duplicada', true),
  ('Dados inválidos ou incorretos', true),
  ('Cliente desistiu do serviço', true),
  ('Erro na criação da solicitação', true),
  ('Outro motivo', true)
ON CONFLICT ("nome") DO NOTHING;

-- 8. VERIFICAÇÃO: Confirmar que as colunas existem
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'Processo'
  AND column_name IN ('deptIndependente', 'interligadoComId', 'interligadoNome', 'responsavelId')
ORDER BY column_name;

-- FIM DA MIGRAÇÃO
-- Após executar, reinicie o servidor: npm run dev
