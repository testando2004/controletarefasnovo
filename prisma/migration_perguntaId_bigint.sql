-- Migration: Alterar perguntaId de INTEGER para BIGINT no modelo Documento
-- IDs de sub-perguntas de grupos repetíveis podem exceder o limite de INTEGER (2147483647)
-- pois são gerados como Date.now() (~1.7 * 10^12).

ALTER TABLE "Documento" ALTER COLUMN "perguntaId" TYPE BIGINT;
