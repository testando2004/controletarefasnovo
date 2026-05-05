import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';
import {
  createEmpresaDocumentoCompat,
  getEmpresaDocumentoColumns,
  getEmpresaDocumentoQueryConfig,
  normalizeEmpresaDocumento,
} from '@/app/utils/empresaDocumentoCompat';
import { ensureLogAuditoriaSoftDeleteSchema } from '@/app/utils/logAuditoriaSchema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sanitizeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') {
    return obj <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(obj) : obj.toString();
  }
  if (Array.isArray(obj)) return obj.map(sanitizeBigInt);
  if (obj instanceof Date) return obj.toISOString();
  if (typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitizeBigInt(v);
    return out;
  }
  return obj;
}

function isSchemaDriftError(error: any): boolean {
  const message = String(error?.message || '');
  return (
    error?.code === 'P2021' ||
    error?.code === 'P2022' ||
    message.includes('does not exist') ||
    message.includes('does not have a column') ||
    message.includes('does not exist in the current database')
  );
}

async function safeFindMany<T>(label: string, query: () => Promise<T[]>): Promise<T[]> {
  try {
    return await query();
  } catch (error: any) {
    if (!isSchemaDriftError(error)) throw error;
    console.warn(`[Backup] Ignorando ${label} por incompatibilidade de schema:`, error?.message || error);
    return [];
  }
}

function buildChecklistDepartamentoQueryConfig(columns: Set<string>) {
  const select: Record<string, any> = {
    id: true,
    processoId: true,
    departamentoId: true,
    concluido: true,
    concluidoPorId: true,
    concluidoEm: true,
  };

  if (columns.has('responsavelId')) select.responsavelId = true;
  if (columns.has('responsavelNome')) select.responsavelNome = true;

  return {
    select,
    hasResponsavelId: columns.has('responsavelId'),
    hasResponsavelNome: columns.has('responsavelNome'),
  };
}

