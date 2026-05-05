'use client';

import React, { useState, useEffect } from 'react';
import {
  Building,
  Eye,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  MessageSquare,
  FileText,
  Pin,
  Tag,
  X,
  User,
  Calendar,
  Clock,
  Edit,
  Mail,
  Phone,
  Loader2,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import { Processo } from '@/app/types';
import { temPermissao } from '@/app/utils/permissions';
import { verificarMencoesNaoLidasPorNotificacoes } from '@/app/utils/mentions';

const REPOSITORIO_DOCS_MARKER_PREFIX = '__repositorio_docs_departamento__:';

interface ListaProcessosProps {
  onProcessoClicado: (processo: Processo) => void;
  filtroStatus?: string;
  filtroBusca?: string;
  filtroTags?: number[];
  filtroDepartamento?: number | null;
  departamentos?: any[];
  onComentarios?: (processo: Processo) => void;
  onQuestionario?: (processo: Processo, options?: { somenteLeitura?: boolean }) => void;
  onDocumentos?: (processo: Processo, options?: { abrirGaleria?: boolean }) => void;
  onExcluir?: (processo: Processo) => void;
  onAvancar?: (processo: Processo) => void;
  onVoltar?: (processo: Processo) => void;
  onFinalizar?: (processo: Processo) => void;
  onTags?: (processo: Processo) => void;
  onGerenciarTags?: (processo: Processo) => void;
  favoritosIds?: Set<number>;
  onToggleFavorito?: (processoId: number) => void;
}

export default function ListaProcessos({
  onProcessoClicado,
  filtroStatus = 'todos',
  filtroBusca = '',
  filtroTags = [],
  filtroDepartamento = null,
  departamentos = [],
  onComentarios,
  onQuestionario,
  onDocumentos,
  onExcluir,
  onAvancar,
  onVoltar,
  onFinalizar,
  onTags,
  onGerenciarTags,
  favoritosIds = new Set(),
  onToggleFavorito,
}: ListaProcessosProps) {
  const { processos, tags, usuarioLogado, notificacoes } = useSistema();
  
  // Loading para feedback visual
  const [loadingFavorito, setLoadingFavorito] = useState<number | null>(null);

  // Toggle favorito usando callback do parent
  const toggleFavorito = async (e: React.MouseEvent, processoId: number) => {
    e.stopPropagation();
    if (loadingFavorito === processoId || !onToggleFavorito) return;

    setLoadingFavorito(processoId);
    try {
      await onToggleFavorito(processoId);
    } catch (error) {
      console.error('Erro ao alterar favorito:', error);
    } finally {
      setLoadingFavorito(null);
    }
  };

  const getNomeEmpresa = (proc: Processo): string => {
    const nomeEmpresa = (proc as any).nomeEmpresa;
    if (typeof nomeEmpresa === 'string' && nomeEmpresa.trim()) return nomeEmpresa;

    const empresa = (proc as any).empresa;
    if (typeof empresa === 'string' && empresa.trim()) return empresa;
    if (empresa && typeof empresa === 'object') {
      const razao = (empresa as any).razao_social;
      const apelido = (empresa as any).apelido;
      const codigo = (empresa as any).codigo;
      if (typeof razao === 'string' && razao.trim()) return razao;
      if (typeof apelido === 'string' && apelido.trim()) return apelido;
      if (typeof codigo === 'string' && codigo.trim()) return codigo;
    }

    return 'Nova Empresa';
  };

  const isProcessoRepositorioDocs = (proc: Processo) =>
    String((proc as any)?.notasCriador || '').trim().startsWith(REPOSITORIO_DOCS_MARKER_PREFIX);

  const processosFiltrados = processos.filter((proc) => {
    if (isProcessoRepositorioDocs(proc)) return false;

    // Filtro por status
    if (filtroStatus === 'andamento' && proc.status !== 'em_andamento') return false;
    if (filtroStatus === 'finalizado' && proc.status !== 'finalizado') return false;
    if (filtroStatus === 'alta' && proc.prioridade !== 'alta') return false;

    // Filtro por busca
    const nomeEmpresa = getNomeEmpresa(proc);
    if (filtroBusca && !nomeEmpresa.toLowerCase().includes(filtroBusca.toLowerCase())) {
      return false;
    }

    // Filtro por tags
    if (filtroTags.length > 0 && !filtroTags.some((t) => proc.tags?.includes(t))) {
      return false;
    }

    // Filtro por departamento
    if (filtroDepartamento) {
      // Se deptIndependente, o processo aparece em todos os depts do fluxo
      if (
        proc.deptIndependente &&
        Array.isArray(proc.fluxoDepartamentos) &&
        proc.fluxoDepartamentos.some((id: any) => Number(id) === Number(filtroDepartamento))
      ) {
        // aparece
      } else if (proc.departamentoAtual !== filtroDepartamento) {
        return false;
      }
    }

    return true;
  });

  const totalProcessosVisiveis = processos.filter((proc) => !isProcessoRepositorioDocs(proc)).length;

  const getPriorityColor = (prioridade: string) => {
    switch (String(prioridade || '').toLowerCase()) {
      case 'alta':
        return 'text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700';
      case 'media':
        return 'text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-700 border-yellow-200 dark:border-yellow-700';
      case 'baixa':
        return 'text-green-900 dark:text-green-300 bg-green-50 dark:bg-green-700 border-green-200 dark:border-green-700 ring-1 ring-green-100';
      default:
        return 'text-gray-600 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_andamento':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'finalizado':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'pausado':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatarStatus = (status: Processo['status']) => {
    switch (status) {
      case 'em_andamento':
        return 'Em Andamento';
      case 'finalizado':
        return 'Finalizado';
      case 'pausado':
        return 'Pausado';
      case 'cancelado':
        return 'Cancelado';
      case 'rascunho':
        return 'Rascunho';
      default:
        return String(status);
    }
  };

  const formatarPrioridade = (prioridade: Processo['prioridade']) => {
    switch (prioridade) {
      case 'alta':
        return 'ALTA';
      case 'media':
        return 'MEDIA';
      case 'baixa':
        return 'BAIXA';
      default:
        return String(prioridade).toUpperCase();
    }
  };

  const formatarData = (data?: Date | string) => {
    if (!data) return 'Não informado';
    try {
      return new Date(data).toLocaleDateString('pt-BR');
    } catch {
      return 'Não informado';
    }
  };

  const calcularPrazo = (processo: Processo): Date | string | undefined => {
    const prazo = (processo as any).prazoEstimado || processo.dataEntrega;
    if (prazo) return prazo;

    const inicio = (processo.dataInicio || processo.criadoEm) as any;
    if (!inicio) return undefined;

    const d = new Date(inicio);
    if (Number.isNaN(d.getTime())) return undefined;
    d.setDate(d.getDate() + 15);
    return d;
  };

  const getDepartamentoAtual = (processo: Processo) => {
    return departamentos.find(dept => dept.id === processo.departamentoAtual);
  };

  const getIconeDepartamento = (icone: any) => {
    if (typeof icone === 'function') return icone;
    if (typeof icone === 'string' && icone) return (LucideIcons as any)[icone] || null;
    return null;
  };

  if (processosFiltrados.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Processos Detalhados</h2>
        </div>
        <div className="p-12 text-center text-gray-500">
          <Building size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">Nenhum processo encontrado</p>
          <p className="text-sm">Tente ajustar os filtros ou criar uma nova solicitação</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Processos Detalhados</h2>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-600">
        {processosFiltrados.map((processo) => {
          const isFinalizado = processo.status === 'finalizado';
          const isUltimoDepartamento = processo.departamentoAtualIndex === (processo.fluxoDepartamentos?.length || 1) - 1;
          const isPrimeiroDepartamento = (processo.departamentoAtualIndex || 0) <= 0;
          const departamentoAtual = getDepartamentoAtual(processo);
          const nomeEmpresa = getNomeEmpresa(processo);
          const nomeServico = processo.nome || processo.nomeServico || 'Processo';
          const comentariosCount = (processo as any).comentariosCount ?? (processo.comentarios || []).length;
          const documentosCount = (processo as any).documentosCount ?? (processo.documentos || []).length;
          const podeAvancar = Boolean(onAvancar) && temPermissao(usuarioLogado, 'mover_processo', { departamentoAtual: processo.departamentoAtual });
          const podeVoltar = Boolean(onVoltar) && temPermissao(usuarioLogado, 'mover_processo', { departamentoAtual: processo.departamentoAtual });
          const podeFinalizar =
            Boolean(onFinalizar) && temPermissao(usuarioLogado, 'finalizar_processo', { departamentoAtual: processo.departamentoAtual, isUltimoDepartamento });
          const podeGerenciarTags = Boolean(onGerenciarTags) && temPermissao(usuarioLogado, 'gerenciar_tags');
          const podeAplicarTags = Boolean(onTags) && temPermissao(usuarioLogado, 'aplicar_tags');
          const IconeDept = departamentoAtual ? getIconeDepartamento(departamentoAtual.icone) : null;

          return (
            <div
              key={processo.id}
              className="p-4 sm:p-6 hover:bg-gray-50 transition-all duration-200"
            >
              <div className="flex flex-col 2xl:flex-row 2xl:justify-between 2xl:items-start mb-6 gap-4">
                {/* Coluna Esquerda - Informações */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      {/* Linha 1: Nome do Serviço + Status + Prioridade */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {processo.nomeServico && (
                          <span className="text-sm font-semibold text-blue-600">
                            {processo.nomeServico}
                          </span>
                        )}
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(processo.status)}`}>
                          {formatarStatus(processo.status)}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(processo.prioridade)}`}>
                          {formatarPrioridade(processo.prioridade)}
                        </span>
                      </div>

                      {/* Linha 2: Nome da Empresa + Tags */}
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-gray-900">
                          {nomeEmpresa}
                        </h3>
                        {(processo.tags || []).length > 0 && (
                          <div className="flex gap-1 flex-shrink-0">
                            {(processo.tags || []).map((tagId) => {
                              const tag = (tags || []).find((t) => t.id === tagId);
                              return tag ? (
                                <div
                                  key={tagId}
                                  className={`w-3 h-3 rounded-full ${tag.cor} border border-white shadow-sm`}
                                  title={tag.nome}
                                />
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Informações em Grid */}
                  <div className="process-details-grid mb-6">
                    <div className="process-detail-item">
                      <User size={16} className="text-gray-400 flex-shrink-0" />
                      <div className="process-detail-text">
                        <div className="text-xs text-gray-500">Cliente</div>
                        <div className="text-sm font-medium text-gray-900 truncate">{processo.cliente || 'Não informado'}</div>
                      </div>
                    </div>

                    <div className="process-detail-item">
                      <Calendar size={16} className="text-gray-400 flex-shrink-0" />
                      <div className="process-detail-text">
                        <div className="text-xs text-gray-500">Início</div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatarData((processo.dataInicio || processo.criadoEm) as any)}
                        </div>
                      </div>
                    </div>

                    <div className="process-detail-item">
                      <Clock size={16} className="text-gray-400 flex-shrink-0" />
                      <div className="process-detail-text">
                        <div className="text-xs text-gray-500">Prazo</div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatarData(calcularPrazo(processo) as any)}
                        </div>
                      </div>
                    </div>

                    {processo.dataFinalizacao && (
                      <div className="process-detail-item">
                        <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                        <div className="process-detail-text">
                          <div className="text-xs text-gray-500">Finalizado</div>
                          <div className="text-sm font-medium text-green-600">
                            {formatarData(processo.dataFinalizacao as any)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {(processo.email || processo.telefone) && (
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                      {processo.email && (
                        <span className="inline-flex items-center gap-1"><Mail size={12} /> {processo.email}</span>
                      )}
                      {processo.telefone && (
                        <span className="inline-flex items-center gap-1"><Phone size={12} /> {processo.telefone}</span>
                      )}
                    </div>
                  )}

                  {/* Departamento Atual (só para processos em andamento) */}
                  {processo.status === 'em_andamento' && departamentoAtual && (
                    <div className="bg-white dark:bg-[var(--card)] border-l-4 border-blue-500 rounded-lg p-5 shadow-sm mb-6 dark:border dark:border-[var(--border)]">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${departamentoAtual.cor || 'from-blue-500 to-cyan-500'} flex items-center justify-center flex-shrink-0`}>
                          {IconeDept ? <IconeDept size={24} className="text-white" /> : <User size={24} className="text-white" />}
                        </div>

                        <div className="flex-1">
                          <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Departamento Atual</p>
                          <h4 className="text-lg font-bold text-gray-900" title={departamentoAtual.nome}>
                            {departamentoAtual.nome && departamentoAtual.nome.length > 40
                              ? departamentoAtual.nome.slice(0, 40) + '...'
                              : departamentoAtual.nome || 'Sem departamento'}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <User size={14} />
                            <span>{departamentoAtual.responsavel || 'Sem responsável'}</span>
                          </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg px-4 py-3 text-center border border-transparent dark:border-[var(--border)]">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">{processo.progresso || 0}%</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Completo</div>
                        </div>
                      </div>

                      {departamentoAtual.descricao && (
                        <p className="text-sm text-gray-600 mt-3 pl-16">{departamentoAtual.descricao}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Coluna Direita - Ações */}
                <div className="flex w-full 2xl:w-auto flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center justify-start 2xl:justify-end">
                  <div className="flex flex-wrap gap-2">
                    {isFinalizado && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => onProcessoClicado(processo)}
                          className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap"
                        >
                          <Eye size={16} />
                          Ver Completo
                        </button>

                        {onComentarios && (
                          <button
                            onClick={() => onComentarios(processo)}
                            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap relative"
                          >
                            <MessageSquare size={16} />
                            Comentários ({comentariosCount})
                            {verificarMencoesNaoLidasPorNotificacoes(notificacoes as any, processo.id) && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                            )}
                          </button>
                        )}

                        {onQuestionario && (
                          <button
                            onClick={() => onQuestionario(processo, { somenteLeitura: true })}
                            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap"
                          >
                            <FileText size={16} />
                            Ver Questionário
                          </button>
                        )}

                        {onDocumentos && (
                          <button
                            onClick={() => onDocumentos(processo, { abrirGaleria: true })}
                            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap"
                          >
                            <FileText size={16} />
                            Documentos ({documentosCount})
                          </button>
                        )}
                      </div>
                    )}

                    {!isFinalizado && (
                      <>
                        {onComentarios && (
                          <button
                            onClick={() => onComentarios(processo)}
                            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap relative"
                          >
                            <MessageSquare size={16} />
                            Comentários ({comentariosCount})
                            {verificarMencoesNaoLidasPorNotificacoes(notificacoes as any, processo.id) && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                            )}
                          </button>
                        )}

                        {onQuestionario && (
                          <button
                            onClick={() => onQuestionario(processo, { somenteLeitura: false })}
                            className="bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap"
                          >
                            <Edit size={16} />
                            Questionário
                          </button>
                        )}


                        {!isUltimoDepartamento && onAvancar && podeAvancar && (
                          <button
                            onClick={() => onAvancar(processo)}
                            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl whitespace-nowrap"
                          >
                            <ArrowRight size={16} />
                            Avançar ({(processo.departamentoAtualIndex || 0) + 1}/{processo.fluxoDepartamentos?.length || 1})
                          </button>
                        )}

                        {isUltimoDepartamento && onFinalizar && podeFinalizar && (
                          <button
                            onClick={() => onFinalizar(processo)}
                            className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl whitespace-nowrap"
                          >
                            <CheckCircle size={16} />
                            Finalizar
                          </button>
                        )}

                        {onGerenciarTags && podeGerenciarTags && (
                          <button
                            onClick={() => onGerenciarTags(processo)}
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap"
                          >
                            <Tag size={20} />
                            Gerenciar Tags
                          </button>
                        )}

                        {onTags && podeAplicarTags && (
                          <button
                            onClick={() => onTags(processo)}
                            className="bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap"
                          >
                            <Tag size={16} />
                            Tags {(processo.tags || []).length > 0 ? `(${(processo.tags || []).length})` : ''}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Botão Favoritar */}
                  <button
                    onClick={(e) => toggleFavorito(e, processo.id)}
                    disabled={loadingFavorito === processo.id}
                    className={`p-2 rounded-lg transition-all ${
                      favoritosIds.has(processo.id)
                        ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-amber-50 hover:text-amber-500'
                    }`}
                    title={favoritosIds.has(processo.id) ? 'Remover dos fixados' : 'Fixar processo'}
                  >
                    {loadingFavorito === processo.id ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Pin size={20} className={favoritosIds.has(processo.id) ? 'fill-current' : ''} />
                    )}
                  </button>

                  {onExcluir && (
                    (() => {
                      const podeExcluir = temPermissao(usuarioLogado, 'excluir_processo', {
                        departamentoAtual: processo.departamentoAtual,
                      });
                      if (!podeExcluir) return null;
                      return (
                        <button
                          onClick={() => onExcluir(processo)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                          title="Excluir processo"
                        >
                          <X size={20} />
                        </button>
                      );
                    })()
                  )}
                </div>
              </div>

              {/* Histórico de Atividades */}
              {(() => {
                const historico =
                  processo.historico && processo.historico.length > 0
                    ? processo.historico
                    : processo.historicoEvento && processo.historicoEvento.length > 0
                      ? processo.historicoEvento
                      : [];

                if (!historico || historico.length === 0) return null;

                return (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Clock size={16} />
                    Últimas Atividades
                  </h4>
                  <div className="space-y-2">
                    {historico.slice(-3).map((item: any, index: number) => (
                      <div key={index} className="flex items-start gap-3 text-sm">
                        <div className="mt-1">
                          {item.tipo === 'inicio' && <Calendar className="text-blue-500" size={12} />}
                          {item.tipo === 'conclusao' && <CheckCircle className="text-green-500" size={12} />}
                          {item.tipo === 'finalizacao' && <CheckCircle2 className="text-yellow-500" size={12} />}
                          {item.tipo === 'movimentacao' && <ArrowRight className="text-purple-500" size={12} />}
                          {item.tipo === 'alteracao' && <Edit className="text-orange-500" size={12} />}
                          {item.tipo === 'documento' && <FileText className="text-blue-600" size={12} />}
                          {item.tipo === 'comentario' && <MessageSquare className="text-purple-600" size={12} />}
                        </div>
                        <div className="flex-1">
                          <div className="text-gray-900">{item.acao}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {item.responsavel} • {new Date(item.data).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {(processo as any).observacoes && (
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <h5 className="font-medium text-gray-700 mb-2">Observações:</h5>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{(processo as any).observacoes}</p>
                    </div>
                  )}

                  {(processo.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(processo.tags || []).map((tagId) => {
                        const tag = (tags || []).find((t) => t.id === tagId);
                        return tag ? (
                          <span key={tagId} className={`${tag.cor} text-white px-2 py-0.5 rounded text-xs`}>
                            {tag.nome}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      <div className="p-6 border-t border-gray-200 text-sm text-gray-600 text-center">
        Mostrando {processosFiltrados.length} de {totalProcessosVisiveis} processos
      </div>
    </div>
  );
}
