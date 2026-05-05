-- FASE 3 — DEPENDÊNCIAS ENTRE DEPARTAMENTOS DA MESMA SOLICITAÇÃO
-- Adiciona campo "dependenciasDept" em Template e Processo.
-- Estrutura: JSON objeto no formato { "chaveEtapa": ["chaveEtapaDeQueDepende", ...] }
-- chaveEtapa = "deptId" (1ª ocorrência do dept) ou "deptId:ocorrencia" (2ª+).
-- Só faz efeito em solicitações com deptIndependente=true.
-- Ex.: { "8": [], "12": ["8"] } → RH (id 8) livre; FISCAL (id 12) só libera depois de RH.
-- Execute este SQL no Supabase antes de usar a funcionalidade.

ALTER TABLE "Template"
  ADD COLUMN IF NOT EXISTS "dependenciasDept" JSONB DEFAULT '{}'::jsonb;

ALTER TABLE "Processo"
  ADD COLUMN IF NOT EXISTS "dependenciasDept" JSONB DEFAULT '{}'::jsonb;
