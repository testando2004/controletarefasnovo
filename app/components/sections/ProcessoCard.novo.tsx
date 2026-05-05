'use client';

import React, { useState } from 'react';
import { 
  FileText, MessageSquare, Upload, X, ChevronDown, Star, Trash2, ArrowRight, CheckCircle
} from 'lucide-react';
import { Processo } from '@/app/types';
import { formatarData } from '@/app/utils/helpers';
import { useSistema } from '@/app/context/SistemaContext';
import { temPermissao as temPermissaoSistema } from '@/app/utils/permissions';

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
  comentarioCount?: number;
  documentCount?: number;
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
  comentarioCount = 0,
  documentCount = 0
}: ProcessoCardProps) {
  const { usuarioLogado } = useSistema();
  const [isDeleting, setIsDeleting] = useState(false);
  const [prioridade, setPrioridade] = useState<'alta' | 'media' | 'baixa'>(
    (processo.prioridade?.toLowerCase() || 'media') as 'alta' | 'media' | 'baixa'
  );

  const getPriorityColor = (priority: 'alta' | 'media' | 'baixa') => {
    switch (priority) {
      case 'alta':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700';
      case 'media':
        return 'bg-yellow-100 dark:bg-yellow-700 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700';
      case 'baixa':
        return 'bg-green-100 dark:bg-green-700 text-green-900 dark:text-green-300 border-green-300 dark:border-green-700 ring-1 ring-green-100';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600';
    }
  };

  const getPriorityEmoji = (priority: 'alta' | 'media' | 'baixa') => {
    switch (priority) {
      case 'alta':
        return '🔴';
      case 'media':
        return '🟡';
      case 'baixa':
        return '🟢';
      default:
        return '⭕';
    }
  };

  const handleExcluir = async () => {
    setIsDeleting(true);
    try {
      await onExcluir(processo.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const priorityNumber = processo.status === 'finalizado' ? 0 : 
    ((processo.departamentoAtualIndex || 0) + 1);
  const totalDepts = processo.fluxoDepartamentos?.length || 1;

  const idxAtual = processo.departamentoAtualIndex || 0;
  const isUltimo = idxAtual >= (processo.fluxoDepartamentos?.length || 1) - 1;

  const podeExcluir = temPermissaoSistema(usuarioLogado, 'excluir_processo', { departamentoAtual: processo.departamentoAtual });
  const podeMover = temPermissaoSistema(usuarioLogado, 'mover_processo', { departamentoAtual: processo.departamentoAtual });
  const podeFinalizar = temPermissaoSistema(usuarioLogado, 'finalizar_processo', {
    departamentoAtual: processo.departamentoAtual,
    isUltimoDepartamento: isUltimo,
  });
  const podeAplicarTags = temPermissaoSistema(usuarioLogado, 'aplicar_tags');

  return (
    <div 
      draggable
      className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-200 overflow-hidden flex flex-col h-full"
    >
      {/* Cabeçalho com nome da empresa */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 
              className="font-semibold text-gray-900 text-sm truncate cursor-help" 
              title={processo.nomeServico || processo.nome || 'Serviço'}
            >
              {processo.nomeServico || processo.nome || 'Serviço'}
            </h3>
            <p 
              className="text-xs text-gray-600 truncate cursor-help" 
              title={processo.nomeEmpresa}
            >
              {processo.nomeEmpresa}
            </p>
            <p 
              className="text-xs text-gray-500 truncate cursor-help" 
              title={processo.cliente || processo.email || ''}
            >
              {processo.cliente || processo.email || ''}
            </p>
          </div>

          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTags(processo);
              }}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
              title="Gerenciar Tags"
              disabled={!podeAplicarTags}
            >
              <Star size={14} className="text-gray-600" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDocumentos(processo);
              }}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
              title="Documentos"
            >
              <MessageSquare size={14} className="text-gray-600" />
            </button>

            {podeExcluir && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleExcluir();
                }}
                disabled={isDeleting}
                className="p-1.5 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                title="Excluir"
              >
                <X size={14} className="text-red-600" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Prioridade com badge */}
      <div className="px-4 py-2 bg-white border-b border-gray-100">
        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(prioridade)}`}>
          {getPriorityEmoji(prioridade)} {prioridade.toUpperCase()}
        </div>
      </div>

      {/* Data */}
      <div className="px-4 py-2 border-b border-gray-100">
        <p className="text-xs text-gray-600">
          Desde: {formatarData(processo.criadoEm || processo.dataCriacao || new Date().toISOString())}
        </p>
      </div>

      {/* Espaço flexível */}
      <div className="flex-1"></div>

      {/* Botões de ação */}
      <div className="px-4 py-2 border-t border-gray-100 space-y-2">
        {processo.status === 'em_andamento' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuestionario(processo);
                }}
                className="w-full bg-white border border-gray-300 text-gray-700 px-2 py-2 rounded-lg text-xs hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 font-medium"
                title="Formulário"
              >
                <FileText size={14} />
                Form
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDocumentos(processo);
                }}
                className="w-full bg-blue-500 text-white px-2 py-2 rounded-lg text-xs hover:bg-blue-600 transition-colors flex items-center justify-center gap-1 font-medium"
                title="Documentos"
              >
                <Upload size={14} />
                Docs
              </button>
            </div>

            {/* Botão Avançar ou Finalizar */}
            {processo.fluxoDepartamentos && processo.fluxoDepartamentos.length > 0 && (
              isUltimo ? (
                podeFinalizar ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFinalizar(processo.id);
                    }}
                    className="w-full px-2 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1 font-medium text-white bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700"
                  >
                    <CheckCircle size={14} />
                    Finalizar
                  </button>
                ) : null
              ) : (
                podeMover ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAvancar(processo.id);
                    }}
                    className="w-full px-2 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1 font-medium text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                  >
                    <ArrowRight size={14} />
                    Avançar ({priorityNumber}/{totalDepts})
                  </button>
                ) : null
              )
            )}
          </>
        )}

        {processo.status === 'finalizado' && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-xs text-center font-medium">
            ✅ Finalizado
          </div>
        )}
      </div>
    </div>
  );
}

