'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  CheckCircle,
  ChevronDown,
  FileText,
  MessageSquare,
  Star,
  Pin,
  Tag,
  X,
  Loader2,
  Edit3,
  Save,
  User as UserIcon,
  Building2,
  RotateCcw,
} from 'lucide-react';
import { Processo } from '@/app/types';
import { useSistema } from '@/app/context/SistemaContext';
import { formatarData } from '@/app/utils/helpers';
import { temPermissao as temPermissaoSistema } from '@/app/utils/permissions';
import { verificarMencoesNaoLidasPorNotificacoes } from '@/app/utils/mentions';
import { api } from '@/app/utils/api';
import ProgressoDeptsMini from '@/app/components/ProgressoDeptsMini';

interface ProcessoCardProps {
  processo: Processo;
  departamento: any;
  onQuestionario: (processo: Processo) => void;
  onDocumentos: (processo: Processo) => void;
  onComentarios: (processo: Processo) => void;
  onTags: (processo: Processo) => void;
  onExcluir: (id: number) => Promise<void>;
  onAvancar: (id: number) => Promise<void>;
  onFinalizar: (id: number) => Promise<void>;
  onVerDetalhes: (processo: Processo) => void;
  onDragStart?: (e: React.DragEvent, processo: Processo) => void;
  favoritosIds?: Set<number>;
  onToggleFavorito?: (processoId: number) => void;
}

