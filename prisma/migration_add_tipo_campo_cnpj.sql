-- Adiciona suporte ao tipo CNPJ no enum de campos do questionário.
-- Execute este SQL no banco (Supabase/Postgres) antes de usar o novo tipo no sistema.

ALTER TYPE "TipoCampo" ADD VALUE IF NOT EXISTS 'CNPJ';
