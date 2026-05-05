-- Adiciona cadeia de interligação pré-configurada no Template
-- Quando um processo criado deste template for finalizado,
-- o próximo template da lista é criado automaticamente (cadeia persistente)
-- Execute este SQL no banco (Supabase/Postgres) antes de usar os novos campos.

ALTER TABLE "Template"
  ADD COLUMN IF NOT EXISTS "interligacaoTemplateIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

ALTER TABLE "Template"
  ADD COLUMN IF NOT EXISTS "interligacaoParalelo" BOOLEAN NOT NULL DEFAULT false;
