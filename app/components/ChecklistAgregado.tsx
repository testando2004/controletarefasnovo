'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Link2, Circle, Clock, MessageSquare, Save, X, Trash2 } from 'lucide-react';
import { api } from '@/app/utils/api';

interface DetalheProcesso {
  processoId: number;
  processoNome: string;
  concluido: boolean;
  concluidoEm: string | null;
  atual: boolean;
}

interface AgregadoItem {
  departamentoId: number;
  departamentoNome: string;
  total: number;
  concluidos: number;
  progresso: number;
  detalhes: DetalheProcesso[];
  observacao?: string | null;
}

interface ChecklistAgregadoProps {
  /** Agregação seguindo a cadeia de interligações a partir deste processo. */
  processoId?: number;
  /** Agregação de todas as solicitações vinculadas a este projeto (dossiê). */
  projetoId?: number;
}

export default function ChecklistAgregado({ processoId, projetoId }: ChecklistAgregadoProps) {
  const [loading, setLoading] = useState(true);
  const [agregado, setAgregado] = useState<AgregadoItem[]>([]);
  const [listaProcessos, setListaProcessos] = useState<Array<{ id: number; nome: string }>>([]);
  const [deptExpandido, setDeptExpandido] = useState<number | null>(null);
  const [editandoObs, setEditandoObs] = useState<number | null>(null);
  const [textoObs, setTextoObs] = useState('');
  const [salvandoObs, setSalvandoObs] = useState(false);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    (async () => {
      try {
        const url = typeof projetoId === 'number' && projetoId > 0
          ? `/api/projetos/${projetoId}/checklist-agregado`
          : typeof processoId === 'number' && processoId > 0
            ? `/api/processos/${processoId}/checklist-agregado`
            : null;
        if (!url) { if (ativo) { setAgregado([]); setLoading(false); } return; }

        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
          if (ativo) setAgregado([]);
          return;
        }
        const data = await res.json();
        if (!ativo) return;
        setAgregado(Array.isArray(data?.agregado) ? data.agregado : []);
        setListaProcessos(Array.isArray(data?.processos) ? data.processos : []);
      } catch {
        if (ativo) setAgregado([]);
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [processoId, projetoId]);

  const podeEditarObs = typeof projetoId === 'number' && projetoId > 0;

  const abrirEditor = (item: AgregadoItem) => {
    setEditandoObs(item.departamentoId);
    setTextoObs(item.observacao || '');
  };

  const fecharEditor = () => {
    setEditandoObs(null);
    setTextoObs('');
  };

  const salvarObs = async (deptId: number, novoTexto: string | null) => {
    if (!projetoId) return;
    try {
      setSalvandoObs(true);
      await api.atualizarObservacaoDepartamento(projetoId, deptId, novoTexto);
      setAgregado((prev) => prev.map((it) =>
        it.departamentoId === deptId
          ? { ...it, observacao: novoTexto && novoTexto.trim() ? novoTexto.trim() : null }
          : it
      ));
      fecharEditor();
    } catch (e) {
      // erro já é logado pelo helper
    } finally {
      setSalvandoObs(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Calculando progresso agregado das solicitações interligadas...
      </div>
    );
  }

  if (agregado.length === 0) return null;

  const temInterligacoes = listaProcessos.length > 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Link2 className="w-4 h-4 text-indigo-500" />
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Progresso agregado por departamento
        </h4>
        {temInterligacoes && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            {listaProcessos.length} solicitações interligadas
          </span>
        )}
      </div>

      {temInterligacoes && (
        <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-900/70 rounded-lg px-3 py-2 border border-gray-200 dark:border-slate-700">
          Cada departamento mostra o progresso consolidado entre todas as solicitações interligadas desta cadeia.
        </p>
      )}

      <div className="space-y-2">
        {agregado.map((item) => {
          const expandido = deptExpandido === item.departamentoId;
          const editando = editandoObs === item.departamentoId;
          const temObs = !!(item.observacao && item.observacao.trim());
          const cor =
            item.progresso === 100
              ? 'from-green-500 to-emerald-600'
              : item.progresso >= 75
                ? 'from-lime-500 to-green-500'
                : item.progresso >= 50
                  ? 'from-yellow-500 to-amber-500'
                  : item.progresso > 0
                    ? 'from-orange-400 to-orange-500'
                    : 'from-gray-300 to-gray-400';
          return (
            <div
              key={item.departamentoId}
              className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden"
            >
              <div className="flex items-stretch bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setDeptExpandido(expandido ? null : item.departamentoId)}
                  className="flex-1 flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 transition text-left min-w-0"
                >
                  {item.progresso === 100 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 justify-between">
                      <span className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">
                        {item.departamentoNome}
                      </span>
                      <span className="text-xs font-semibold text-gray-600 dark:text-slate-300 flex-shrink-0">
                        {item.concluidos}/{item.total} • {item.progresso}%
                      </span>
                    </div>
                    <div className="mt-1 w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${cor} rounded-full transition-all duration-500`}
                        style={{ width: `${item.progresso}%` }}
                      />
                    </div>
                    {temObs && !editando && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded px-2 py-1">
                        <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2 break-words">{item.observacao}</span>
                      </div>
                    )}
                  </div>
                </button>

                {podeEditarObs && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editando) {
                        fecharEditor();
                      } else {
                        abrirEditor(item);
                      }
                    }}
                    title={temObs ? 'Editar observação' : 'Adicionar observação'}
                    className={`px-3 flex items-center justify-center transition border-l border-gray-200 dark:border-slate-700 ${
                      temObs
                        ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                        : 'text-gray-400 hover:text-indigo-500 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <MessageSquare className={`w-4 h-4 ${temObs ? 'fill-amber-100 dark:fill-amber-900/40' : ''}`} />
                  </button>
                )}
              </div>

              {editando && (
                <div className="bg-gray-50 dark:bg-slate-900/70 border-t border-gray-200 dark:border-slate-700 p-3 space-y-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Observação para {item.departamentoNome}
                  </label>
                  <textarea
                    value={textoObs}
                    onChange={(e) => setTextoObs(e.target.value)}
                    placeholder="Ex: aguardando contrato social do cliente..."
                    rows={2}
                    autoFocus
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <div className="flex items-center justify-between gap-2">
                    {temObs ? (
                      <button
                        type="button"
                        onClick={() => salvarObs(item.departamentoId, null)}
                        disabled={salvandoObs}
                        className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1.5 rounded flex items-center gap-1 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remover
                      </button>
                    ) : <span />}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={fecharEditor}
                        disabled={salvandoObs}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center gap-1 disabled:opacity-50"
                      >
                        <X className="w-3 h-3" />
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => salvarObs(item.departamentoId, textoObs)}
                        disabled={salvandoObs}
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1 disabled:opacity-50"
                      >
                        {salvandoObs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {expandido && !editando && (
                <div className="bg-gray-50 dark:bg-slate-900/70 border-t border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-800">
                  {item.detalhes.map((d, idx) => (
                    <div
                      key={`${d.processoId}-${idx}`}
                      className="flex items-center gap-2 px-3 py-2 text-xs"
                    >
                      {d.concluido ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      ) : d.atual ? (
                        <Clock className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                      )}
                      <span className="flex-1 truncate text-gray-700 dark:text-slate-200" title={d.processoNome}>
                        {d.processoNome}
                      </span>
                      {d.atual && !d.concluido && (
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-medium">
                          ATUAL
                        </span>
                      )}
                      {d.concluido && d.concluidoEm && (
                        <span className="text-[10px] text-gray-400">
                          {new Date(d.concluidoEm).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
