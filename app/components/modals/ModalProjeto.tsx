'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  FolderOpen,
  Building2,
  Calendar,
  User as UserIcon,
  Edit3,
  Save,
  Trash2,
  CheckCircle2,
  Clock,
  Pause,
  XCircle,
  FileText,
  ArrowRight,
  Link2,
  ChevronDown,
} from 'lucide-react';
import { api } from '@/app/utils/api';
import { useSistema } from '@/app/context/SistemaContext';
import type { Projeto, StatusProjeto } from '@/app/types';
import { formatarData } from '@/app/utils/helpers';
import LoadingOverlay from '@/app/components/LoadingOverlay';
import ChecklistAgregado from '@/app/components/ChecklistAgregado';

interface ModalProjetoProps {
  projetoId: number;
  onClose: () => void;
  onAbrirProcesso?: (processoId: number) => void;
}

const STATUS_CONFIG: Record<StatusProjeto, { label: string; cor: string; icone: any }> = {
  EM_ANDAMENTO: { label: 'Em Andamento', cor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icone: Clock },
  CONCLUIDO:    { label: 'Concluído',    cor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icone: CheckCircle2 },
  PAUSADO:      { label: 'Pausado',      cor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icone: Pause },
  CANCELADO:    { label: 'Cancelado',    cor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icone: XCircle },
};

const STATUS_PROCESSO_LABEL: Record<string, { label: string; cor: string }> = {
  em_andamento: { label: 'Em Andamento', cor: 'bg-blue-100 text-blue-700' },
  finalizado:   { label: 'Finalizado',   cor: 'bg-green-100 text-green-700' },
  pausado:      { label: 'Pausado',      cor: 'bg-yellow-100 text-yellow-700' },
  cancelado:    { label: 'Cancelado',    cor: 'bg-red-100 text-red-700' },
  rascunho:     { label: 'Rascunho',     cor: 'bg-gray-100 text-gray-700' },
};

