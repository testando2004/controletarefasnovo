'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, Plus, X, Tag } from 'lucide-react';
import ModalBase from './ModalBase';
import { MOTIVOS_EXCLUSAO_PADRAO } from '@/app/types';

const STORAGE_KEY = 'motivos_exclusao_salvos';

function getMotivosLocalStorage(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveMotivosLocalStorage(motivos: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(motivos));
}

interface ModalMotivoExclusaoProps {
  processoNome: string;
  onConfirmar: (motivo: string, motivoCustom?: string) => void;
  onClose: () => void;
}

export default function ModalMotivoExclusao({ processoNome, onConfirmar, onClose }: ModalMotivoExclusaoProps) {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [motivosSalvos, setMotivosSalvos] = useState<string[]>([]);
  const [novoMotivo, setNovoMotivo] = useState('');
  const [showAddMotivo, setShowAddMotivo] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Combina motivos padrão + motivos salvos pelo usuário
  const todosMotivos = [...MOTIVOS_EXCLUSAO_PADRAO.filter(m => m !== 'Outro motivo'), ...motivosSalvos];

  useEffect(() => {
    setMotivosSalvos(getMotivosLocalStorage());
  }, []);

  const motivoValido = motivo.trim().length >= 5;

  const handleConfirmar = async () => {
    if (!motivoValido) return;
    setLoading(true);
    try {
      await onConfirmar(motivo.trim());
    } finally {
      setLoading(false);
    }
  };

  const handleSelecionarSugestao = (sugestao: string) => {
    setMotivo(sugestao);
    textareaRef.current?.focus();
  };

  const handleAdicionarMotivo = () => {
    const novo = novoMotivo.trim();
    if (!novo || todosMotivos.includes(novo)) return;
    const updated = [...motivosSalvos, novo];
    setMotivosSalvos(updated);
    saveMotivosLocalStorage(updated);
    setNovoMotivo('');
    setShowAddMotivo(false);
  };

  const handleRemoverMotivoSalvo = (m: string) => {
    const updated = motivosSalvos.filter(x => x !== m);
    setMotivosSalvos(updated);
    saveMotivosLocalStorage(updated);
  };

  return (
    <ModalBase isOpen onClose={onClose} labelledBy="motivo-exclusao-title" dialogClassName="w-full max-w-lg bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none max-h-[90vh] overflow-y-auto" zIndex={1200}>
      <div className="p-6 space-y-5">
        <h2 id="motivo-exclusao-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">Motivo da Exclusão</h2>

        {/* Aviso */}
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              Você está excluindo a solicitação:
            </p>
            <p className="text-sm text-red-700 dark:text-red-400 font-semibold mt-1">
              {processoNome}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              O processo será movido para a lixeira por 15 dias antes de ser excluído permanentemente.
            </p>
          </div>
        </div>

        {/* Campo aberto para motivo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Motivo da exclusão: <span className="text-red-500">*</span>
          </label>
          <textarea
            ref={textareaRef}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Descreva o motivo da exclusão..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
          />
          <p className={`text-xs mt-1 ${motivo.trim().length >= 5 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
            {motivo.trim().length}/5 caracteres mínimos
          </p>
        </div>

        {/* Sugestões rápidas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Motivos rápidos</span>
            <button
              onClick={() => setShowAddMotivo(!showAddMotivo)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Adicionar motivo
            </button>
          </div>

          {/* Adicionar novo motivo salvo */}
          {showAddMotivo && (
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={novoMotivo}
                onChange={(e) => setNovoMotivo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdicionarMotivo()}
                placeholder="Novo motivo rápido..."
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
              <button
                onClick={handleAdicionarMotivo}
                disabled={!novoMotivo.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Salvar
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {todosMotivos.map((m) => {
              const isCustom = motivosSalvos.includes(m);
              return (
                <button
                  key={m}
                  onClick={() => handleSelecionarSugestao(m)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-all
                    ${motivo === m
                      ? 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                >
                  <Tag className="w-3 h-3" />
                  {m}
                  {isCustom && (
                    <span
                      onClick={(e) => { e.stopPropagation(); handleRemoverMotivoSalvo(m); }}
                      className="ml-0.5 hover:text-red-500 cursor-pointer"
                      title="Remover motivo salvo"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!motivoValido || loading}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
          </button>
        </div>
      </div>
    </ModalBase>
  );
}
