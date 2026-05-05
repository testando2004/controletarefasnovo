'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Loader2, Lock, AlertCircle } from 'lucide-react';

interface ChecklistItem {
  departamentoId: number;
  departamentoNome: string;
  concluido: boolean;
  observacao?: string;
  concluidoEm?: string;
  responsavelNome?: string;
}

interface ChecklistFluxoProps {
  processoId: number;
  fluxoDepartamentos: number[];
  departamentos: any[];
  departamentoAtual: number;
  deptIndependente?: boolean;
  /** Dependências customizadas (Fase 3). Se presente, sobrescreve a ordem sequencial. */
  dependenciasDept?: Record<string, string[]>;
  readOnly?: boolean;
}

async function fetchChecklistGet(processoId: number) {
  try {
    const res = await fetch(`/api/processos/${processoId}/checklist`, {
      credentials: 'include',
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function fetchChecklistPost(processoId: number, data: any) {
  try {
    const res = await fetch(`/api/processos/${processoId}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || 'Erro ao salvar' };
    }
    return await res.json();
  } catch {
    return { error: 'Erro de conexão' };
  }
}

export default function ChecklistFluxo({
  processoId,
  fluxoDepartamentos,
  departamentos,
  departamentoAtual,
  deptIndependente,
  dependenciasDept,
  readOnly,
}: ChecklistFluxoProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const data = await fetchChecklistGet(processoId);
      if (!active) return;

      const checklistMap = new Map<number, any>();
      (Array.isArray(data) ? data : []).forEach((item: any) => {
        const deptId = Number(item.departamentoId);
        if (Number.isFinite(deptId) && deptId > 0) {
          checklistMap.set(deptId, item);
        }
      });

      const fluxoNormalizado = (Array.isArray(fluxoDepartamentos) ? fluxoDepartamentos : [])
        .map((deptId) => Number(deptId))
        .filter((deptId) => Number.isFinite(deptId) && deptId > 0);

      const checklist: ChecklistItem[] = fluxoNormalizado.map((deptId) => {
        const checklistEntry = checklistMap.get(deptId);
        const dept = departamentos.find((d: any) => d.id === deptId);
        return {
          departamentoId: deptId,
          departamentoNome: dept?.nome || `Dept #${deptId}`,
          concluido: !!checklistEntry?.concluido,
          observacao: checklistEntry?.observacao || '',
          concluidoEm: checklistEntry?.concluidoEm,
          // Responsável: usa o campo da checklist (gerente no momento da criação),
          // ou fallback para o campo "responsavel" do departamento
          responsavelNome: checklistEntry?.responsavelNome || dept?.responsavel || undefined,
        };
      });

      setItems(checklist);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [processoId, fluxoDepartamentos, departamentos]);

  const temDependenciasCustomizadas = Boolean(
    dependenciasDept && typeof dependenciasDept === 'object' && Object.keys(dependenciasDept).length > 0
  );

  // Retorna a chave da etapa no formato "deptId" (1ª ocorrência) ou "deptId:N" (demais)
  const chaveEtapa = (idx: number): string => {
    const deptId = fluxoDepartamentos[idx];
    let ocorrencia = 0;
    for (let i = 0; i <= idx; i++) if (fluxoDepartamentos[i] === deptId) ocorrencia++;
    return ocorrencia === 1 ? String(deptId) : `${deptId}:${ocorrencia}`;
  };

  // Resolve as dependências configuradas para uma etapa
  const getDependencias = (idx: number): string[] => {
    if (!temDependenciasCustomizadas) return [];
    const chave = chaveEtapa(idx);
    const raw = dependenciasDept?.[chave] ?? dependenciasDept?.[String(fluxoDepartamentos[idx])];
    return Array.isArray(raw) ? raw : [];
  };

  // Lógica: se há dependências customizadas, todas precisam estar concluídas. Senão, ordem sequencial.
  const podeDarCheck = (idx: number): boolean => {
    if (readOnly) return false;
    if (temDependenciasCustomizadas) {
      const deps = getDependencias(idx);
      if (deps.length === 0) return true; // etapa livre
      return deps.every((depChave) => {
        // Encontra o item cujo fluxoDepartamentos.indexOf bate com o deptId da dep
        const depDeptId = Number(String(depChave).split(':')[0]);
        const item = items.find((it) => it.departamentoId === depDeptId);
        return item?.concluido === true;
      });
    }
    if (idx === 0) return true;
    return items[idx - 1]?.concluido === true;
  };

  // Quem está bloqueando este departamento
  const getBloqueadoPor = (idx: number): string | null => {
    if (temDependenciasCustomizadas) {
      const deps = getDependencias(idx);
      for (const depChave of deps) {
        const depDeptId = Number(String(depChave).split(':')[0]);
        const item = items.find((it) => it.departamentoId === depDeptId);
        if (!item?.concluido) {
          return item?.departamentoNome || `Dept #${depDeptId}`;
        }
      }
      return null;
    }
    if (idx === 0) return null;
    for (let i = idx - 1; i >= 0; i--) {
      if (!items[i]?.concluido) {
        return items[i]?.departamentoNome || `Dept #${i + 1}`;
      }
    }
    return null;
  };

  const toggleConcluido = async (deptId: number) => {
    if (readOnly) return;
    setErro(null);

    const idx = items.findIndex(i => i.departamentoId === deptId);
    if (idx === -1) return;

    // Verificação sequencial: não pode dar check se anterior não checou
    if (!items[idx].concluido && !podeDarCheck(idx)) {
      const bloqueador = getBloqueadoPor(idx);
      setErro(`${items[idx].departamentoNome} não pode finalizar antes de "${bloqueador}" dar check.`);
      setTimeout(() => setErro(null), 4000);
      return;
    }

    // Verificação: não pode desmarcar se algum dept que depende deste já está marcado
    if (items[idx].concluido) {
      if (temDependenciasCustomizadas) {
        // Acha qualquer etapa que lista este dept como dependência e já está concluída
        const chaveDeste = chaveEtapa(idx);
        const deptDesteStr = String(items[idx].departamentoId);
        const bloqueadores = items.filter((it, i) => {
          if (i === idx || !it.concluido) return false;
          const depsDesta = getDependencias(i);
          return depsDesta.includes(chaveDeste) || depsDesta.includes(deptDesteStr);
        });
        if (bloqueadores.length > 0) {
          setErro(
            `Não pode desmarcar "${items[idx].departamentoNome}" porque "${bloqueadores[0].departamentoNome}" depende dele e já está com check.`
          );
          setTimeout(() => setErro(null), 4000);
          return;
        }
      } else {
        // Regra antiga: desmarcar só se o próximo não estiver marcado
        if (idx < items.length - 1 && items[idx + 1]?.concluido) {
          setErro(`Não pode desmarcar "${items[idx].departamentoNome}" enquanto departamentos posteriores estão com check.`);
          setTimeout(() => setErro(null), 4000);
          return;
        }
      }
    }

    setSalvando(deptId);
    const novoConcluido = !items[idx].concluido;

    // Otimista
    setItems(prev => prev.map(i =>
      i.departamentoId === deptId
        ? { ...i, concluido: novoConcluido, concluidoEm: novoConcluido ? new Date().toISOString() : undefined }
        : i
    ));

    const result = await fetchChecklistPost(processoId, {
      departamentoId: deptId,
      concluido: novoConcluido,
    });

    if (result?.error) {
      // Reverter
      setItems(prev => prev.map(i =>
        i.departamentoId === deptId
          ? { ...i, concluido: !novoConcluido, concluidoEm: !novoConcluido ? new Date().toISOString() : undefined }
          : i
      ));
      setErro(result.error);
      setTimeout(() => setErro(null), 4000);
    }

    setSalvando(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando checklist...
      </div>
    );
  }

  if (items.length === 0) return null;

  const concluidos = items.filter(i => i.concluido).length;
  const total = items.length;
  const progresso = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {deptIndependente ? '⚡ Checklist Paralelo — Ordem Obrigatória' : 'Checklist por Departamento'}
        </h4>
        <span className="text-xs text-gray-500">
          {concluidos}/{total} ({progresso}%)
        </span>
      </div>

      {deptIndependente && (
        <p className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg">
          Todos os departamentos preenchem seus questionários em paralelo, mas o check segue a ordem do fluxo (1 → 2 → 3...).
        </p>
      )}

      {/* Barra de progresso */}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500 rounded-full"
          style={{ width: `${progresso}%` }}
        />
      </div>

      {/* Erro */}
      {erro && (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {erro}
        </div>
      )}

      <div className="space-y-1.5">
        {items.map((item, idx) => {
          const canCheck = podeDarCheck(idx);
          const bloqueadoPor = !item.concluido ? getBloqueadoPor(idx) : null;
          const isAtual = item.departamentoId === departamentoAtual;
          const isBloqueado = !item.concluido && !canCheck;

          return (
            <button
              key={item.departamentoId}
              onClick={() => !isBloqueado && toggleConcluido(item.departamentoId)}
              disabled={readOnly || isBloqueado || salvando === item.departamentoId}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm
                ${item.concluido
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : isBloqueado
                    ? 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed'
                    : isAtual
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 hover:border-blue-400'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-cyan-300'
                }
              `}
              title={
                item.concluido
                  ? `Concluído${item.concluidoEm ? ` em ${new Date(item.concluidoEm).toLocaleDateString('pt-BR')}` : ''}`
                  : isBloqueado
                    ? `Aguardando "${bloqueadoPor}" dar check primeiro`
                    : 'Clique para marcar como concluído'
              }
            >
              {salvando === item.departamentoId ? (
                <Loader2 className="w-5 h-5 text-cyan-500 animate-spin flex-shrink-0" />
              ) : item.concluido ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              ) : isBloqueado ? (
                <Lock className="w-5 h-5 text-gray-400 flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {/* Badge de ordem */}
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                    item.concluido
                      ? 'bg-green-500 text-white'
                      : isBloqueado
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                        : 'bg-indigo-500 text-white'
                  }`}>
                    {idx + 1}
                  </span>

                  <span className={`font-medium ${item.concluido ? 'line-through text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {item.departamentoNome}
                  </span>

                  {isAtual && !item.concluido && !deptIndependente && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                      ATUAL
                    </span>
                  )}
                  {deptIndependente && !item.concluido && canCheck && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-full font-medium">
                      PODE FINALIZAR
                    </span>
                  )}
                  {isBloqueado && bloqueadoPor && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 rounded-full font-medium">
                      AGUARDANDO {bloqueadoPor.toUpperCase().slice(0, 15)}
                    </span>
                  )}
                </div>
                {deptIndependente && item.responsavelNome && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-7">
                    Responsavel: {item.responsavelNome}
                  </span>
                )}
                {item.concluidoEm && (
                  <span className="text-xs text-gray-400 ml-7">
                    Concluido em {new Date(item.concluidoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
