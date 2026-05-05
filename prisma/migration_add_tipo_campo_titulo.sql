-- Adiciona suporte ao tipo TITULO no enum de campos do questionário.
-- O tipo TITULO é usado apenas como cabeçalho/separador visual dentro do questionário
-- (ex: "ENDEREÇO", "DADOS DO RESPONSÁVEL"), sem gerar resposta.
-- Execute este SQL no banco (Supabase/Postgres) antes de usar o novo tipo no sistema.

ALTER TYPE "TipoCampo" ADD VALUE IF NOT EXISTS 'TITULO';
