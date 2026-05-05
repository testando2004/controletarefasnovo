'use client';

import React, { useState, useEffect } from 'react';
import {
  Pin,
  ChevronDown,
  ChevronUp,
  Building,
  Eye,
  Clock,
  Loader2,
  AlertCircle,
  FolderKanban,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { api } from '@/app/utils/api';
import { Processo } from '@/app/types';
import { useSistema } from '@/app/context/SistemaContext';

interface SecaoFavoritosProps {
  onProcessoClicado: (processo: Processo) => void;
  favoritosIds?: Set<number>;
  // IDs dos favoritos em ordem cronológica de fixação (primeiro fixado em primeiro,
  // último no fim). Quando ausente, cai no fallback de filter por Set, que pega
  // a ordem do array `processos` (data de criação do processo, não da fixação).
  favoritosOrdem?: number[];
  onToggleFavorito?: (processoId: number) => void;
}

export default function SecaoFavoritos({ onProcessoClicado, favoritosIds, favoritosOrdem, onToggleFavorito }: SecaoFavoritosProps) {
  const { departamentos, processos } = useSistema();
  const [expandido, setExpandido] = useState(true);
  const [removendo, setRemovendo] = useState<number | null>(null);

  // Lista de fixados na ordem em que o usuário fixou.
  // Se favoritosOrdem foi passado, usa a ordem cronológica (1º fixado → 1º exibido).
  // Caso contrário, fallback antigo (ordem do array processos).
  const favoritos: Processo[] = favoritosOrdem && favoritosOrdem.length > 0
    ? favoritosOrdem
        .map((id) => processos.find((p) => p.id === id))
        .filter((p): p is Processo => Boolean(p))
    : processos.filter((p) => favoritosIds?.has(p.id));

  const removerFavorito = async (e: React.MouseEvent, processoId: number) => {
    e.stopPropagation();
    if (!onToggleFavorito) return;
    try {
      setRemovendo(processoId);
      await onToggleFavorito(processoId);
    } catch (error) {
      console.error('Erro ao remover favorito:', error);
    } finally {
      setRemovendo(null);
    }
  };

  const getDepartamento = (departamentoId: number) => {
    return departamentos.find(d => d.id === departamentoId);
  };

  const getIconeComponent = (iconeName: string | undefined) => {
    if (!iconeName) return LucideIcons.FolderKanban;
    const Icon = (LucideIcons as any)[iconeName];
    return Icon || LucideIcons.FolderKanban;
  };

  const formatarData = (data: string | Date) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'em_andamento':
        return { label: 'Em andamento', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
      case 'finalizado':
        return { label: 'Finalizado', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
      case 'pausado':
        return { label: 'Pausado', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' };
      case 'cancelado':
        return { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
    }
  };

  if (favoritos.length === 0) {
    return null; // Não mostrar seção se não há favoritos
  }

  return (
    <div className="mb-6 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/10 dark:to-amber-900/10 rounded-xl border border-yellow-200 dark:border-yellow-800/30 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full flex items-center justify-between p-4 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-400/20 dark:bg-amber-500/20 rounded-lg">
            <Pin className="w-5 h-5 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Processos Fixados
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {favoritos.length} {favoritos.length === 1 ? 'processo' : 'processos'} fixados
            </p>
          </div>
        </div>
        {expandido ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Lista de favoritos */}
      {expandido && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {favoritos.map((processo) => {
              const departamento = getDepartamento(processo.departamentoAtual);
              const IconeDep = getIconeComponent(departamento?.icone);
              const statusConfig = getStatusConfig(processo.status);
              const nomeEmpresa = processo.nomeEmpresa || (typeof processo.empresa === 'object' && processo.empresa ? (processo.empresa as any).razao_social : null) || 'Empresa';

              return (
                <div
                  key={processo.id}
                  onClick={() => onProcessoClicado(processo)}
                  className="group relative bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 hover:border-yellow-400 dark:hover:border-yellow-500 hover:shadow-md cursor-pointer transition-all"
                >
                  {/* Botão remover favorito */}
                  <button
                    onClick={(e) => removerFavorito(e, processo.id)}
                    disabled={removendo === processo.id}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors opacity-0 group-hover:opacity-100"
                    title="Desafixar processo"
                  >
                    {removendo === processo.id ? (
                      <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                    ) : (
                      <Pin className="w-4 h-4 text-amber-500 fill-amber-500 hover:fill-transparent" />
                    )}
                  </button>

                  {/* Conteúdo */}
                  <div className="flex items-start gap-3 pr-6">
                    {/* Ícone do departamento */}
                    <div
                      className={`p-2 rounded-lg bg-gradient-to-br ${departamento?.cor || 'from-gray-400 to-gray-500'}`}
                    >
                      <IconeDep className="w-4 h-4 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Nome da empresa */}
                      <h4 className="font-medium text-gray-900 dark:text-white truncate text-sm">
                        {nomeEmpresa}
                      </h4>

                      {/* Serviço */}
                      {processo.nomeServico && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {processo.nomeServico}
                        </p>
                      )}

                      {/* Info row */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {/* Status badge */}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>

                        {/* Data */}
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {formatarData(processo.criadoEm || processo.dataCriacao || new Date())}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
