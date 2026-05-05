-- =============================================================
-- SEED: Ghost Admin (usuário invisível para debug/dev)
-- Execute este SQL no Supabase SQL Editor
-- =============================================================

INSERT INTO "Usuario" (
  "externalId",
  "nome",
  "email",
  "senha",
  "role",
  "ativo",
  "isGhost",
  "require2FA",
  "permissoes",
  "criadoEm"
) VALUES (
  'bdf74a16-ef7e-477e-ab81-ae3a25b41375',
  'Sistema',
  'ghost@triar.system',
  '$2a$10$srJDHlN4bjMmjIQblRjbgedp9ncl8co75vDbTlWpaVvMIpkm7riH.',
  'ADMIN',
  true,
  true,
  false,
  '{}',
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "externalId" = EXCLUDED."externalId",
  "nome" = EXCLUDED."nome",
  "isGhost" = true,
  "ativo" = true,
  "role" = 'ADMIN',
  "require2FA" = false,
  "senha" = EXCLUDED."senha";
