-- ================================================
-- TABELA: EventoCalendario
-- Calendário integrado para escritório de contabilidade
-- ================================================

-- Criar enums se não existirem
DO $$ BEGIN
    CREATE TYPE "TipoEventoCalendario" AS ENUM ('PROCESSO_PRAZO', 'SOLICITACAO', 'OBRIGACAO_FISCAL', 'DOCUMENTO_VENCIMENTO', 'REUNIAO', 'LEMBRETE', 'FERIADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Garantir valores do enum (caso o tipo já exista sem algum valor)
ALTER TYPE "TipoEventoCalendario" ADD VALUE IF NOT EXISTS 'PROCESSO_PRAZO';
ALTER TYPE "TipoEventoCalendario" ADD VALUE IF NOT EXISTS 'SOLICITACAO';
ALTER TYPE "TipoEventoCalendario" ADD VALUE IF NOT EXISTS 'OBRIGACAO_FISCAL';
ALTER TYPE "TipoEventoCalendario" ADD VALUE IF NOT EXISTS 'DOCUMENTO_VENCIMENTO';
ALTER TYPE "TipoEventoCalendario" ADD VALUE IF NOT EXISTS 'REUNIAO';
ALTER TYPE "TipoEventoCalendario" ADD VALUE IF NOT EXISTS 'LEMBRETE';
ALTER TYPE "TipoEventoCalendario" ADD VALUE IF NOT EXISTS 'FERIADO';

DO $$ BEGIN
    CREATE TYPE "StatusEventoCalendario" AS ENUM ('PENDENTE', 'CONCLUIDO', 'ATRASADO', 'CANCELADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RecorrenciaEventoCalendario" AS ENUM ('UNICO', 'DIARIO', 'SEMANAL', 'MENSAL', 'ANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Criar tabela EventoCalendario
CREATE TABLE IF NOT EXISTS "EventoCalendario" (
    "id" SERIAL PRIMARY KEY,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoEventoCalendario" NOT NULL DEFAULT 'LEMBRETE',
    "status" "StatusEventoCalendario" NOT NULL DEFAULT 'PENDENTE',
    
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "diaInteiro" BOOLEAN NOT NULL DEFAULT false,
    "cor" VARCHAR(50),
    
    -- Relacionamentos opcionais
    "processoId" INTEGER,
    "empresaId" INTEGER,
    "departamentoId" INTEGER,
    "criadoPorId" INTEGER,
    
    -- Privacidade (true = só o criador vê)
    "privado" BOOLEAN NOT NULL DEFAULT true,
    
    -- Recorrência
    "recorrencia" "RecorrenciaEventoCalendario" NOT NULL DEFAULT 'UNICO',
    "recorrenciaFim" TIMESTAMP(3),
    
    -- Alertas
    "alertaMinutosAntes" INTEGER DEFAULT 60,
    
    -- Timestamps
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS "EventoCalendario_dataInicio_idx" ON "EventoCalendario"("dataInicio");
CREATE INDEX IF NOT EXISTS "EventoCalendario_tipo_idx" ON "EventoCalendario"("tipo");
CREATE INDEX IF NOT EXISTS "EventoCalendario_status_idx" ON "EventoCalendario"("status");
CREATE INDEX IF NOT EXISTS "EventoCalendario_processoId_idx" ON "EventoCalendario"("processoId");
CREATE INDEX IF NOT EXISTS "EventoCalendario_empresaId_idx" ON "EventoCalendario"("empresaId");
CREATE INDEX IF NOT EXISTS "EventoCalendario_departamentoId_idx" ON "EventoCalendario"("departamentoId");
CREATE INDEX IF NOT EXISTS "EventoCalendario_criadoPorId_idx" ON "EventoCalendario"("criadoPorId");

-- Função para atualizar atualizadoEm automaticamente
CREATE OR REPLACE FUNCTION update_evento_calendario_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."atualizadoEm" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar atualizadoEm
DROP TRIGGER IF EXISTS update_evento_calendario_timestamp ON "EventoCalendario";
CREATE TRIGGER update_evento_calendario_timestamp
    BEFORE UPDATE ON "EventoCalendario"
    FOR EACH ROW
    EXECUTE FUNCTION update_evento_calendario_updated_at();

-- Inserir alguns feriados de 2026 como exemplo
INSERT INTO "EventoCalendario" ("titulo", "descricao", "tipo", "status", "dataInicio", "diaInteiro", "cor", "recorrencia")
VALUES 
    ('Confraternização Universal', 'Feriado Nacional', 'FERIADO', 'PENDENTE', '2026-01-01', true, '#9CA3AF', 'ANUAL'),
    ('Carnaval', 'Feriado Nacional', 'FERIADO', 'PENDENTE', '2026-02-16', true, '#9CA3AF', 'UNICO'),
    ('Carnaval', 'Feriado Nacional', 'FERIADO', 'PENDENTE', '2026-02-17', true, '#9CA3AF', 'UNICO'),
    ('Quarta-feira de Cinzas', 'Ponto Facultativo até 14h', 'FERIADO', 'PENDENTE', '2026-02-18', true, '#9CA3AF', 'UNICO'),
    ('Sexta-feira Santa', 'Feriado Nacional', 'FERIADO', 'PENDENTE', '2026-04-03', true, '#9CA3AF', 'UNICO'),
    ('Tiradentes', 'Feriado Nacional', 'FERIADO', 'PENDENTE', '2026-04-21', true, '#9CA3AF', 'ANUAL'),
    ('Dia do Trabalho', 'Feriado Nacional', 'FERIADO', 'PENDENTE', '2026-05-01', true, '#9CA3AF', 'ANUAL'),
    ('Corpus Christi', 'Ponto Facultativo', 'FERIADO', 'PENDENTE', '2026-06-04', true, '#9CA3AF', 'UNICO'),
    ('Independência do Brasil', 'Feriado Nacional', 'FERIADO', 'PENDENTE', '2026-09-07', true, '#9CA3AF', 'ANUAL'),
    ('Nossa Senhora Aparecida', 'Feriado Nacional', 'FERIADO', 'PENDENTE', '2026-10-12', true, '#9CA3AF', 'ANUAL'),
    ('Finados', 'Feriado Nacional', 'FERIADO', 'PENDENTE', '2026-11-02', true, '#9CA3AF', 'ANUAL'),
    ('Proclamação da República', 'Feriado Nacional', 'FERIADO', 'PENDENTE', '2026-11-15', true, '#9CA3AF', 'ANUAL'),
    ('Natal', 'Feriado Nacional', 'FERIADO', 'PENDENTE', '2026-12-25', true, '#9CA3AF', 'ANUAL')
ON CONFLICT DO NOTHING;

-- Verificar se a tabela foi criada
SELECT 'Tabela EventoCalendario criada com sucesso!' as resultado;
SELECT COUNT(*) as total_feriados FROM "EventoCalendario" WHERE tipo = 'FERIADO';
