'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit,
  FileText,
  Link2,
  Loader2,
  LogIn,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  Square,
  Tag,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import type { LogAuditoria, TipoAcaoLog } from '@/app/types';
import { api } from '@/app/utils/api';
import { isSuperUsuario } from '@/app/utils/permissions';

const ACOES_CONFIG: Record<TipoAcaoLog, { label: string; cor: string; icone: any }> = {
  CRIAR: { label: 'Criou', cor: 'bg-green-100 text-green-700', icone: Plus },
  EDITAR: { label: 'Editou', cor: 'bg-blue-100 text-blue-700', icone: Edit },
  EXCLUIR: { label: 'Excluiu', cor: 'bg-red-100 text-red-700', icone: Trash2 },
  VISUALIZAR: { label: 'Visualizou', cor: 'bg-gray-100 text-gray-600', icone: FileText },
  AVANCAR: { label: 'Avancou', cor: 'bg-cyan-100 text-cyan-700', icone: ArrowRight },
  VOLTAR: { label: 'Voltou', cor: 'bg-amber-100 text-amber-700', icone: ArrowLeft },
  FINALIZAR: { label: 'Finalizou', cor: 'bg-emerald-100 text-emerald-700', icone: CheckCircle },
  PREENCHER: { label: 'Preencheu', cor: 'bg-purple-100 text-purple-700', icone: Edit },
  COMENTAR: { label: 'Comentou', cor: 'bg-indigo-100 text-indigo-700', icone: MessageSquare },
  ANEXAR: { label: 'Anexou', cor: 'bg-teal-100 text-teal-700', icone: Upload },
  TAG: { label: 'Tag', cor: 'bg-pink-100 text-pink-700', icone: Tag },
  TRANSFERIR: { label: 'Transferiu', cor: 'bg-orange-100 text-orange-700', icone: ArrowRight },
  INTERLIGAR: { label: 'Interligou', cor: 'bg-violet-100 text-violet-700', icone: Link2 },
  CHECK: { label: 'Check', cor: 'bg-lime-100 text-lime-700', icone: CheckCircle },
  LOGIN: { label: 'Login', cor: 'bg-sky-100 text-sky-700', icone: LogIn },
  LOGOUT: { label: 'Logout', cor: 'bg-slate-100 text-slate-600', icone: LogOut },
  IMPORTAR: { label: 'Importou', cor: 'bg-fuchsia-100 text-fuchsia-700', icone: Upload },
};

type FiltroEntidade =
  | 'todos'
  | 'PROCESSO'
  | 'EMPRESA'
  | 'DEPARTAMENTO'
  | 'USUARIO'
  | 'TEMPLATE'
  | 'COMENTARIO'
  | 'DOCUMENTO'
  | 'TAG';

type FiltroStatus = 'todos' | 'ativos' | 'apagados';

