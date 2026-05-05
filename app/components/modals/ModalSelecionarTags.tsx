'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Processo } from '@/app/types';
import { useSistema } from '@/app/context/SistemaContext';
import ModalBase from './ModalBase';

interface ModalSelecionarTagsProps {
  processo: Processo;
  onClose: () => void;
}

export default function ModalSelecionarTags({ processo, onClose }: ModalSelecionarTagsProps) {
  const { tags, aplicarTagsProcesso } = useSistema();
  const [tagsSelecionadas, setTagsSelecionadas] = useState<number[]>(processo.tags || []);

  const toggleTag = (tagId: number) => {
    setTagsSelecionadas((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSalvar = () => {
    aplicarTagsProcesso(processo.id, tagsSelecionadas);
    onClose();
  };

  return (
    <ModalBase
      isOpen
      onClose={onClose}
      labelledBy="selecionar-tags-title"
      dialogClassName="w-full max-w-md bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none"
      zIndex={1040}
    >
      <div className="rounded-2xl">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <h3 id="selecionar-tags-title" className="text-xl font-bold text-white">Selecionar Tags</h3>
            <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <h4 className="font-semibold text-gray-800 dark:text-[var(--fg)] mb-3">Processo: {processo.nomeEmpresa}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Selecione as tags que deseja aplicar a este processo
            </p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-[var(--border)] hover:bg-gray-50 dark:hover:bg-[var(--muted)] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={tagsSelecionadas.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className={`${tag.cor} ${tag.texto || 'text-white'} px-3 py-1 rounded-full text-sm font-medium flex-1 text-center`}>
                  {tag.nome}
                </span>
              </label>
            ))}
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-[var(--border)]">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[var(--muted)]"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Aplicar Tags
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}
