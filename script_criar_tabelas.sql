-- ============================================
-- SCRIPT SQL PARA CRIAÇÃO DAS TABELAS
-- Sistema de Abertura de Empresas
-- PostgreSQL / Supabase
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- ou via cliente PostgreSQL
-- ============================================

-- ============================================
-- 1. CRIAR ENUMS
-- ============================================

CREATE TYPE "Role" AS ENUM ('ADMIN', 'GERENTE', 'USUARIO');

CREATE TYPE "Status" AS ENUM ('EM_ANDAMENTO', 'FINALIZADO', 'PAUSADO', 'CANCELADO', 'RASCUNHO');

CREATE TYPE "Prioridade" AS ENUM ('ALTA', 'MEDIA', 'BAIXA');

CREATE TYPE "TipoCampo" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'FILE', 'PHONE', 'EMAIL');

CREATE TYPE "TipoEvento" AS ENUM ('INICIO', 'ALTERACAO', 'MOVIMENTACAO', 'CONCLUSAO', 'FINALIZACAO', 'DOCUMENTO', 'COMENTARIO');

CREATE TYPE "TipoNotificacao" AS ENUM ('SUCESSO', 'ERRO', 'INFO', 'AVISO');

-- ============================================
-- 2. CRIAR TABELAS
-- ============================================

