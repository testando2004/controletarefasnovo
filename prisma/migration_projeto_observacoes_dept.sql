-- =====================================================================
-- Adiciona observações por departamento no Projeto (dossiê)
-- =====================================================================
-- Permite registrar uma anotação curta por (projeto, departamento) — útil
-- para sinalizar pendências como "aguardando contrato social do cliente",
-- "cliente não respondeu", etc., visíveis ao bater o olho no projeto.
--
-- Estrutura JSON: { "<departamentoId>": "texto da observação", ... }
--
-- Execute no Supabase (SQL Editor) antes de usar a funcionalidade.
-- =====================================================================

ALTER TABLE "Projeto"
  ADD COLUMN IF NOT EXISTS "observacoesDepartamentos" JSONB;