export default function ModalProjeto({ projetoId, onClose, onAbrirProcesso }: ModalProjetoProps) {
  const { departamentos, usuarios, empresas, mostrarAlerta, mostrarConfirmacao, adicionarNotificacao, usuarioLogado } = useSistema();

  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Estado de edição
  const [edNome, setEdNome] = useState('');
  const [edDescricao, setEdDescricao] = useState('');
  const [edEmpresaId, setEdEmpresaId] = useState<number | ''>('');
  const [edResponsavelId, setEdResponsavelId] = useState<number | ''>('');
  const [edDataEntrega, setEdDataEntrega] = useState('');
  const [edStatus, setEdStatus] = useState<StatusProjeto>('EM_ANDAMENTO');

  const carregar = async () => {
    try {
      setLoading(true);
      const dados = await api.getProjeto(projetoId);
      setProjeto(dados);
      setEdNome(dados.nome || '');
      setEdDescricao(dados.descricao || '');
      setEdEmpresaId(dados.empresaId ?? '');
      setEdResponsavelId(dados.responsavelId ?? '');
      setEdDataEntrega(dados.dataEntrega ? new Date(dados.dataEntrega).toISOString().slice(0, 10) : '');
      setEdStatus(dados.status || 'EM_ANDAMENTO');
    } catch (e: any) {
      adicionarNotificacao(e?.message || 'Erro ao carregar projeto', 'erro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId]);

  const salvarEdicoes = async () => {
    if (!edNome.trim()) {
      await mostrarAlerta('Atenção', 'Nome do projeto é obrigatório', 'aviso');
      return;
    }
    try {
      setSalvando(true);
      await api.atualizarProjeto(projetoId, {
        nome: edNome.trim(),
        descricao: edDescricao.trim() || null,
        empresaId: typeof edEmpresaId === 'number' ? edEmpresaId : null,
        responsavelId: typeof edResponsavelId === 'number' ? edResponsavelId : null,
        dataEntrega: edDataEntrega || null,
        status: edStatus,
      });
      adicionarNotificacao('Projeto atualizado', 'sucesso');
      setEditando(false);
      await carregar();
    } catch (e: any) {
      await mostrarAlerta('Erro', e?.message || 'Erro ao atualizar', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const excluirProjeto = async () => {
    const opcao = await mostrarConfirmacao({
      titulo: 'Excluir projeto',
      mensagem: `Deseja realmente excluir o projeto "${projeto?.nome}"?\n\nAs solicitações vinculadas serão apenas desvinculadas (continuarão existindo).`,
      tipo: 'perigo',
      textoConfirmar: 'Sim, excluir',
      textoCancelar: 'Cancelar',
    });
    if (!opcao) return;
    try {
      setSalvando(true);
      await api.excluirProjeto(projetoId);
      adicionarNotificacao('Projeto excluído', 'sucesso');
      onClose();
    } catch (e: any) {
      await mostrarAlerta('Erro', e?.message || 'Erro ao excluir', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const st = projeto ? (STATUS_CONFIG[projeto.status] || STATUS_CONFIG.EM_ANDAMENTO) : STATUS_CONFIG.EM_ANDAMENTO;
  const StatusIcon = st.icone;

  const processos: any[] = (projeto as any)?.processos || [];
  const empresaNome = (projeto as any)?.empresa?.razao_social || (projeto as any)?.empresa?.codigo;
  const responsavelNome = (projeto as any)?.responsavel?.nome;

  // Agregado de progresso: concluídos/total
  const totalProc = processos.length;
  const finalizados = processos.filter((p: any) => String(p.status || '').toLowerCase() === 'finalizado').length;
  const pctProjeto = totalProc > 0 ? Math.round((finalizados / totalProc) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[1080] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
        <LoadingOverlay show={loading || salvando} text={salvando ? 'Salvando...' : 'Carregando projeto...'} />

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <FolderOpen className="text-white" size={24} />
              </div>
              <div className="min-w-0 flex-1">
                {!editando ? (
                  <>
                    <h2 className="text-xl font-bold text-white truncate" title={projeto?.nome}>
                      {projeto?.nome || '—'}
                    </h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`${st.cor} text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1`}>
                        <StatusIcon size={10} />
                        {st.label}
                      </span>
                      {empresaNome && (
                        <span className="text-white/90 text-xs flex items-center gap-1">
                          <Building2 size={12} />
                          {empresaNome}
                        </span>
                      )}
                      <span className="text-white/90 text-xs">
                        {finalizados}/{totalProc} solicitaç{totalProc === 1 ? 'ão' : 'ões'} finalizada{finalizados === 1 ? '' : 's'}
                      </span>
                    </div>
                  </>
                ) : (
                  <input
                    type="text"
                    value={edNome}
                    onChange={(e) => setEdNome(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-gray-900 text-lg font-bold"
                    placeholder="Nome do projeto"
                  />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!editando ? (
                <button
                  onClick={() => setEditando(true)}
                  className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg"
                  title="Editar projeto"
                >
                  <Edit3 size={18} />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setEditando(false); if (projeto) { setEdNome(projeto.nome); setEdDescricao(projeto.descricao || ''); setEdStatus(projeto.status); } }}
                    className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={salvarEdicoes}
                    className="bg-white text-indigo-700 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    Salvar
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Barra de progresso do projeto */}
          <div className="mt-3 w-full bg-white/20 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${pctProjeto}%` }}
            />
          </div>
          <div className="text-right text-xs text-white/90 mt-1">{pctProjeto}% concluído</div>
        </div>

        <div className="p-6 space-y-6">
          {/* Infos do projeto */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {!editando ? (
              <>
                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Empresa</div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {empresaNome || '—'}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Responsável</div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100 flex items-center gap-1">
                    <UserIcon size={14} className="text-gray-400" />
                    {responsavelNome || '—'}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Prazo</div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100 flex items-center gap-1">
                    <Calendar size={14} className="text-gray-400" />
                    {projeto?.dataEntrega ? formatarData(projeto.dataEntrega as any) : '—'}
                  </div>
                </div>
                {projeto?.descricao && (
                  <div className="md:col-span-3 bg-gray-50 dark:bg-slate-900 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Descrição</div>
                    <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                      {projeto.descricao}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-gray-600 mb-1 font-medium">Empresa</label>
                  <select
                    value={edEmpresaId}
                    onChange={(e) => setEdEmpresaId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg text-sm"
                  >
                    <option value="">—</option>
                    {(empresas || []).map((e: any) => (
                      <option key={e.id} value={e.id}>{e.razao_social || e.codigo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1 font-medium">Responsável</label>
                  <select
                    value={edResponsavelId}
                    onChange={(e) => setEdResponsavelId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg text-sm"
                  >
                    <option value="">—</option>
                    {(usuarios || []).filter((u: any) => u.ativo !== false).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1 font-medium">Prazo</label>
                  <input
                    type="date"
                    value={edDataEntrega}
                    onChange={(e) => setEdDataEntrega(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg text-sm"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-600 mb-1 font-medium">Descrição</label>
                  <textarea
                    value={edDescricao}
                    onChange={(e) => setEdDescricao(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1 font-medium">Status</label>
                  <select
                    value={edStatus}
                    onChange={(e) => setEdStatus(e.target.value as StatusProjeto)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg text-sm"
                  >
                    <option value="EM_ANDAMENTO">Em Andamento</option>
                    <option value="CONCLUIDO">Concluído</option>
                    <option value="PAUSADO">Pausado</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Progresso por departamento */}
          <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-gray-200 dark:border-[var(--border)] p-4">
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">
              Progresso consolidado por departamento
            </h4>
            <ChecklistAgregado projetoId={projetoId} />
          </div>

          {/* Lista de solicitações */}
          <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-gray-200 dark:border-[var(--border)] p-4">
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Link2 size={16} className="text-indigo-500" />
                Solicitações do projeto
              </span>
              <span className="text-xs text-gray-500 font-normal">
                {processos.length} total • {finalizados} finalizada{finalizados === 1 ? '' : 's'}
              </span>
            </h4>

            {processos.length === 0 ? (
              <div className="text-center py-8">
                <FileText size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">Nenhuma solicitação vinculada a este projeto ainda.</p>
                <p className="text-xs text-gray-400 mt-1">Ao criar uma nova solicitação, selecione este projeto para vinculá-la.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {processos.map((proc: any) => {
                  const statusKey = String(proc.status || '').toLowerCase();
                  const stCfg = STATUS_PROCESSO_LABEL[statusKey] || STATUS_PROCESSO_LABEL.em_andamento;
                  const fluxoLen = Array.isArray(proc.fluxoDepartamentos) ? proc.fluxoDepartamentos.length : 0;
                  const idxAtual = Number(proc.departamentoAtualIndex ?? 0);
                  const pct = typeof proc.progresso === 'number'
                    ? proc.progresso
                    : (fluxoLen > 0 ? Math.round(((idxAtual + 1) / fluxoLen) * 100) : 0);
                  const deptAtual = departamentos.find((d: any) => d.id === proc.departamentoAtual);
                  return (
                    <button
                      key={proc.id}
                      type="button"
                      onClick={() => onAbrirProcesso?.(proc.id)}
                      className="w-full text-left bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg border border-gray-200 dark:border-[var(--border)] p-3 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                            {proc.nomeServico || proc.nome || proc.nomeEmpresa || `#${proc.id}`}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                            <span className={`${stCfg.cor} px-1.5 py-0.5 rounded-full text-[10px] font-medium`}>
                              {stCfg.label}
                            </span>
                            {deptAtual && statusKey !== 'finalizado' && (
                              <span className="flex items-center gap-1">
                                <ArrowRight size={10} />
                                {deptAtual.nome}
                              </span>
                            )}
                            {proc.dataEntrega && (
                              <span className="flex items-center gap-1">
                                <Calendar size={10} />
                                {formatarData(proc.dataEntrega as any)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="text-xs font-bold text-gray-700 dark:text-gray-200">{pct}%</div>
                          <div className="w-20 h-1 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-[var(--border)]">
            <button
              onClick={excluirProjeto}
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              Excluir projeto
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
