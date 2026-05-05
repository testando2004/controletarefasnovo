'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

interface DetalheProcesso {
  processoId: number;
  concluido: boolean;
  atual: boolean;
}

interface AgregadoItem {
  departamentoId: number;
  departamentoNome: string;
  total: number;
  concluidos: number;
  progresso: number;
  detalhes: DetalheProcesso[];
}

interface ProgressoDeptsMiniProps {
  processoId: number;
  departamentoAtualId?: number;
  /** Número máximo de deptos a mostrar inline antes de "+N". Default: 4 */
  maxInline?: number;
}

// Cache por (processoId + deptAtualId) — invalida automaticamente quando o processo avança.
const cache = new Map<string, AgregadoItem[]>();
const cacheKey = (processoId: number, deptAtualId?: number) => `${processoId}:${deptAtualId ?? ''}`;

export default function ProgressoDeptsMini({
  processoId,
  departamentoAtualId,
  maxInline = 4,
}: ProgressoDeptsMiniProps) {
  const chave = cacheKey(processoId, departamentoAtualId);
  const [agregado, setAgregado] = useState<AgregadoItem[]>(() => cache.get(chave) || []);
  const [loading, setLoading] = useState(!cache.has(chave));

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await fetch(`/api/processos/${processoId}/checklist-agregado`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        const arr: AgregadoItem[] = Array.isArray(data?.agregado) ? data.agregado : [];
        if (!ativo) return;
        cache.set(chave, arr);
        setAgregado(arr);
      } catch {
        // silencioso
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processoId, departamentoAtualId]);

  if (loading && agregado.length === 0) {
    return (
      <div className="h-8 w-full animate-pulse rounded-md bg-gray-100 dark:bg-slate-800/60" />
    );
  }

  if (agregado.length === 0) return null;

  const total = agregado.length;
  const visiveis = agregado.slice(0, maxInline);
  const extras = total - visiveis.length;

  return (
    <div className="flex items-center gap-1 overflow-x-auto" title="Progresso de cada departamento no fluxo (inclui interligações)">
      {visiveis.map((item) => {
        const isAtual = Number(departamentoAtualId) === item.departamentoId
          || item.detalhes.some((d) => d.atual);
        const cor =
          item.progresso === 100
            ? 'bg-green-500 text-white'
            : item.progresso >= 75
              ? 'bg-lime-500 text-white'
              : item.progresso >= 50
                ? 'bg-yellow-400 text-gray-900'
                : item.progresso > 0
                  ? 'bg-orange-400 text-white'
                  : 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300';
        return (
          <div
            key={item.departamentoId}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap flex-shrink-0 ${cor} ${
              isAtual ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''
            }`}
            title={`${item.departamentoNome}: ${item.concluidos}/${item.total} concluído(s) • ${item.progresso}%${isAtual ? ' • atual' : ''}`}
          >
            {item.progresso === 100 ? (
              <CheckCircle2 size={10} />
            ) : isAtual ? (
              <Clock size={10} />
            ) : (
              <Circle size={10} />
            )}
            <span className="truncate max-w-[70px]">{item.departamentoNome}</span>
            <span className="opacity-90">{item.progresso}%</span>
          </div>
        );
      })}
      {extras > 0 && (
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap flex-shrink-0"
          title={agregado.slice(maxInline).map((i) => `${i.departamentoNome}: ${i.progresso}%`).join(' • ')}
        >
          +{extras}
        </span>
      )}
    </div>
  );
}
