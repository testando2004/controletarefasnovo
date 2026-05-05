-- =====================================================================
-- FASE 1 — PROJETO (DOSSIÊ DE SOLICITAÇÕES)
-- =====================================================================
-- Cria a entidade "Projeto" para agrupar solicitações relacionadas ao
-- mesmo assunto de uma empresa (ex.: "Abertura da ACME Ltda" engloba
-- CADASTRO → FINANCEIRO → PROCESSOS → Cadastro 2ª revisão → RH, CONTÁBIL, FISCAL).
--
-- Toda solicitação pode opcionalmente pertencer a um Projeto (projetoId).
-- Interligações automáticas herdam o projetoId do processo pai.
--
-- Execute este SQL no Supabase (SQL Editor) antes de usar a funcionalidade.
-- =====================================================================

-- Enum de status do projeto
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusProjeto') THEN
    CREATE TYPE "StatusProjeto" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDO', 'PAUSADO', 'CANCELADO');
  END IF;
END$$;

-- Tabela Projeto
CREATE TABLE IF NOT EXISTS "Projeto" (
  "id"              SERIAL PRIMARY KEY,
  "nome"            TEXT NOT NULL,
  "descricao"       TEXT,
  "empresaId"       INTEGER REFERENCES "Empresa"("id") ON DELETE SET NULL,
  "status"          "StatusProjeto" NOT NULL DEFAULT 'EM_ANDAMENTO',
  "responsavelId"   INTEGER REFERENCES "Usuario"("id") ON DELETE SET NULL,
  "criadoPorId"     INTEGER REFERENCES "Usuario"("id") ON DELETE SET NULL,
  "dataEntrega"     TIMESTAMP(3),
  "dataFinalizacao" TIMESTAMP(3),
  "criadoEm"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Projeto_empresaId_idx"     ON "Projeto" ("empresaId");
CREATE INDEX IF NOT EXISTS "Projeto_status_idx"        ON "Projeto" ("status");
CREATE INDEX IF NOT EXISTS "Projeto_responsavelId_idx" ON "Projeto" ("responsavelId");
CREATE INDEX IF NOT EXISTS "Projeto_criadoPorId_idx"   ON "Projeto" ("criadoPorId");

-- Coluna projetoId em Processo (opcional, solicitações podem não ter projeto)
ALTER TABLE "Processo"
  ADD COLUMN IF NOT EXISTS "projetoId" INTEGER REFERENCES "Projeto"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Processo_projetoId_idx" ON "Processo" ("projetoId");
