-- Adiciona campo "etapa" ao QuestionarioDepartamento para suportar
-- o mesmo departamento aparecendo múltiplas vezes no fluxo, com perguntas próprias em cada etapa.
-- 1 = primeira aparição do dept no fluxo (valor padrão, retrocompatível)
-- 2+ = aparições subsequentes (ex.: CADASTRO → FINANCEIRO → CADASTRO[etapa=2])
-- Execute este SQL no banco (Supabase/Postgres) antes de usar o novo campo.

ALTER TABLE "QuestionarioDepartamento"
  ADD COLUMN IF NOT EXISTS "etapa" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "QuestionarioDepartamento_processoId_departamentoId_etapa_idx"
  ON "QuestionarioDepartamento" ("processoId", "departamentoId", "etapa");