async function getChecklistDepartamentoQueryConfig() {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND lower(table_name) = lower('ChecklistDepartamento')
  `;

  return buildChecklistDepartamentoQueryConfig(new Set(rows.map((row) => String(row.column_name))));
}

function normalizeChecklistDepartamento(item: any, config: { hasResponsavelId: boolean; hasResponsavelNome: boolean }) {
  return {
    ...item,
    responsavelId: config.hasResponsavelId ? item.responsavelId ?? null : null,
    responsavelNome: config.hasResponsavelNome ? item.responsavelNome ?? null : null,
  };
}

// GET /api/backup - Exportar todos os dados do sistema
export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  await ensureLogAuditoriaSoftDeleteSchema();
  if (!requireRole(user, ['ADMIN'])) {
    return NextResponse.json({ error: 'Apenas administradores podem exportar backups' }, { status: 403 });
  }

  try {
    // Fetch logAuditoria separately (table may not exist yet)
    let logsAuditoria: any[] = [];
    try {
      logsAuditoria = await (prisma as any).logAuditoria.findMany({
        orderBy: { criadoEm: 'desc' },
      });
    } catch (e: any) {
      if (e?.code !== 'P2021' && !e?.message?.includes('does not exist')) {
        console.error('[Backup] Erro ao buscar logs de auditoria:', e?.message);
      }
    }

    const [
      usuarios,
      departamentos,
      empresas,
      processos,
      tags,
      processoTags,
      comentarios,
      documentos,
      empresaDocumentos,
      questionarios,
      respostas,
      historicoEventos,
      historicoFluxos,
      templates,
      eventosCalendario,
      interligacoes,
      checklistDepartamento,
      motivosExclusao,
      documentosObrigatorios,
    ] = await Promise.all([
      prisma.usuario.findMany({ select: { id: true, nome: true, email: true, role: true, departamentoId: true, ativo: true, permissoes: true, criadoEm: true } }),
      prisma.departamento.findMany(),
      prisma.empresa.findMany(),
      prisma.processo.findMany(),
      prisma.tag.findMany(),
      prisma.processoTag.findMany(),
      prisma.comentario.findMany(),
      prisma.documento.findMany(),
      safeFindMany('empresaDocumento', async () => {
        const { select, acl } = await getEmpresaDocumentoQueryConfig();
        const docs = await prisma.empresaDocumento.findMany({ select });
        return docs.map((doc) => normalizeEmpresaDocumento(doc as any, acl));
      }),
      prisma.questionarioDepartamento.findMany(),
      prisma.respostaQuestionario.findMany(),
      prisma.historicoEvento.findMany(),
      prisma.historicoFluxo.findMany(),
      prisma.template.findMany(),
      safeFindMany('eventoCalendario', () => prisma.eventoCalendario.findMany()),
      safeFindMany('interligacaoProcesso', () => prisma.interligacaoProcesso.findMany()),
      safeFindMany('checklistDepartamento', async () => {
        const config = await getChecklistDepartamentoQueryConfig();
        const rows = await prisma.checklistDepartamento.findMany({ select: config.select });
        return rows.map((item) => normalizeChecklistDepartamento(item, config));
      }),
      safeFindMany('motivoExclusao', () => prisma.motivoExclusao.findMany()),
      safeFindMany('documentoObrigatorio', () => prisma.documentoObrigatorio.findMany()),
    ]);

    const backup = sanitizeBigInt({
      versao: '1.0',
      sistema: 'SistemaTriar',
      exportadoEm: new Date().toISOString(),
      exportadoPor: (user as any).nome || (user as any).email,
      dados: {
        usuarios,
        departamentos,
        empresas,
        processos,
        tags,
        processoTags,
        comentarios,
        documentos,
        empresaDocumentos,
        questionarios,
        respostas,
        historicoEventos,
        historicoFluxos,
        templates,
        eventosCalendario,
        interligacoes,
        checklistDepartamento,
        motivosExclusao,
        documentosObrigatorios,
        logsAuditoria,
      },
      contagem: {
        usuarios: usuarios.length,
        departamentos: departamentos.length,
        empresas: empresas.length,
        processos: processos.length,
        tags: tags.length,
        comentarios: comentarios.length,
        documentos: documentos.length,
        templates: templates.length,
        eventosCalendario: eventosCalendario.length,
        logsAuditoria: logsAuditoria.length,
      },
    });

    return NextResponse.json(backup);
  } catch (err: any) {
    console.error('Erro ao exportar backup:', err);
    return NextResponse.json({ error: 'Erro ao exportar backup', details: err.message }, { status: 500 });
  }
}

// POST /api/backup - Restaurar dados a partir de um backup JSON
export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  await ensureLogAuditoriaSoftDeleteSchema();
  if (!requireRole(user, ['ADMIN'])) {
    return NextResponse.json({ error: 'Apenas administradores podem restaurar backups' }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (!body?.versao || !body?.dados) {
      return NextResponse.json({ error: 'Arquivo de backup inválido. Verifique o formato.' }, { status: 400 });
    }

    const dados = body.dados;
    const empresaDocumentoColumns = await getEmpresaDocumentoColumns();
    const checklistConfig = await getChecklistDepartamentoQueryConfig();

    // Executar restauração em uma transação
    await prisma.$transaction(async (tx) => {
      // Limpar dados existentes na ordem correta (respeitar foreign keys)
      await tx.respostaQuestionario.deleteMany();
      await tx.questionarioDepartamento.deleteMany();
      await tx.processoFavorito.deleteMany();
      await tx.processoTag.deleteMany();
      await tx.comentario.deleteMany();
      await tx.documento.deleteMany();
      await tx.historicoEvento.deleteMany();
      await tx.historicoFluxo.deleteMany();
      await tx.interligacaoProcesso.deleteMany();
      await tx.checklistDepartamento.deleteMany();
      await tx.documentoObrigatorio.deleteMany();
      await tx.empresaDocumento.deleteMany();
      await tx.itemLixeira.deleteMany();
      await tx.notificacao.deleteMany();
      await tx.logAuditoria.deleteMany();
      await tx.emailVerificationCode.deleteMany();
      await tx.eventoCalendario.deleteMany();
      await tx.processo.deleteMany();
      await tx.template.deleteMany();
      await tx.tag.deleteMany();
      await tx.empresa.deleteMany();
      await tx.motivoExclusao.deleteMany();
      await tx.usuario.deleteMany();
      await tx.departamento.deleteMany();

      // Restaurar na ordem correta (tabelas base primeiro)
      if (Array.isArray(dados.departamentos) && dados.departamentos.length > 0) {
        for (const d of dados.departamentos) {
          await tx.departamento.create({
            data: {
              id: d.id,
              nome: d.nome,
              descricao: d.descricao || null,
              responsavel: d.responsavel || null,
              cor: d.cor || 'from-cyan-500 to-blue-600',
              icone: d.icone || null,
              ativo: d.ativo !== false,
              ordem: d.ordem || 0,
              criadoEm: d.criadoEm ? new Date(d.criadoEm) : new Date(),
              atualizadoEm: d.atualizadoEm ? new Date(d.atualizadoEm) : new Date(),
            },
          });
        }
      }

      if (Array.isArray(dados.usuarios) && dados.usuarios.length > 0) {
        for (const u of dados.usuarios) {
          await tx.usuario.create({
            data: {
              id: u.id,
              nome: u.nome,
              email: u.email,
              senha: u.senha || '$2a$10$placeholder', // senha não é exportada por segurança
              role: u.role || 'USUARIO',
              departamentoId: u.departamentoId || null,
              ativo: u.ativo !== false,
              permissoes: Array.isArray(u.permissoes) ? u.permissoes : [],
              criadoEm: u.criadoEm ? new Date(u.criadoEm) : new Date(),
            },
          });
        }
      }

      if (Array.isArray(dados.empresas) && dados.empresas.length > 0) {
        for (const e of dados.empresas) {
          await tx.empresa.create({
            data: {
              id: e.id,
              cnpj: e.cnpj || null,
              codigo: e.codigo,
              razao_social: e.razao_social,
              apelido: e.apelido || null,
              inscricao_estadual: e.inscricao_estadual || null,
              inscricao_municipal: e.inscricao_municipal || null,
              regime_federal: e.regime_federal || null,
              regime_estadual: e.regime_estadual || null,
              regime_municipal: e.regime_municipal || null,
              data_abertura: e.data_abertura ? new Date(e.data_abertura) : null,
              estado: e.estado || null,
              cidade: e.cidade || null,
              bairro: e.bairro || null,
              logradouro: e.logradouro || null,
              numero: e.numero || null,
              cep: e.cep || null,
              email: e.email || null,
              telefone: e.telefone || null,
              cadastrada: e.cadastrada || false,
              criado_em: e.criado_em ? new Date(e.criado_em) : new Date(),
              atualizado_em: e.atualizado_em ? new Date(e.atualizado_em) : new Date(),
            },
          });
        }
      }

      if (Array.isArray(dados.tags) && dados.tags.length > 0) {
        for (const t of dados.tags) {
          await tx.tag.create({
            data: {
              id: t.id,
              nome: t.nome,
              cor: t.cor || 'bg-blue-500',
              texto: t.texto || 'text-white',
              criadoEm: t.criadoEm ? new Date(t.criadoEm) : new Date(),
              atualizadoEm: t.atualizadoEm ? new Date(t.atualizadoEm) : new Date(),
            },
          });
        }
      }

      if (Array.isArray(dados.templates) && dados.templates.length > 0) {
        for (const t of dados.templates) {
          await tx.template.create({
            data: {
              id: t.id,
              nome: t.nome,
              descricao: t.descricao || null,
              fluxoDepartamentos: Array.isArray(t.fluxoDepartamentos) ? t.fluxoDepartamentos : [],
              questionariosPorDepartamento: t.questionariosPorDepartamento || {},
              criadoPorId: t.criadoPorId || null,
              criado_em: t.criado_em ? new Date(t.criado_em) : new Date(),
              atualizado_em: t.atualizado_em ? new Date(t.atualizado_em) : new Date(),
            },
          });
        }
      }

      if (Array.isArray(dados.processos) && dados.processos.length > 0) {
        for (const p of dados.processos) {
          await tx.processo.create({
            data: {
              id: p.id,
              nome: p.nome || null,
              nomeServico: p.nomeServico || null,
              nomeEmpresa: p.nomeEmpresa,
              cliente: p.cliente || null,
              email: p.email || null,
              telefone: p.telefone || null,
              empresaId: p.empresaId || null,
              status: p.status || 'EM_ANDAMENTO',
              prioridade: p.prioridade || 'MEDIA',
              departamentoAtual: p.departamentoAtual,
              departamentoAtualIndex: p.departamentoAtualIndex || 0,
              fluxoDepartamentos: Array.isArray(p.fluxoDepartamentos) ? p.fluxoDepartamentos : [],
              descricao: p.descricao || null,
              notasCriador: p.notasCriador || null,
              criadoPorId: p.criadoPorId || null,
              responsavelId: p.responsavelId || null,
              criadoEm: p.criadoEm ? new Date(p.criadoEm) : new Date(),
              dataCriacao: p.dataCriacao ? new Date(p.dataCriacao) : new Date(),
              dataAtualizacao: p.dataAtualizacao ? new Date(p.dataAtualizacao) : new Date(),
              dataInicio: p.dataInicio ? new Date(p.dataInicio) : null,
              dataEntrega: p.dataEntrega ? new Date(p.dataEntrega) : null,
              dataFinalizacao: p.dataFinalizacao ? new Date(p.dataFinalizacao) : null,
              progresso: p.progresso || 0,
              interligadoComId: p.interligadoComId || null,
              interligadoNome: p.interligadoNome || null,
              interligadoParalelo: p.interligadoParalelo || false,
              deptIndependente: p.deptIndependente || false,
            },
          });
        }
      }

      if (Array.isArray(dados.processoTags) && dados.processoTags.length > 0) {
        for (const pt of dados.processoTags) {
          await tx.processoTag.create({ data: { id: pt.id, processoId: pt.processoId, tagId: pt.tagId } });
        }
      }

      if (Array.isArray(dados.comentarios) && dados.comentarios.length > 0) {
        // Primeiro inserir comentários SEM parentId, depois os que têm
        const semParent = dados.comentarios.filter((c: any) => !c.parentId);
        const comParent = dados.comentarios.filter((c: any) => c.parentId);
        for (const c of [...semParent, ...comParent]) {
          await tx.comentario.create({
            data: {
              id: c.id,
              processoId: c.processoId,
              texto: c.texto,
              autorId: c.autorId,
              departamentoId: c.departamentoId || null,
              parentId: c.parentId || null,
              mencoes: Array.isArray(c.mencoes) ? c.mencoes : [],
              editado: c.editado || false,
              editadoEm: c.editadoEm ? new Date(c.editadoEm) : null,
              criadoEm: c.criadoEm ? new Date(c.criadoEm) : new Date(),
              atualizadoEm: c.atualizadoEm ? new Date(c.atualizadoEm) : new Date(),
            },
          });
        }
      }

      if (Array.isArray(dados.documentos) && dados.documentos.length > 0) {
        for (const d of dados.documentos) {
          await tx.documento.create({
            data: {
              id: d.id,
              processoId: d.processoId,
              nome: d.nome,
              tipo: d.tipo,
              tipoCategoria: d.tipoCategoria || null,
              tamanho: BigInt(d.tamanho || 0),
              url: d.url,
              path: d.path || null,
              departamentoId: d.departamentoId || null,
              perguntaId: d.perguntaId || null,
              dataUpload: d.dataUpload ? new Date(d.dataUpload) : new Date(),
              uploadPorId: d.uploadPorId || null,
              visibility: d.visibility || 'PUBLIC',
              allowedRoles: Array.isArray(d.allowedRoles) ? d.allowedRoles : [],
              allowedUserIds: Array.isArray(d.allowedUserIds) ? d.allowedUserIds : [],
            },
          });
        }
      }

      if (Array.isArray(dados.empresaDocumentos) && dados.empresaDocumentos.length > 0) {
        for (const d of dados.empresaDocumentos) {
          await createEmpresaDocumentoCompat(
            tx,
            {
              id: d.id,
              empresaId: d.empresaId,
              nome: d.nome,
              tipo: d.tipo,
              descricao: d.descricao || null,
              tamanho: BigInt(d.tamanho || 0),
              url: d.url,
              path: d.path || null,
              dataUpload: d.dataUpload ? new Date(d.dataUpload) : new Date(),
              uploadPorId: d.uploadPorId || null,
              validadeAte: d.validadeAte ? new Date(d.validadeAte) : null,
              alertarDiasAntes: d.alertarDiasAntes ?? 30,
              visibility: d.visibility || 'PUBLIC',
              allowedRoles: Array.isArray(d.allowedRoles) ? d.allowedRoles : [],
              allowedUserIds: Array.isArray(d.allowedUserIds) ? d.allowedUserIds : [],
              allowedDepartamentos: Array.isArray(d.allowedDepartamentos) ? d.allowedDepartamentos : [],
            },
            undefined,
            empresaDocumentoColumns
          );
        }
      }

      if (Array.isArray(dados.questionarios) && dados.questionarios.length > 0) {
        for (const q of dados.questionarios) {
          await tx.questionarioDepartamento.create({
            data: {
              id: q.id,
              departamentoId: q.departamentoId,
              processoId: q.processoId || null,
              label: q.label,
              tipo: q.tipo || 'TEXT',
              obrigatorio: q.obrigatorio || false,
              ordem: q.ordem || 0,
              opcoes: Array.isArray(q.opcoes) ? q.opcoes : [],
              placeholder: q.placeholder || null,
              descricao: q.descricao || null,
              condicaoPerguntaId: q.condicaoPerguntaId || null,
              condicaoOperador: q.condicaoOperador || null,
              condicaoValor: q.condicaoValor || null,
            },
          });
        }
      }

      if (Array.isArray(dados.respostas) && dados.respostas.length > 0) {
        for (const r of dados.respostas) {
          await tx.respostaQuestionario.create({
            data: {
              id: r.id,
              processoId: r.processoId,
              questionarioId: r.questionarioId,
              resposta: r.resposta,
              respondidoPorId: r.respondidoPorId,
              respondidoEm: r.respondidoEm ? new Date(r.respondidoEm) : new Date(),
              atualizadoEm: r.atualizadoEm ? new Date(r.atualizadoEm) : new Date(),
            },
          });
        }
      }

      if (Array.isArray(dados.historicoEventos) && dados.historicoEventos.length > 0) {
        for (const h of dados.historicoEventos) {
          await tx.historicoEvento.create({
            data: {
              id: h.id,
              processoId: h.processoId,
              tipo: h.tipo || 'ALTERACAO',
              acao: h.acao,
              responsavelId: h.responsavelId || null,
              departamento: h.departamento || null,
              data: h.data ? new Date(h.data) : new Date(),
              dataTimestamp: BigInt(h.dataTimestamp || Date.now()),
            },
          });
        }
      }

      if (Array.isArray(dados.historicoFluxos) && dados.historicoFluxos.length > 0) {
        for (const h of dados.historicoFluxos) {
          await tx.historicoFluxo.create({
            data: {
              id: h.id,
              processoId: h.processoId,
              departamentoId: h.departamentoId,
              ordem: h.ordem,
              status: h.status,
              entradaEm: h.entradaEm ? new Date(h.entradaEm) : new Date(),
              saidaEm: h.saidaEm ? new Date(h.saidaEm) : null,
            },
          });
        }
      }

      if (Array.isArray(dados.eventosCalendario) && dados.eventosCalendario.length > 0) {
        for (const e of dados.eventosCalendario) {
          await tx.eventoCalendario.create({
            data: {
              id: e.id,
              titulo: e.titulo,
              descricao: e.descricao || null,
              tipo: e.tipo || 'LEMBRETE',
              status: e.status || 'PENDENTE',
              dataInicio: new Date(e.dataInicio),
              dataFim: e.dataFim ? new Date(e.dataFim) : null,
              diaInteiro: e.diaInteiro || false,
              cor: e.cor || null,
              processoId: e.processoId || null,
              empresaId: e.empresaId || null,
              departamentoId: e.departamentoId || null,
              criadoPorId: e.criadoPorId || null,
              privado: e.privado !== false,
              recorrencia: e.recorrencia || 'UNICO',
              recorrenciaFim: e.recorrenciaFim ? new Date(e.recorrenciaFim) : null,
              alertaMinutosAntes: e.alertaMinutosAntes ?? 60,
              criadoEm: e.criadoEm ? new Date(e.criadoEm) : new Date(),
              atualizadoEm: e.atualizadoEm ? new Date(e.atualizadoEm) : new Date(),
            },
          });
        }
      }

      if (Array.isArray(dados.interligacoes) && dados.interligacoes.length > 0) {
        for (const i of dados.interligacoes) {
          await tx.interligacaoProcesso.create({
            data: {
              id: i.id,
              processoOrigemId: i.processoOrigemId,
              processoDestinoId: i.processoDestinoId,
              criadoPorId: i.criadoPorId,
              automatica: i.automatica || false,
              criadoEm: i.criadoEm ? new Date(i.criadoEm) : new Date(),
            },
          });
        }
      }

      if (Array.isArray(dados.checklistDepartamento) && dados.checklistDepartamento.length > 0) {
        for (const c of dados.checklistDepartamento) {
          await tx.checklistDepartamento.create({
            data: {
              id: c.id,
              processoId: c.processoId,
              departamentoId: c.departamentoId,
              concluido: c.concluido || false,
              concluidoPorId: c.concluidoPorId || null,
              concluidoEm: c.concluidoEm ? new Date(c.concluidoEm) : null,
              ...(checklistConfig.hasResponsavelId && c.responsavelId !== undefined
                ? { responsavelId: c.responsavelId || null }
                : {}),
              ...(checklistConfig.hasResponsavelNome && c.responsavelNome !== undefined
                ? { responsavelNome: c.responsavelNome || null }
                : {}),
            },
            select: checklistConfig.select,
          });
        }
      }

      if (Array.isArray(dados.motivosExclusao) && dados.motivosExclusao.length > 0) {
        for (const m of dados.motivosExclusao) {
          await tx.motivoExclusao.create({
            data: {
              id: m.id,
              nome: m.nome,
              padrao: m.padrao || false,
              criadoEm: m.criadoEm ? new Date(m.criadoEm) : new Date(),
            },
          });
        }
      }

      if (Array.isArray(dados.documentosObrigatorios) && dados.documentosObrigatorios.length > 0) {
        for (const d of dados.documentosObrigatorios) {
          await tx.documentoObrigatorio.create({
            data: {
              id: d.id,
              departamentoId: d.departamentoId,
              tipo: d.tipo,
              nome: d.nome,
              descricao: d.descricao || null,
              obrigatorio: d.obrigatorio !== false,
            },
          });
        }
      }

      if (Array.isArray(dados.logsAuditoria) && dados.logsAuditoria.length > 0) {
        try {
          for (const l of dados.logsAuditoria) {
            await tx.logAuditoria.create({
              data: {
                id: l.id,
                usuarioId: l.usuarioId,
                acao: l.acao,
                entidade: l.entidade,
                entidadeId: l.entidadeId || null,
                entidadeNome: l.entidadeNome || null,
                campo: l.campo || null,
                valorAnterior: l.valorAnterior || null,
                valorNovo: l.valorNovo || null,
                detalhes: l.detalhes || null,
                processoId: l.processoId || null,
                empresaId: l.empresaId || null,
                departamentoId: l.departamentoId || null,
                ip: l.ip || null,
                apagado: l.apagado === true,
                apagadoEm: l.apagadoEm ? new Date(l.apagadoEm) : null,
                apagadoPorId: l.apagadoPorId || null,
                apagadoPorNome: l.apagadoPorNome || null,
                apagadoMotivo: l.apagadoMotivo || null,
                criadoEm: l.criadoEm ? new Date(l.criadoEm) : new Date(),
              },
            });
          }
        } catch (e: any) {
          // Tabela pode não existir ainda - ignorar
          if (e?.code !== 'P2021' && !e?.message?.includes('does not exist')) throw e;
        }
      }

      // Resetar sequences do PostgreSQL para evitar conflitos de ID
      const sequences = [
        { table: 'Usuario', seq: 'Usuario_id_seq' },
        { table: 'Departamento', seq: 'Departamento_id_seq' },
        { table: 'Empresa', seq: 'Empresa_id_seq' },
        { table: 'Processo', seq: 'Processo_id_seq' },
        { table: 'Tag', seq: 'Tag_id_seq' },
        { table: 'ProcessoTag', seq: 'ProcessoTag_id_seq' },
        { table: 'Comentario', seq: 'Comentario_id_seq' },
        { table: 'Documento', seq: 'Documento_id_seq' },
        { table: 'EmpresaDocumento', seq: 'EmpresaDocumento_id_seq' },
        { table: 'QuestionarioDepartamento', seq: 'QuestionarioDepartamento_id_seq' },
        { table: 'RespostaQuestionario', seq: 'RespostaQuestionario_id_seq' },
        { table: 'HistoricoEvento', seq: 'HistoricoEvento_id_seq' },
        { table: 'HistoricoFluxo', seq: 'HistoricoFluxo_id_seq' },
        { table: 'Template', seq: 'Template_id_seq' },
        { table: 'EventoCalendario', seq: 'EventoCalendario_id_seq' },
        { table: 'InterligacaoProcesso', seq: 'InterligacaoProcesso_id_seq' },
        { table: 'ChecklistDepartamento', seq: 'ChecklistDepartamento_id_seq' },
        { table: 'MotivoExclusao', seq: 'MotivoExclusao_id_seq' },
        { table: 'DocumentoObrigatorio', seq: 'DocumentoObrigatorio_id_seq' },
        { table: 'LogAuditoria', seq: 'LogAuditoria_id_seq' },
      ];

      for (const { table, seq } of sequences) {
        try {
          await tx.$executeRawUnsafe(
            `SELECT setval('"${seq}"', COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
          );
        } catch {
          // Sequence pode não existir se a tabela estiver vazia, ignorar
        }
      }
    }, { timeout: 120000 }); // 2 minutos de timeout para backups grandes

    return NextResponse.json({
      success: true,
      mensagem: 'Backup restaurado com sucesso!',
      restauradoEm: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Erro ao restaurar backup:', err);
    return NextResponse.json({ error: 'Erro ao restaurar backup', details: err.message }, { status: 500 });
  }
}
