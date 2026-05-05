'use client';

import React from 'react';
import {
  CheckCircle, ArrowRight, FileText, Upload, MessageSquare,
  Star, Edit, Trash2, User, Calendar, Clock, Activity,
  AlertCircle, Flag, PlayCircle, XCircle, PauseCircle, Link2,
  FileEdit
} from 'lucide-react';
import { formatarData } from '@/app/utils/helpers';

export interface HistoricoEvento {
  id: number | string;
  tipo: 'INICIO' | 'ALTERACAO' | 'MOVIMENTACAO' | 'CONCLUSAO' | 'FINALIZACAO' | 'DOCUMENTO' | 'COMENTARIO' | 'ALTERACAO_CAMPO';
  acao: string;
  responsavel?: {
    id: number;
    nome: string;
    email: string;
  };
  departamento?: string;
  data: string | Date;
  detalhes?: any;
  // Campos de interligação
  isInterligado?: boolean;
  processoOrigemId?: number;
  processoOrigemNome?: string;
  // Campos de alteração campo-a-campo
  isFieldLevel?: boolean;
  campo?: string;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  entidade?: string;
  entidadeNome?: string;
}

interface HistoricoTimelineProps {
  historico: HistoricoEvento[];
  compact?: boolean;
}

export default function HistoricoTimeline({ historico, compact = false }: HistoricoTimelineProps) {
  const getIconeEvento = (tipo: HistoricoEvento['tipo']) => {
    switch (tipo) {
      case 'INICIO':
        return <PlayCircle className="w-5 h-5 text-green-600" />;
      case 'MOVIMENTACAO':
        return <ArrowRight className="w-5 h-5 text-blue-600" />;
      case 'ALTERACAO':
        return <Edit className="w-5 h-5 text-yellow-600" />;
      case 'DOCUMENTO':
        return <Upload className="w-5 h-5 text-purple-600" />;
      case 'COMENTARIO':
        return <MessageSquare className="w-5 h-5 text-indigo-600" />;
      case 'CONCLUSAO':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'FINALIZACAO':
        return <Star className="w-5 h-5 text-amber-600" />;
      case 'ALTERACAO_CAMPO':
        return <FileEdit className="w-5 h-5 text-orange-600" />;
      default:
        return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const getCorEvento = (tipo: HistoricoEvento['tipo']) => {
    switch (tipo) {
      case 'INICIO':
        return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
      case 'MOVIMENTACAO':
        return 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700';
      case 'ALTERACAO':
        return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700';
      case 'DOCUMENTO':
        return 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700';
      case 'COMENTARIO':
        return 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700';
      case 'CONCLUSAO':
        return 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700';
      case 'FINALIZACAO':
        return 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700';
      case 'ALTERACAO_CAMPO':
        return 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 border-gray-300 dark:border-gray-700';
    }
  };

  const formatarDataHora = (data: string | Date) => {
    const d = new Date(data);
    return {
      data: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  if (!historico || historico.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Activity className="w-12 h-12 mx-auto mb-2 opacity-30" />
        <p>Nenhum evento registrado ainda</p>
      </div>
    );
  }

  // Ordenar por data (mais recente primeiro)
  const historicoOrdenado = [...historico].sort((a, b) => 
    new Date(b.data).getTime() - new Date(a.data).getTime()
  );

  return (
    <div className="relative">
      {/* Linha vertical */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-purple-200 to-pink-200 dark:from-blue-800 dark:via-purple-800 dark:to-pink-800"></div>

      {/* Eventos */}
      <div className="space-y-4">
        {historicoOrdenado.map((evento, index) => {
          const { data, hora } = formatarDataHora(evento.data);
          const isFirst = index === 0;

          const isLinked = !!(evento as any).isInterligado;
          const linkedName = (evento as any).processoOrigemNome || '';

          return (
            <div key={evento.id} className="relative pl-16 pr-4">
              {/* Ícone */}
              <div className={`absolute left-3 w-10 h-10 rounded-full border-2 flex items-center justify-center ${isLinked ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700' : getCorEvento(evento.tipo)} ${isFirst ? 'ring-4 ring-blue-200 dark:ring-blue-800' : ''}`}>
                {isLinked ? <Link2 className="w-5 h-5 text-purple-600" /> : getIconeEvento(evento.tipo)}
              </div>

              {/* Conteúdo */}
              <div className={`rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow ${isLinked ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-700 border-l-4 border-l-purple-400' : `bg-white dark:bg-gray-800 ${getCorEvento(evento.tipo)}`} ${isFirst ? 'ring-2 ring-blue-300 dark:ring-blue-600' : ''}`}>
                {/* Badge de interligação */}
                {isLinked && linkedName && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Link2 className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded-full">
                      {linkedName}
                    </span>
                  </div>
                )}
                {/* Cabeçalho */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${isLinked ? 'text-purple-800 dark:text-purple-200' : 'text-gray-900 dark:text-gray-100'}`}>
                      {evento.acao}
                    </p>
                    {evento.departamento && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        📍 {evento.departamento}
                      </p>
                    )}
                  </div>
                  {isFirst && (
                    <span className="px-2 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full">
                      Mais recente
                    </span>
                  )}
                </div>

                {/* Diff visual para alterações de campo */}
                {evento.isFieldLevel && evento.campo && (
                  <div className="mt-2 p-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                      {evento.campo}
                    </p>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      {evento.valorAnterior ? (
                        <span className="line-through text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded max-w-[200px] truncate">
                          {evento.valorAnterior}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">(vazio)</span>
                      )}
                      <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      {evento.valorNovo ? (
                        <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded font-medium max-w-[200px] truncate">
                          {evento.valorNovo}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">(vazio)</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    {evento.responsavel && (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {evento.responsavel.nome}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{data}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{hora}</span>
                    </div>
                  </div>
                </div>

                {/* Detalhes adicionais */}
                {evento.detalhes && (
                  <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs text-gray-600 dark:text-gray-400">
                    <pre className="whitespace-pre-wrap font-mono">
                      {typeof evento.detalhes === 'string' 
                        ? evento.detalhes 
                        : JSON.stringify(evento.detalhes, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Indicador de início */}
      <div className="relative pl-16 pr-4 mt-4">
        <div className="absolute left-3 w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 border-2 border-gray-400 dark:border-gray-600 flex items-center justify-center">
          <Flag className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 p-3 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            🎯 Início do Processo
          </p>
        </div>
      </div>
    </div>
  );
}
