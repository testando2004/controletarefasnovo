-- Log de emails de notificação enviados quando uma solicitação avança de departamento.
-- Usado para evitar reenvio dentro de 24h (spam-control).
-- Execute este SQL no Supabase antes de usar a funcionalidade.

CREATE TABLE IF NOT EXISTS "EmailNotificacaoLog" (
  id SERIAL PRIMARY KEY,
  "processoId" INTEGER NOT NULL,
  "departamentoId" INTEGER NOT NULL,
  "enviadoEm" TIMESTAMP NOT NULL DEFAULT NOW(),
  "destinatarios" TEXT[] NOT NULL DEFAULT '{}'::TEXT[]
);

CREATE INDEX IF NOT EXISTS "EmailNotificacaoLog_processo_dept_data_idx"
  ON "EmailNotificacaoLog" ("processoId", "departamentoId", "enviadoEm" DESC);
