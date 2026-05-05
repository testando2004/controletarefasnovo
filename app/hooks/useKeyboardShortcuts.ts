'use client';

import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsConfig {
  /** Ctrl+N – Novo processo */
  onNovoProcesso?: () => void;
  /** Ctrl+F – Buscar (foca no campo de busca) */
  onBuscar?: () => void;
  /** Ctrl+S – Salvar (genérico – previne o save padrão do browser) */
  onSalvar?: () => void;
  /** Esc – Fechar modal (já tratado pelo ModalBase, mas disponível como fallback) */
  onFechar?: () => void;
  /** Se true, desabilita todos os atalhos (ex.: usuário não logado) */
  desabilitado?: boolean;
}

/**
 * Hook que registra atalhos de teclado globais para o sistema.
 *
 * Atalhos:
 * - `Ctrl+N` → Novo processo
 * - `Ctrl+F` → Focar campo de busca
 * - `Ctrl+S` → Salvar (previne comportamento padrão do navegador)
 * - `Esc`    → Fechar modal (fallback – o ModalBase já trata Esc internamente)
 */
export function useKeyboardShortcuts({
  onNovoProcesso,
  onBuscar,
  onSalvar,
  onFechar,
  desabilitado = false,
}: KeyboardShortcutsConfig) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (desabilitado) return;

      // Ignora se o foco estiver em um campo de texto/textarea/select/contenteditable
      // para não atrapalhar digitação normal (exceto Esc que sempre funciona)
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      const ctrl = e.ctrlKey || e.metaKey; // Suporta Cmd no Mac

      // Ctrl+N → Novo processo
      if (ctrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        e.stopPropagation();
        onNovoProcesso?.();
        return;
      }

      // Ctrl+F → Buscar
      if (ctrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopPropagation();
        onBuscar?.();
        return;
      }

      // Ctrl+S → Salvar
      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        onSalvar?.();
        return;
      }

      // Esc → Fechar (só como fallback se não estiver em input)
      if (e.key === 'Escape' && !isInput) {
        // Não faz preventDefault para não conflitar com o ModalBase
        onFechar?.();
        return;
      }
    },
    [desabilitado, onNovoProcesso, onBuscar, onSalvar, onFechar],
  );

  useEffect(() => {
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handler]);
}
