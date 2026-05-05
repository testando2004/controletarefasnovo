-- Permite que um usuário/gerente pertença a vários departamentos.
-- O "departamentoId" continua sendo o principal (default ao criar solicitação);
-- "departamentosExtras" lista os demais (permissões se somam).
-- Execute este SQL no Supabase antes de usar o novo campo.

ALTER TABLE "Usuario"
  ADD COLUMN IF NOT EXISTS "departamentosExtras" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
