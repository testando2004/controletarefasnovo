-- ============================================
-- Script para criar a tabela de Lixeira
-- Sistema Triar - Soft Delete
-- ============================================

-- Criar enum para tipo de item na lixeira (se não existir)
DO $$ BEGIN
  CREATE TYPE "TipoItemLixeira" AS ENUM ('PROCESSO', 'DOCUMENTO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Criar tabela ItemLixeira
CREATE TABLE IF NOT EXISTS "ItemLixeira" (
  "id" SERIAL PRIMARY KEY,
  
  -- Tipo do item (PROCESSO, DOCUMENTO)
  "tipoItem" "TipoItemLixeira" NOT NULL,
  
  -- ID original do item antes de ser excluído
  "itemIdOriginal" INTEGER NOT NULL,
  
  -- Dados do item serializados em JSON para restauração
  "dadosOriginais" JSONB NOT NULL,
  
  -- Contexto - onde o item estava
  "processoId" INTEGER,
  "empresaId" INTEGER,
  "departamentoId" INTEGER,
  
  -- Informações de visibilidade (para manter permissões)
  "visibility" VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
  "allowedRoles" TEXT[] DEFAULT '{}',
  "allowedUserIds" INTEGER[] DEFAULT '{}',
  
  -- Quem deletou
  "deletadoPorId" INTEGER NOT NULL,
  
  -- Datas
  "deletadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  
  -- Metadados adicionais
  "nomeItem" VARCHAR(500) NOT NULL,
  "descricaoItem" TEXT
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS "ItemLixeira_deletadoEm_idx" ON "ItemLixeira"(deletadoEm);
CREATE INDEX IF NOT EXISTS "ItemLixeira_empresaId_idx" ON "ItemLixeira"("empresaId");
CREATE INDEX IF NOT EXISTS "ItemLixeira_tipoItem_idx" ON "ItemLixeira"("tipoItem");
CREATE INDEX IF NOT EXISTS "ItemLixeira_deletadoPorId_idx" ON "ItemLixeira"("deletadoPorId");
CREATE INDEX IF NOT EXISTS "ItemLixeira_expiraEm_idx" ON "ItemLixeira"("expiraEm");
CREATE INDEX IF NOT EXISTS "ItemLixeira_processoId_idx" ON "ItemLixeira"("processoId");
CREATE INDEX IF NOT EXISTS "ItemLixeira_visibility_idx" ON "ItemLixeira"("visibility");

-- Comentários da tabela
COMMENT ON TABLE "ItemLixeira" IS 'Tabela para armazenar itens deletados (soft delete) com expiração de 15 dias';
COMMENT ON COLUMN "ItemLixeira"."tipoItem" IS 'Tipo do item: PROCESSO ou DOCUMENTO';
COMMENT ON COLUMN "ItemLixeira"."dadosOriginais" IS 'JSON com todos os dados do item para possível restauração';
COMMENT ON COLUMN "ItemLixeira"."visibility" IS 'Nível de visibilidade: PUBLIC, ROLES, USERS';
COMMENT ON COLUMN "ItemLixeira"."expiraEm" IS 'Data em que o item será excluído permanentemente (15 dias após deletadoEm)';

-- ============================================
-- Para executar manualmente a limpeza de itens expirados:
-- DELETE FROM "ItemLixeira" WHERE "expiraEm" < NOW();
-- ============================================
