-- ============================================================
-- LIMPEZA DE LogAuditoria com mais de 90 dias
-- ------------------------------------------------------------
-- Objetivo: reduzir o tamanho do banco no plano free do Supabase.
-- Mantém os logs dos últimos 90 dias (3 meses), apaga o resto.
--
-- IMPORTANTE: NÃO mexe na tabela HistoricoEvento, que é o histórico
-- visível dentro de cada solicitação ("criada por X", "movida de Y pra Z").
-- Só apaga os logs de auditoria globais (LogAuditoria) — usados por admin
-- pra rastrear quem fez o que no sistema.
--
-- Roda no SQL Editor do Supabase (projeto controle-tarefas / SISTEMADOIS).
-- IRREVERSÍVEL — uma vez apagado, não tem como recuperar.
-- ============================================================

-- 1) Conferir antes (rode pra ver quantos vao):
-- select count(*) as logs_pra_apagar from "LogAuditoria" where "criadoEm" < now() - interval '90 days';
-- select count(*) as logs_que_ficam from "LogAuditoria" where "criadoEm" >= now() - interval '90 days';

-- 2) Apagar:
delete from "LogAuditoria" where "criadoEm" < now() - interval '90 days';

-- 3) Recuperar espaço fisico
vacuum analyze "LogAuditoria";