-- TABELA: Usuario
CREATE TABLE "Usuario" (
    "id" SERIAL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "senha" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USUARIO',
    "departamentoId" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "permissoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABELA: Departamento
CREATE TABLE "Departamento" (
    "id" SERIAL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavel" TEXT,
    "cor" TEXT NOT NULL DEFAULT 'from-cyan-500 to-blue-600',
    "icone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABELA: Empresa
CREATE TABLE "Empresa" (
    "id" SERIAL PRIMARY KEY,
    "cnpj" TEXT UNIQUE,
    "codigo" TEXT NOT NULL UNIQUE,
    "razao_social" TEXT NOT NULL,
    "apelido" TEXT,
    "inscricao_estadual" TEXT,
    "inscricao_municipal" TEXT,
    "regime_federal" TEXT,
    "regime_estadual" TEXT,
    "regime_municipal" TEXT,
    "data_abertura" TIMESTAMP(3),
    "estado" TEXT,
    "cidade" TEXT,
    "bairro" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "cep" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "cadastrada" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABELA: Processo
CREATE TABLE "Processo" (
    "id" SERIAL PRIMARY KEY,
    "nome" TEXT,
    "nomeServico" TEXT,
    "nomeEmpresa" TEXT NOT NULL,
    "cliente" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "empresaId" INTEGER,
    "status" "Status" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "prioridade" "Prioridade" NOT NULL DEFAULT 'MEDIA',
    "departamentoAtual" INTEGER NOT NULL,
    "departamentoAtualIndex" INTEGER NOT NULL DEFAULT 0,
    "fluxoDepartamentos" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "descricao" TEXT,
    "notasCriador" TEXT,
    "criadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataAtualizacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataInicio" TIMESTAMP(3),
    "dataEntrega" TIMESTAMP(3),
    "dataFinalizacao" TIMESTAMP(3),
    "progresso" INTEGER NOT NULL DEFAULT 0
);

-- TABELA: Tag
CREATE TABLE "Tag" (
    "id" SERIAL PRIMARY KEY,
    "nome" TEXT NOT NULL UNIQUE,
    "cor" TEXT NOT NULL DEFAULT 'bg-blue-500',
    "texto" TEXT NOT NULL DEFAULT 'text-white',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABELA: ProcessoTag
CREATE TABLE "ProcessoTag" (
    "id" SERIAL PRIMARY KEY,
    "processoId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    UNIQUE("processoId", "tagId")
);

-- TABELA: Comentario
CREATE TABLE "Comentario" (
    "id" SERIAL PRIMARY KEY,
    "processoId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "autorId" INTEGER NOT NULL,
    "departamentoId" INTEGER,
    "mencoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "editado" BOOLEAN NOT NULL DEFAULT false,
    "editadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABELA: Documento
CREATE TABLE "Documento" (
    "id" SERIAL PRIMARY KEY,
    "processoId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tipoCategoria" TEXT,
    "tamanho" BIGINT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT,
    "departamentoId" INTEGER,
    "perguntaId" INTEGER,
    "dataUpload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadPorId" INTEGER
);

-- TABELA: DocumentoObrigatorio
CREATE TABLE "DocumentoObrigatorio" (
    "id" SERIAL PRIMARY KEY,
    "departamentoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true
);

-- TABELA: QuestionarioDepartamento
CREATE TABLE "QuestionarioDepartamento" (
    "id" SERIAL PRIMARY KEY,
    "departamentoId" INTEGER NOT NULL,
    "processoId" INTEGER,
    "label" TEXT NOT NULL,
    "tipo" "TipoCampo" NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "opcoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "placeholder" TEXT,
    "descricao" TEXT,
    "condicaoPerguntaId" INTEGER,
    "condicaoOperador" TEXT,
    "condicaoValor" TEXT
);

-- TABELA: RespostaQuestionario
CREATE TABLE "RespostaQuestionario" (
    "id" SERIAL PRIMARY KEY,
    "processoId" INTEGER NOT NULL,
    "questionarioId" INTEGER NOT NULL,
    "resposta" TEXT NOT NULL,
    "respondidoPorId" INTEGER NOT NULL,
    "respondidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("processoId", "questionarioId")
);

-- TABELA: HistoricoEvento
CREATE TABLE "HistoricoEvento" (
    "id" SERIAL PRIMARY KEY,
    "processoId" INTEGER NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "acao" TEXT NOT NULL,
    "responsavelId" INTEGER,
    "departamento" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataTimestamp" BIGINT NOT NULL
);

-- TABELA: HistoricoFluxo
CREATE TABLE "HistoricoFluxo" (
    "id" SERIAL PRIMARY KEY,
    "processoId" INTEGER NOT NULL,
    "departamentoId" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "entradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saidaEm" TIMESTAMP(3)
);

-- TABELA: Template
CREATE TABLE "Template" (
    "id" SERIAL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "fluxoDepartamentos" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "questionariosPorDepartamento" JSONB NOT NULL,
    "criadoPorId" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABELA: Notificacao
CREATE TABLE "Notificacao" (
    "id" SERIAL PRIMARY KEY,
    "usuarioId" INTEGER NOT NULL,
    "mensagem" TEXT NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL DEFAULT 'INFO',
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "processoId" INTEGER,
    "link" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. CRIAR ÍNDICES
-- ============================================

-- Usuario
CREATE INDEX "Usuario_email_idx" ON "Usuario"("email");
CREATE INDEX "Usuario_role_idx" ON "Usuario"("role");

-- Departamento
CREATE INDEX "Departamento_ativo_ordem_idx" ON "Departamento"("ativo", "ordem");

-- Empresa
CREATE INDEX "Empresa_cnpj_idx" ON "Empresa"("cnpj");
CREATE INDEX "Empresa_codigo_idx" ON "Empresa"("codigo");
CREATE INDEX "Empresa_cadastrada_idx" ON "Empresa"("cadastrada");

-- Processo
CREATE INDEX "Processo_status_idx" ON "Processo"("status");
CREATE INDEX "Processo_departamentoAtual_idx" ON "Processo"("departamentoAtual");
CREATE INDEX "Processo_empresaId_idx" ON "Processo"("empresaId");
CREATE INDEX "Processo_criadoPorId_idx" ON "Processo"("criadoPorId");
CREATE INDEX "Processo_dataCriacao_idx" ON "Processo"("dataCriacao");

-- Tag
CREATE INDEX "Tag_nome_idx" ON "Tag"("nome");

-- ProcessoTag
CREATE INDEX "ProcessoTag_processoId_idx" ON "ProcessoTag"("processoId");
CREATE INDEX "ProcessoTag_tagId_idx" ON "ProcessoTag"("tagId");

-- Comentario
CREATE INDEX "Comentario_processoId_idx" ON "Comentario"("processoId");
CREATE INDEX "Comentario_autorId_idx" ON "Comentario"("autorId");

-- Documento
CREATE INDEX "Documento_processoId_idx" ON "Documento"("processoId");
CREATE INDEX "Documento_departamentoId_idx" ON "Documento"("departamentoId");
CREATE INDEX "Documento_tipo_idx" ON "Documento"("tipo");

-- DocumentoObrigatorio
CREATE INDEX "DocumentoObrigatorio_departamentoId_idx" ON "DocumentoObrigatorio"("departamentoId");

-- QuestionarioDepartamento
CREATE INDEX "QuestionarioDepartamento_departamentoId_idx" ON "QuestionarioDepartamento"("departamentoId");
CREATE INDEX "QuestionarioDepartamento_processoId_idx" ON "QuestionarioDepartamento"("processoId");

-- RespostaQuestionario
CREATE INDEX "RespostaQuestionario_processoId_idx" ON "RespostaQuestionario"("processoId");
CREATE INDEX "RespostaQuestionario_questionarioId_idx" ON "RespostaQuestionario"("questionarioId");

-- HistoricoEvento
CREATE INDEX "HistoricoEvento_processoId_idx" ON "HistoricoEvento"("processoId");
CREATE INDEX "HistoricoEvento_data_idx" ON "HistoricoEvento"("data");
CREATE INDEX "HistoricoEvento_tipo_idx" ON "HistoricoEvento"("tipo");

-- HistoricoFluxo
CREATE INDEX "HistoricoFluxo_processoId_idx" ON "HistoricoFluxo"("processoId");
CREATE INDEX "HistoricoFluxo_departamentoId_idx" ON "HistoricoFluxo"("departamentoId");

-- Template
CREATE INDEX "Template_criadoPorId_idx" ON "Template"("criadoPorId");

-- Notificacao
CREATE INDEX "Notificacao_usuarioId_idx" ON "Notificacao"("usuarioId");
CREATE INDEX "Notificacao_lida_idx" ON "Notificacao"("lida");
CREATE INDEX "Notificacao_criadoEm_idx" ON "Notificacao"("criadoEm");

-- ============================================
-- 4. CRIAR FOREIGN KEYS
-- ============================================

-- Usuario -> Departamento
ALTER TABLE "Usuario" 
ADD CONSTRAINT "Usuario_departamentoId_fkey" 
FOREIGN KEY ("departamentoId") 
REFERENCES "Departamento"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Processo -> Empresa
ALTER TABLE "Processo" 
ADD CONSTRAINT "Processo_empresaId_fkey" 
FOREIGN KEY ("empresaId") 
REFERENCES "Empresa"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Processo -> Usuario (criadoPor)
ALTER TABLE "Processo" 
ADD CONSTRAINT "Processo_criadoPorId_fkey" 
FOREIGN KEY ("criadoPorId") 
REFERENCES "Usuario"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- ProcessoTag -> Processo
ALTER TABLE "ProcessoTag" 
ADD CONSTRAINT "ProcessoTag_processoId_fkey" 
FOREIGN KEY ("processoId") 
REFERENCES "Processo"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- ProcessoTag -> Tag
ALTER TABLE "ProcessoTag" 
ADD CONSTRAINT "ProcessoTag_tagId_fkey" 
FOREIGN KEY ("tagId") 
REFERENCES "Tag"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- Comentario -> Processo
ALTER TABLE "Comentario" 
ADD CONSTRAINT "Comentario_processoId_fkey" 
FOREIGN KEY ("processoId") 
REFERENCES "Processo"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- Comentario -> Usuario (autor)
ALTER TABLE "Comentario" 
ADD CONSTRAINT "Comentario_autorId_fkey" 
FOREIGN KEY ("autorId") 
REFERENCES "Usuario"("id") 
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Comentario -> Departamento
ALTER TABLE "Comentario" 
ADD CONSTRAINT "Comentario_departamentoId_fkey" 
FOREIGN KEY ("departamentoId") 
REFERENCES "Departamento"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Documento -> Processo
ALTER TABLE "Documento" 
ADD CONSTRAINT "Documento_processoId_fkey" 
FOREIGN KEY ("processoId") 
REFERENCES "Processo"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- Documento -> Departamento
ALTER TABLE "Documento" 
ADD CONSTRAINT "Documento_departamentoId_fkey" 
FOREIGN KEY ("departamentoId") 
REFERENCES "Departamento"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- DocumentoObrigatorio -> Departamento
ALTER TABLE "DocumentoObrigatorio" 
ADD CONSTRAINT "DocumentoObrigatorio_departamentoId_fkey" 
FOREIGN KEY ("departamentoId") 
REFERENCES "Departamento"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- QuestionarioDepartamento -> Departamento
ALTER TABLE "QuestionarioDepartamento" 
ADD CONSTRAINT "QuestionarioDepartamento_departamentoId_fkey" 
FOREIGN KEY ("departamentoId") 
REFERENCES "Departamento"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- QuestionarioDepartamento -> Processo
ALTER TABLE "QuestionarioDepartamento" 
ADD CONSTRAINT "QuestionarioDepartamento_processoId_fkey" 
FOREIGN KEY ("processoId") 
REFERENCES "Processo"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- RespostaQuestionario -> Processo
ALTER TABLE "RespostaQuestionario" 
ADD CONSTRAINT "RespostaQuestionario_processoId_fkey" 
FOREIGN KEY ("processoId") 
REFERENCES "Processo"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- RespostaQuestionario -> QuestionarioDepartamento
ALTER TABLE "RespostaQuestionario" 
ADD CONSTRAINT "RespostaQuestionario_questionarioId_fkey" 
FOREIGN KEY ("questionarioId") 
REFERENCES "QuestionarioDepartamento"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- RespostaQuestionario -> Usuario (respondidoPor)
ALTER TABLE "RespostaQuestionario" 
ADD CONSTRAINT "RespostaQuestionario_respondidoPorId_fkey" 
FOREIGN KEY ("respondidoPorId") 
REFERENCES "Usuario"("id") 
ON DELETE RESTRICT ON UPDATE CASCADE;

-- HistoricoEvento -> Processo
ALTER TABLE "HistoricoEvento" 
ADD CONSTRAINT "HistoricoEvento_processoId_fkey" 
FOREIGN KEY ("processoId") 
REFERENCES "Processo"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- HistoricoEvento -> Usuario (responsavel)
ALTER TABLE "HistoricoEvento" 
ADD CONSTRAINT "HistoricoEvento_responsavelId_fkey" 
FOREIGN KEY ("responsavelId") 
REFERENCES "Usuario"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- HistoricoFluxo -> Processo
ALTER TABLE "HistoricoFluxo" 
ADD CONSTRAINT "HistoricoFluxo_processoId_fkey" 
FOREIGN KEY ("processoId") 
REFERENCES "Processo"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- HistoricoFluxo -> Departamento
ALTER TABLE "HistoricoFluxo" 
ADD CONSTRAINT "HistoricoFluxo_departamentoId_fkey" 
FOREIGN KEY ("departamentoId") 
REFERENCES "Departamento"("id") 
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Template -> Usuario (criadoPor)
ALTER TABLE "Template" 
ADD CONSTRAINT "Template_criadoPorId_fkey" 
FOREIGN KEY ("criadoPorId") 
REFERENCES "Usuario"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Notificacao -> Usuario
ALTER TABLE "Notificacao" 
ADD CONSTRAINT "Notificacao_usuarioId_fkey" 
FOREIGN KEY ("usuarioId") 
REFERENCES "Usuario"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- 
-- TABELAS CRIADAS:
-- 1. Usuario
-- 2. Departamento
-- 3. Empresa
-- 4. Processo
-- 5. Tag
-- 6. ProcessoTag
-- 7. Comentario
-- 8. Documento
-- 9. DocumentoObrigatorio
-- 10. QuestionarioDepartamento
-- 11. RespostaQuestionario
-- 12. HistoricoEvento
-- 13. HistoricoFluxo
-- 14. Template
-- 15. Notificacao
-- 
-- ENUMS CRIADOS:
-- - Role
-- - Status
-- - Prioridade
-- - TipoCampo
-- - TipoEvento
-- - TipoNotificacao
-- 
-- Para executar:
-- 1. Copie todo este script
-- 2. Acesse o SQL Editor no Supabase Dashboard
-- 3. Cole e execute (Run)
-- ============================================