export default function PainelLogs() {
  const { usuarioLogado, mostrarAlerta, mostrarConfirmacao } = useSistema();
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroAcao, setFiltroAcao] = useState<string>('todos');
  const [filtroEntidade, setFiltroEntidade] = useState<FiltroEntidade>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [expandido, setExpandido] = useState<number | null>(null);
  const [pagina, setPagina] = useState(1);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [modoSelecao, setModoSelecao] = useState(false);
  const POR_PAGINA = 50;

  const ehSuperUsuario = useMemo(() => isSuperUsuario(usuarioLogado ?? null), [usuarioLogado]);
  const roleLower = String(usuarioLogado?.role || '').toLowerCase();
  const podeVerLogs = ehSuperUsuario || roleLower === 'admin' || roleLower === 'admin_departamento';
  const podeExcluirLogs = roleLower === 'admin';

  const carregarLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getLogs?.();
      if (Array.isArray(data)) {
        setLogs(data);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (podeVerLogs) {
      void carregarLogs();
    }
  }, [carregarLogs, podeVerLogs]);

  useEffect(() => {
    if (!podeExcluirLogs && modoSelecao) {
      setModoSelecao(false);
      setSelecionados(new Set());
    }
  }, [modoSelecao, podeExcluirLogs]);

  const logsFiltrados = useMemo(() => {
    let filtered = [...logs];

    if (busca.trim()) {
      const termo = busca.toLowerCase();
      filtered = filtered.filter((l) =>
        [
          l.entidadeNome,
          l.detalhes,
          l.campo,
          l.valorNovo,
          l.valorAnterior,
          l.usuario?.nome,
          l.apagadoPorNome,
          l.apagadoMotivo,
        ]
          .filter(Boolean)
          .some((valor) => String(valor).toLowerCase().includes(termo))
      );
    }

    if (filtroAcao !== 'todos') {
      filtered = filtered.filter((l) => l.acao === filtroAcao);
    }

    if (filtroEntidade !== 'todos') {
      filtered = filtered.filter((l) => l.entidade === filtroEntidade);
    }

    if (filtroPeriodo !== 'todos') {
      const agora = new Date();
      let desde = new Date(0);
      if (filtroPeriodo === 'hoje') desde = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      if (filtroPeriodo === '7d') desde = new Date(agora.getTime() - 7 * 86400000);
      if (filtroPeriodo === '30d') desde = new Date(agora.getTime() - 30 * 86400000);
      filtered = filtered.filter((l) => new Date(l.criadoEm).getTime() >= desde.getTime());
    }

    if (ehSuperUsuario) {
      if (filtroStatus === 'ativos') {
        filtered = filtered.filter((l) => !l.apagado);
      } else if (filtroStatus === 'apagados') {
        filtered = filtered.filter((l) => l.apagado);
      }
    }

    return filtered.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
  }, [logs, busca, filtroAcao, filtroEntidade, filtroPeriodo, ehSuperUsuario, filtroStatus]);

  const logsPaginados = useMemo(() => {
    const inicio = (pagina - 1) * POR_PAGINA;
    return logsFiltrados.slice(inicio, inicio + POR_PAGINA);
  }, [logsFiltrados, pagina]);

  const totalPaginas = Math.ceil(logsFiltrados.length / POR_PAGINA);

  const formatarData = (data: Date | string | null | undefined) => {
    if (!data) return '-';
    const d = new Date(data);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const toggleSelecionado = useCallback((id: number) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selecionarTodosPagina = useCallback(() => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      const idsPagina = logsPaginados.filter((log) => !log.apagado).map((log) => log.id);
      const todosSelecionados = idsPagina.every((id) => next.has(id));
      if (todosSelecionados) idsPagina.forEach((id) => next.delete(id));
      else idsPagina.forEach((id) => next.add(id));
      return next;
    });
  }, [logsPaginados]);

  const selecionarTodosFiltrados = useCallback(() => {
    const ids = logsFiltrados.filter((log) => !log.apagado).map((log) => log.id);
    setSelecionados((prev) => {
      const todosSelecionados = ids.length > 0 && ids.every((id) => prev.has(id));
      return todosSelecionados ? new Set() : new Set(ids);
    });
  }, [logsFiltrados]);

  const limparSelecao = useCallback(() => {
    setSelecionados(new Set());
    setModoSelecao(false);
  }, []);

  const todosPaginaSelecionados = useMemo(() => {
    const idsPagina = logsPaginados.filter((log) => !log.apagado).map((log) => log.id);
    if (idsPagina.length === 0) return false;
    return idsPagina.every((id) => selecionados.has(id));
  }, [logsPaginados, selecionados]);

  const excluirSelecionados = async () => {
    if (selecionados.size === 0) return;
    if (!podeExcluirLogs) {
      await mostrarAlerta?.('Permissao negada', 'Apenas administradores podem excluir logs.', 'aviso');
      return;
    }

    const confirmou = await mostrarConfirmacao?.({
      titulo: 'Excluir logs selecionados',
      mensagem:
        selecionados.size === 1
          ? 'Deseja realmente excluir esse log?'
          : `${selecionados.size} logs selecionados. Deseja realmente excluir esses ${selecionados.size} logs?`,
      tipo: 'perigo',
      textoConfirmar: 'Excluir',
      textoCancelar: 'Cancelar',
    });

    if (!confirmou) return;

    setExcluindo(true);
    try {
      const resultado = await api.deleteLogs?.({ ids: Array.from(selecionados) });
      await carregarLogs();
      setSelecionados(new Set());
      setModoSelecao(false);
      await mostrarAlerta?.(
        'Logs excluidos',
        (resultado as any)?.message || `${resultado?.deletados || 0} log(s) excluido(s) com sucesso.`,
        'sucesso'
      );
    } catch (error: any) {
      await mostrarAlerta?.(
        'Erro ao excluir logs',
        error?.message || 'Nao foi possivel excluir os logs selecionados.',
        'erro'
      );
    } finally {
      setExcluindo(false);
    }
  };

  if (!podeVerLogs) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
        <AlertTriangle className="mx-auto text-amber-500 mb-4" size={48} />
        <h3 className="text-xl font-bold text-gray-900">Acesso Restrito</h3>
        <p className="text-gray-600 mt-2">Apenas administradores e o ghost podem ver o historico de logs.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-2xl shadow-xl border border-gray-100 dark:border-[var(--border)] p-4 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--fg)] flex items-center gap-2">
            <ScrollText size={24} /> Historico de Logs
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Registro detalhado de todas as acoes do sistema ({logsFiltrados.length} registros)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {podeExcluirLogs && (
            <button
              onClick={() => {
                if (modoSelecao) limparSelecao();
                else setModoSelecao(true);
              }}
              className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition text-sm ${
                modoSelecao
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {modoSelecao ? <XCircle size={16} /> : <CheckSquare size={16} />}
              {modoSelecao ? 'Cancelar' : 'Selecionar'}
            </button>
          )}
          {podeExcluirLogs && modoSelecao && selecionados.size > 0 && (
            <button
              onClick={excluirSelecionados}
              disabled={excluindo}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium flex items-center gap-2 transition text-sm disabled:opacity-50"
            >
              {excluindo ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Excluir ({selecionados.size})
            </button>
          )}
          <button
            onClick={() => void carregarLogs()}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-gray-700 flex items-center gap-2 transition text-sm dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Atualizar
          </button>
        </div>
      </div>

     

      {podeExcluirLogs && modoSelecao && logsFiltrados.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-900/20 sm:flex-row sm:items-center sm:gap-3">
          <button
            onClick={selecionarTodosPagina}
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {todosPaginaSelecionados ? 'Desmarcar pagina' : 'Selecionar pagina'}
          </button>
          <span className="text-gray-400">|</span>
          <button
            onClick={selecionarTodosFiltrados}
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Selecionar todos os {logsFiltrados.filter((log) => !log.apagado).length} ativos filtrados
          </button>
          {selecionados.size > 0 && (
            <>
              <span className="text-gray-400">|</span>
              <span className="text-sm text-gray-600 dark:text-gray-300">{selecionados.size} selecionado(s)</span>
            </>
          )}
        </div>
      )}

      <div className={`grid grid-cols-1 gap-3 mb-6 ${ehSuperUsuario ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar nos logs..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        <select
          value={filtroAcao}
          onChange={(e) => {
            setFiltroAcao(e.target.value);
            setPagina(1);
          }}
          className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="todos">Todas as acoes</option>
          {Object.entries(ACOES_CONFIG).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filtroEntidade}
          onChange={(e) => {
            setFiltroEntidade(e.target.value as FiltroEntidade);
            setPagina(1);
          }}
          className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="todos">Todas as entidades</option>
          <option value="PROCESSO">Processos</option>
          <option value="EMPRESA">Empresas</option>
          <option value="DEPARTAMENTO">Departamentos</option>
          <option value="USUARIO">Usuarios</option>
          <option value="TEMPLATE">Templates</option>
          <option value="COMENTARIO">Comentarios</option>
          <option value="DOCUMENTO">Documentos</option>
          <option value="TAG">Tags</option>
        </select>

        <select
          value={filtroPeriodo}
          onChange={(e) => {
            setFiltroPeriodo(e.target.value);
            setPagina(1);
          }}
          className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="todos">Todo o periodo</option>
          <option value="hoje">Hoje</option>
          <option value="7d">Ultimos 7 dias</option>
          <option value="30d">Ultimos 30 dias</option>
        </select>

        {ehSuperUsuario && (
          <select
            value={filtroStatus}
            onChange={(e) => {
              setFiltroStatus(e.target.value as FiltroStatus);
              setPagina(1);
            }}
            className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="todos">Ativos + apagados</option>
            <option value="ativos">Somente ativos</option>
            <option value="apagados">Somente apagados</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 size={32} className="animate-spin mx-auto text-indigo-500 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Carregando logs...</p>
        </div>
      ) : logsFiltrados.length === 0 ? (
        <div className="text-center py-12">
          <ScrollText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Nenhum log encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logsPaginados.map((log) => {
            const config = ACOES_CONFIG[log.acao] || ACOES_CONFIG.EDITAR;
            const Icone = config.icone;
            const isExpanded = expandido === log.id;
            const isSelecionado = selecionados.has(log.id);

            return (
              <div
                key={log.id}
                className={`border rounded-xl transition-all ${
                  log.apagado
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/10'
                    : isSelecionado
                      ? 'border-red-300 dark:border-red-600 bg-red-50/30 dark:bg-red-900/10'
                      : isExpanded
                        ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50/30 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-stretch gap-1">
                  {podeExcluirLogs && modoSelecao && !log.apagado && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelecionado(log.id);
                      }}
                      className="pl-3 pr-1 py-3 shrink-0"
                    >
                      {isSelecionado ? (
                        <CheckSquare size={18} className="text-red-500" />
                      ) : (
                        <Square size={18} className="text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setExpandido(isExpanded ? null : log.id)}
                    className={`flex-1 p-3 text-left ${!podeExcluirLogs || !modoSelecao || log.apagado ? '' : 'pl-1'}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className={`shrink-0 rounded-lg p-2 ${log.apagado ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : config.cor}`}>
                        <Icone size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                            {log.usuario?.nome || 'Sistema'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.apagado ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : config.cor}`}>
                            {config.label}
                          </span>
                          {log.apagado && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              Apagado
                            </span>
                          )}
                          <span className="text-sm text-gray-600 dark:text-gray-300">
                            {log.entidade?.toLowerCase()}{' '}
                            {log.entidadeNome && <span className="font-medium">&ldquo;{log.entidadeNome}&rdquo;</span>}
                          </span>
                          {log.campo && (
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                              {log.campo}
                            </span>
                          )}
                        </div>
                        {(log.valorAnterior || log.valorNovo) && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                            {log.valorAnterior && (
                              <span
                                className="max-w-[200px] truncate rounded bg-red-50 px-1.5 py-0.5 text-red-600 line-through dark:bg-red-900/30 dark:text-red-400"
                                title={log.valorAnterior}
                              >
                                {log.valorAnterior}
                              </span>
                            )}
                            {log.valorAnterior && log.valorNovo && <ArrowRight size={10} className="shrink-0 text-gray-400" />}
                            {log.valorNovo && (
                              <span
                                className="max-w-[200px] truncate rounded bg-green-50 px-1.5 py-0.5 font-medium text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                title={log.valorNovo}
                              >
                                {log.valorNovo}
                              </span>
                            )}
                          </div>
                        )}
                        {!log.valorAnterior && !log.valorNovo && log.detalhes && (
                          <p className="mt-0.5 max-w-[600px] truncate text-xs text-gray-500 dark:text-gray-400">
                            {log.detalhes}
                          </p>
                        )}
                        {log.apagado && (
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                            Apagado por {log.apagadoPorNome || 'Administrador'} em {formatarData(log.apagadoEm)}.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                        <div className="flex items-center gap-1 whitespace-nowrap text-xs text-gray-400">
                          <Clock size={12} />
                          {formatarData(log.criadoEm)}
                        </div>
                        {isExpanded ? (
                          <ChevronUp size={16} className="shrink-0 text-gray-400 sm:ml-auto" />
                        ) : (
                          <ChevronDown size={16} className="shrink-0 text-gray-400 sm:ml-auto" />
                        )}
                      </div>
                    </div>
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 mt-1 pt-3 space-y-3">
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Usuario:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {log.usuario?.nome} ({log.usuario?.email})
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Data/Hora:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">{formatarData(log.criadoEm)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Entidade:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {log.entidade} {log.entidadeId ? `#${log.entidadeId}` : ''}
                        </span>
                      </div>
                      {log.processoId ? (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Processo ID:</span>{' '}
                          <span className="font-medium text-gray-900 dark:text-gray-100">#{log.processoId}</span>
                        </div>
                      ) : null}
                      {log.empresaId ? (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Empresa ID:</span>{' '}
                          <span className="font-medium text-gray-900 dark:text-gray-100">#{log.empresaId}</span>
                        </div>
                      ) : null}
                      {log.apagado && (
                        <>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Apagado por:</span>{' '}
                            <span className="font-medium text-gray-900 dark:text-gray-100">{log.apagadoPorNome || 'Administrador'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Apagado em:</span>{' '}
                            <span className="font-medium text-gray-900 dark:text-gray-100">{formatarData(log.apagadoEm)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {log.apagadoMotivo && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                        <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Motivo da exclusao</div>
                        <p className="text-sm text-amber-800 dark:text-amber-200 whitespace-pre-wrap">{log.apagadoMotivo}</p>
                      </div>
                    )}

                    {(log.valorAnterior || log.valorNovo) && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1">
                          <Edit size={12} /> Alteracao{log.campo ? ` no campo: ${log.campo}` : ''}
                        </div>
                        <div className="space-y-1.5">
                          {log.valorAnterior && (
                            <div className="flex items-start gap-2 text-sm">
                              <span className="text-red-500 font-semibold shrink-0 w-14">Antes:</span>
                              <span className="text-gray-700 dark:text-gray-200 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded border border-red-200 dark:border-red-800 break-all">
                                {log.valorAnterior}
                              </span>
                            </div>
                          )}
                          {log.valorNovo && (
                            <div className="flex items-start gap-2 text-sm">
                              <span className="text-green-500 font-semibold shrink-0 w-14">Depois:</span>
                              <span className="text-gray-700 dark:text-gray-200 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded border border-green-200 dark:border-green-800 break-all">
                                {log.valorNovo}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {log.detalhes && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Detalhes completos</div>
                        <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{log.detalhes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="mt-6 flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Pagina {pagina} de {totalPaginas} ({logsFiltrados.length} registros)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagina(Math.max(1, pagina - 1))}
              disabled={pagina === 1}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Anterior
            </button>
            <button
              onClick={() => setPagina(Math.min(totalPaginas, pagina + 1))}
              disabled={pagina === totalPaginas}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Proxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
