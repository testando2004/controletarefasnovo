-- ============================================
-- Script para criar a tabela de Favoritos
-- Sistema Triar - Processos Favoritos
-- ============================================

-- Criar tabela ProcessoFavorito
CREATE TABLE IF NOT EXISTS "ProcessoFavorito" (
  "id" SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL,
  "processoId" INTEGER NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  CONSTRAINT "ProcessoFavorito_usuarioId_fkey" 
    FOREIGN KEY ("usuarioId") 
    REFERENCES "Usuario"("id") 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
    
  CONSTRAINT "ProcessoFavorito_processoId_fkey" 
    FOREIGN KEY ("processoId") 
    REFERENCES "Processo"("id") 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
    
  -- Unique constraint - um usuário só pode favoritar um processo uma vez
  CONSTRAINT "ProcessoFavorito_usuarioId_processoId_key" 
    UNIQUE ("usuarioId", "processoId")
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS "ProcessoFavorito_usuarioId_idx" ON "ProcessoFavorito"("usuarioId");
CREATE INDEX IF NOT EXISTS "ProcessoFavorito_processoId_idx" ON "ProcessoFavorito"("processoId");

-- Comentários da tabela
COMMENT ON TABLE "ProcessoFavorito" IS 'Tabela para armazenar processos favoritados pelos usuários';
COMMENT ON COLUMN "ProcessoFavorito"."usuarioId" IS 'ID do usuário que favoritou o processo';
COMMENT ON COLUMN "ProcessoFavorito"."processoId" IS 'ID do processo favoritado';
COMMENT ON COLUMN "ProcessoFavorito"."criadoEm" IS 'Data em que o processo foi favoritado';