export default function ProcessoCard({
  processo,
  departamento,
  onQuestionario,
  onDocumentos,
  onComentarios,
  onTags,
  onExcluir,
  onAvancar,
  onFinalizar,
  onVerDetalhes,
  onDragStart,
  favoritosIds,
  onToggleFavorito,
}: ProcessoCardProps) {
  const { tags, departamentos, atualizarProcesso, usuarioLogado, mostrarAlerta, notificacoes, usuarios } = useSistema();
  
  const isFavorito = favoritosIds?.has(processo.id) || false;
  const [toggling, setToggling] = useState(false);
  
  const handleToggleFavorito = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toggling || !onToggleFavorito) return;
    setToggling(true);
    try {
      await onToggleFavorito(processo.id);
    } finally {
      setToggling(false);
    }
  };

  const departamentoUsuarioRaw =
    (usuarioLogado as any)?.departamentoId ?? (usuarioLogado as any)?.departamento_id;
  const departamentoUsuarioParsed = Number(departamentoUsuarioRaw);
  const departamentoUsuario =
    Number.isFinite(departamentoUsuarioParsed) && departamentoUsuarioParsed > 0
      ? departamentoUsuarioParsed
      : undefined;

  const isDeptDoUsuario =
    typeof departamentoUsuario === 'number' &&
    typeof processo?.departamentoAtual === 'number' &&
    processo.departamentoAtual === departamentoUsuario;

  // Usuário normal: só mostra ações no card do próprio departamento
  const podeExibirAcoesNoCard = usuarioLogado?.role !== 'usuario' || isDeptDoUsuario;

  const podeEditarProcesso = temPermissaoSistema(usuarioLogado, 'editar_processo', { departamentoAtual: processo.departamentoAtual })
    || (String(usuarioLogado?.role).toLowerCase() === 'usuario' && isDeptDoUsuario);
  const podeExcluirProcesso = temPermissaoSistema(usuarioLogado, 'excluir_processo', { departamentoAtual: processo.departamentoAtual });
  const podeMover = temPermissaoSistema(usuarioLogado, 'mover_processo', { departamentoAtual: processo.departamentoAtual });

  const podeAcessarTags =
    podeExibirAcoesNoCard &&
    (temPermissaoSistema(usuarioLogado, 'gerenciar_tags', { departamentoAtual: processo.departamentoAtual }) ||
      temPermissaoSistema(usuarioLogado, 'aplicar_tags', { departamentoAtual: processo.departamentoAtual }));

  const podeComentar =
    podeExibirAcoesNoCard &&
    temPermissaoSistema(usuarioLogado, 'comentar', { departamentoAtual: processo.departamentoAtual });

  const getPriorityColor = (prioridade: string) => {
    switch ((prioridade || '').toLowerCase()) {
      case 'alta':
        return 'bg-red-50 dark:bg-red-900/10 text-red-900 dark:text-red-300 border-red-200 dark:border-red-700';
      case 'media':
        return 'bg-yellow-50 dark:bg-yellow-700/10 text-yellow-900 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700';
      case 'baixa':
        return 'bg-green-50 dark:bg-green-700/10 text-green-900 dark:text-green-300 border-green-200 dark:border-green-700 ring-1 ring-green-50';
      default:
        return 'bg-gray-50 dark:bg-gray-800/10 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600';
    }
  };

  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    try {
      const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const docDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      setIsDark(!!(docDark || prefersDark));
    } catch (e) {
      setIsDark(false);
    }
  }, []);

  // Removed inline dark-mode color overrides to rely on Tailwind classes

  const [editando, setEditando] = useState(false);
  const processoResponsavelId = (processo as any).responsavelId;
  const [editNomeEmpresa, setEditNomeEmpresa] = useState(processo.nomeEmpresa || '');
  const [editResponsavelId, setEditResponsavelId] = useState<number | undefined>(processoResponsavelId);
  const [editCliente, setEditCliente] = useState(processo.cliente || '');
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [voltandoDept, setVoltandoDept] = useState(false);

  // Sincronizar estado de edição quando o processo muda
  useEffect(() => {
    setEditNomeEmpresa(processo.nomeEmpresa || '');
    setEditResponsavelId(processoResponsavelId);
    setEditCliente(processo.cliente || '');
  }, [processo.nomeEmpresa, processoResponsavelId, processo.cliente]);

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSalvandoEdit(true);
    try {
      const updates: any = {};
      if (editNomeEmpresa !== (processo.nomeEmpresa || '')) updates.nomeEmpresa = editNomeEmpresa;
      if (editResponsavelId !== processoResponsavelId) updates.responsavelId = editResponsavelId || null;
      if (editCliente !== (processo.cliente || '')) updates.cliente = editCliente;
      if (Object.keys(updates).length > 0) {
        await atualizarProcesso(processo.id, updates);
      }
      setEditando(false);
    } catch (err: any) {
      mostrarAlerta('Erro', err?.message || 'Falha ao salvar', 'erro');
    } finally {
      setSalvandoEdit(false);
    }
  };

  // Permissao para voltar ao departamento (apenas admin/gerente)
  const podeVoltarAoDepartamento =
    processo.status === 'finalizado' &&
    (usuarioLogado?.role === 'admin' || usuarioLogado?.role === 'admin_departamento' || usuarioLogado?.role === 'gerente');

  const handleVoltarAoDepartamento = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (voltandoDept) return;
    setVoltandoDept(true);
    try {
      // Recuperar o ultimo departamento do fluxo
      const fluxoDepts = Array.isArray(processo.fluxoDepartamentos)
        ? processo.fluxoDepartamentos.map(Number).filter(Number.isFinite)
        : [];
      const ultimoDeptId = fluxoDepts.length > 0
        ? fluxoDepts[fluxoDepts.length - 1]
        : processo.departamentoAtual;
      const ultimoIndex = fluxoDepts.length > 0 ? fluxoDepts.length - 1 : 0;

      await atualizarProcesso(processo.id, {
        status: 'em_andamento' as any,
        dataFinalizacao: null as any,
        departamentoAtual: ultimoDeptId,
        departamentoAtualIndex: ultimoIndex,
      });
      mostrarAlerta('Sucesso', 'Processo retornado ao departamento. Agora voce pode finalizar novamente para interligar.', 'info');
    } catch (err: any) {
      mostrarAlerta('Erro', err?.message || 'Falha ao retornar processo', 'erro');
    } finally {
      setVoltandoDept(false);
    }
  };

  const [prioridade, setPrioridade] = React.useState((processo.prioridade || 'media') as 'alta' | 'media' | 'baixa');

  React.useEffect(() => {
    setPrioridade((processo.prioridade || 'media') as 'alta' | 'media' | 'baixa');
  }, [processo.prioridade]);
  const statusLabel = processo.status === 'finalizado' ? 'Finalizado' : 'Em Andamento';

  const fluxo = Array.isArray(processo.fluxoDepartamentos)
    ? processo.fluxoDepartamentos.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0)
    : [];
  const idxAtual = processo.departamentoAtualIndex || 0;
  const temFluxo = fluxo.length > 0;

  // Quando tem fluxo definido, usa ele. Se não, calcula com base nos departamentos do sistema.
  const isUltimo = temFluxo
    ? idxAtual === fluxo.length - 1
    : false; // sem fluxo = nunca é "ultimo" automaticamente

  // Determinar se pode avançar: com fluxo, é só não ser o último. Sem fluxo, sempre pode.
  const podeAvancarNoFluxo = temFluxo ? idxAtual < fluxo.length - 1 : true;

  const podeFinalizar = temPermissaoSistema(usuarioLogado, 'finalizar_processo', {
    departamentoAtual: processo.departamentoAtual,
    isUltimoDepartamento: isUltimo,
  });

  const progresso =
    typeof processo.progresso === 'number'
      ? processo.progresso
      : temFluxo
        ? Math.round(((idxAtual + 1) / fluxo.length) * 100)
        : 0;

  return (
    <div
      className="relative cursor-move rounded-xl border border-gray-200 bg-gray-50 p-4 transition-all duration-200 hover:bg-gray-100 hover:shadow-md sm:p-5"
      onClick={() => !editando && onVerDetalhes(processo)}
    >
      {/* Indicador de Fixado - canto superior esquerdo */}
      {onToggleFavorito && (
        <button
          onClick={handleToggleFavorito}
          disabled={toggling}
          className={`absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-all z-10 shadow-sm ${
            isFavorito 
              ? 'bg-amber-500 text-white hover:bg-amber-600' 
              : 'bg-white text-gray-400 hover:bg-amber-100 hover:text-amber-500 border border-gray-200'
          }`}
          title={isFavorito ? 'Remover dos fixados' : 'Fixar processo'}
        >
          {toggling ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Pin size={12} className={isFavorito ? 'fill-current' : ''} />
          )}
        </button>
      )}

      {/* Badge de ordem no fluxo para processos paralelos (deptIndependente) */}
      {processo.deptIndependente && temFluxo && (
        (() => {
          const ordemNoDept = fluxo.indexOf(departamento?.id) + 1;
          return ordemNoDept > 0 ? (
            <div
              className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center z-10 shadow-sm bg-indigo-500 text-white text-[10px] font-bold border-2 border-white"
              title={`Ordem no fluxo: ${ordemNoDept}º de ${fluxo.length} — Departamentos trabalham em paralelo`}
            >
              {ordemNoDept}
            </div>
          ) : null;
        })()
      )}

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0 mr-2">
          {processo.nomeServico && (
            <div
              className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-1.5 leading-snug line-clamp-2 cursor-help"
              title={processo.nomeServico}
            >
              {processo.nomeServico}
            </div>
          )}

          <div className="mb-1">
            <div
              className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 cursor-help leading-snug"
              title={processo.nomeEmpresa}
            >
              {processo.nomeEmpresa || 'Nova Empresa'}
            </div>

            {(processo.tags || []).length > 0 && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {((processo.tags || []) as number[])
                  .slice(0, 6)
                  .map((tagId) => {
                    const tag = tags.find((t) => t.id === tagId);
                    return tag ? (
                      <div
                        key={tagId}
                        className={`w-2.5 h-2.5 rounded-full ${tag.cor} border border-white shadow-sm flex-shrink-0`}
                        title={tag.nome}
                      />
                    ) : null;
                  })}
                {(processo.tags || []).length > 6 && (
                  <span className="text-[10px] text-gray-600">+{(processo.tags || []).length - 6}</span>
                )}
              </div>
            )}
          </div>

          {/* Responsável — para processos paralelos, mostra o responsável do departamento */}
          {(() => {
            let respNome: string | null = null;

            if (processo.deptIndependente && departamento) {
              // Para processos paralelos: usar o responsável do departamento, não do processo
              // 1. Tenta o campo "responsavel" do departamento (string no modelo Departamento)
              if (typeof departamento.responsavel === 'string' && departamento.responsavel) {
                respNome = departamento.responsavel;
              } else {
                // 2. Fallback: busca gerente do departamento na lista de usuários
                const gerenteDept = (usuarios || []).find(
                  (u: any) =>
                    Number((u as any)?.departamentoId ?? (u as any)?.departamento_id) === Number(departamento.id) &&
                    String(u.role).toLowerCase() === 'gerente' &&
                    u.ativo !== false
                );
                if (gerenteDept) {
                  respNome = gerenteDept.nome;
                }
              }
            }

            // Se não é paralelo ou não encontrou responsável do dept, usa o responsável do processo
            if (!respNome) {
              const resp = (processo as any).responsavel;
              respNome = typeof resp === 'object' && resp?.nome ? resp.nome : typeof resp === 'string' ? resp : null;
            }

            return (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1 truncate" title={respNome || 'Sem responsável'}>
                <UserIcon size={10} className="flex-shrink-0" />
                {respNome || 'Sem responsável'}
              </p>
            );
          })()}

        </div>

        <div className="ml-0 flex flex-wrap items-center justify-end gap-1 sm:ml-2 sm:flex-shrink-0">
          {/* Botão Editar */}
          {podeEditarProcesso && processo.status === 'em_andamento' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditando(!editando);
              }}
              className={`px-2 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 flex-shrink-0 ${editando ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500'}`}
              title="Editar solicitação"
            >
              <Edit3 size={10} />
            </button>
          )}
          {podeAcessarTags && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTags(processo);
              }}
              className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-xs hover:bg-indigo-200 transition-colors flex items-center gap-1 flex-shrink-0"
              title="Tags"
            >
              <Tag size={10} />
              {(processo.tags || []).length > 0 && (
                <span className="bg-indigo-500 text-white rounded-full w-3 h-3 text-[10px] flex items-center justify-center flex-shrink-0">
                  {(processo.tags || []).length}
                </span>
              )}
            </button>
          )}

          {podeComentar && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onComentarios(processo);
              }}
              className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-xs hover:bg-purple-200 transition-colors flex items-center gap-1 flex-shrink-0 relative"
              title="Comentários"
            >
              <MessageSquare size={10} />
              {(((processo as any).comentariosCount ?? (processo.comentarios || []).length) as number) > 0 && (
                <span className="text-[10px]">({(processo as any).comentariosCount ?? (processo.comentarios || []).length})</span>
              )}
              {verificarMencoesNaoLidasPorNotificacoes(notificacoes as any, processo.id) && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white animate-pulse" />
              )}
            </button>
          )}

          {podeExcluirProcesso && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                void onExcluir(processo.id);
              }}
              className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs hover:bg-red-200 transition-colors flex items-center gap-1 flex-shrink-0"
              title="Excluir processo"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Painel de edição inline */}
      {editando && (
        <div className="bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-600 rounded-lg p-3 mb-3 space-y-2 shadow-md" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Empresa</label>
            <input
              type="text"
              value={editNomeEmpresa}
              onChange={(e) => setEditNomeEmpresa(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-500 rounded bg-gray-50 dark:bg-gray-600 text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Responsável</label>
            <select
              value={editResponsavelId || ''}
              onChange={(e) => setEditResponsavelId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-500 rounded bg-gray-50 dark:bg-gray-600 text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-blue-400"
            >
              <option value="">Sem responsável</option>
              {(usuarios || []).filter(u => u.ativo !== false).map(u => {
                const departamentoId = Number((u as any).departamentoId ?? (u as any).departamento_id);
                const departamentoNome =
                  Number.isFinite(departamentoId) && departamentoId > 0
                    ? departamentos.find(d => d.id === departamentoId)?.nome || ''
                    : '';

                return (
                  <option key={u.id} value={u.id}>
                    {u.nome}{departamentoNome ? ` (${departamentoNome})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button
              onClick={handleSaveEdit}
              disabled={salvandoEdit}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium disabled:opacity-50"
            >
              <Save size={10} />
              {salvandoEdit ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setEditando(false); }}
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded text-xs hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="relative">
          {podeEditarProcesso ? (
            <>
              <select
                value={prioridade}
                onChange={async (e) => {
                  e.stopPropagation();
                  const novoValor = e.target.value as any;
                  const antigo = prioridade;
                  // atualização otimista localmente
                  setPrioridade(novoValor);
                  try {
                    console.debug('[ProcessoCard] atualizando prioridade', { id: processo.id, de: antigo, para: novoValor, role: usuarioLogado?.role, isDeptDoUsuario });
                    await atualizarProcesso(processo.id, { prioridade: novoValor });
                  } catch (err: any) {
                    // reverter em caso de erro
                    setPrioridade(antigo);
                    console.error('Erro ao atualizar prioridade:', err);
                    mostrarAlerta('Erro', err?.message || 'Falha ao atualizar prioridade', 'erro');
                  }
                }}
                className={`text-xs px-3 py-1 rounded-full border cursor-pointer appearance-none pr-8 font-semibold ${getPriorityColor(
                  prioridade
                )}`}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="baixa" className="text-green-900 bg-green-50">
                  BAIXA
                </option>
                <option value="media" className="text-yellow-900 bg-yellow-50">
                  MEDIA
                </option>
                <option value="alta" className="text-red-900 bg-red-50">
                  ALTA
                </option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <ChevronDown size={12} />
              </div>
            </>
            ) : (
            <span
              className={`text-xs px-3 py-1 rounded-full border font-semibold bg-white ${
                prioridade === 'alta' ? 'text-red-900 border-red-200' : prioridade === 'media' ? 'text-yellow-900 border-yellow-200' : 'text-green-900 border-green-200'
              }`}
              style={{ backgroundColor: '#fff' }}
            >
              {prioridade.toUpperCase()}
            </span>
          )}
        </div>

        <span className="text-xs text-gray-500">{statusLabel}</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
        <div
          className={`bg-gradient-to-r ${departamento?.cor || 'from-cyan-500 to-blue-600'} h-1.5 rounded-full transition-all duration-300`}
          style={{ width: `${progresso}%` }}
        ></div>
      </div>

      {/* Progresso por departamento (inclui interligações da cadeia) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="mb-2"
      >
        <ProgressoDeptsMini
          processoId={processo.id}
          departamentoAtualId={processo.departamentoAtual}
          maxInline={4}
        />
      </div>

      <p className="text-xs text-gray-500">Desde: {formatarData((processo.dataInicio || processo.criadoEm) as any)}</p>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {processo.status === 'em_andamento' && (
          <>
            {podeExibirAcoesNoCard && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuestionario(processo);
                  }}
                  className="col-span-2 w-full bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                  title="Abrir Questionário"
                >
                  <FileText size={10} />
                  Form
                </button>

              </>
            )}

            {podeExibirAcoesNoCard && podeMover && (
              <>
                {processo.deptIndependente ? (
                  /* Para processos paralelos: botão "Concluir Dept" em todos */
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void onAvancar(processo.id);
                    }}
                    className="col-span-2 w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-2 py-1 rounded text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <CheckCircle size={10} />
                    Concluir Dept ({fluxo.indexOf(departamento?.id) + 1}/{fluxo.length})
                  </button>
                ) : (
                  <>
                    {podeAvancarNoFluxo && !isUltimo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void onAvancar(processo.id);
                        }}
                        className="col-span-2 w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-2 py-1 rounded text-xs transition-colors flex items-center justify-center gap-1"
                      >
                        <ArrowRight size={10} />
                        Avançar{temFluxo ? ` (${idxAtual + 1}/${fluxo.length})` : ''}
                      </button>
                    )}

                    {isUltimo && podeFinalizar && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void onFinalizar(processo.id);
                        }}
                        className="col-span-2 w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white px-2 py-1 rounded text-xs transition-colors flex items-center justify-center gap-1"
                      >
                        <CheckCircle size={10} />
                        Finalizar
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {processo.status === 'finalizado' && (
          <>
            <div className="col-span-2 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-xs text-center flex items-center justify-center gap-2">
              <CheckCircle size={14} />
              <span className="font-medium">Processo Finalizado</span>
            </div>
            {podeVoltarAoDepartamento && (
              <button
                onClick={handleVoltarAoDepartamento}
                disabled={voltandoDept}
                className="col-span-2 w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Retornar ao departamento para poder interligar"
              >
                {voltandoDept ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <RotateCcw size={10} />
                )}
                {voltandoDept ? 'Retornando...' : 'Voltar ao Departamento'}
              </button>
            )}
          </>
        )}

        <div className="mt-3"></div>
      </div>
    </div>
  );
}
