-- FASE 2 — RAMIFICAÇÃO PARALELA NA INTERLIGAÇÃO
-- Adiciona campo "interligacaoGrupos" em Template e Processo para suportar
-- cadeias em blocos (sequencial OU paralelo).
-- Formato do JSON: [{ "modo": "sequencial" | "paralelo", "templateIds": [1,2,3] }, ...]
-- Se vazio/null, o sistema usa o campo "interligacaoTemplateIds" (fila linear) como antes.
-- Execute este SQL no Supabase antes de usar a funcionalidade.

ALTER TABLE "Template"
  ADD COLUMN IF NOT EXISTS "interligacaoGrupos" JSONB DEFAULT '[]'::jsonb;

ALTER TABLE "Processo"
  ADD COLUMN IF NOT EXISTS "interligacaoGrupos" JSONB DEFAULT '[]'::jsonb;
