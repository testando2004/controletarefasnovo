'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
  describedBy?: string;
  zIndex?: number;
  backdropClassName?: string;
  dialogClassName?: string;
  initialFocusSelector?: string;
  /** Se true, clicar no backdrop fecha o modal. Default: false (só fecha via X ou botões). */
  closeOnBackdropClick?: boolean;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];
  const nodes = Array.from(container.querySelectorAll(selectors.join(',')));
  return nodes.filter((el) => !el.hasAttribute('disabled')) as HTMLElement[];
}

export default function ModalBase({
  isOpen,
  onClose,
  children,
  labelledBy,
  describedBy,
  zIndex = 1000,
  backdropClassName,
  dialogClassName,
  initialFocusSelector,
  closeOnBackdropClick = false,
}: ModalBaseProps) {
  const [mounted, setMounted] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const mountRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return;

    const el = document.createElement('div');
    el.setAttribute('data-portal', 'modal');
    mountRef.current = el;
    setContainer(el);
    document.body.appendChild(el);

    return () => {
      const node = mountRef.current;
      mountRef.current = null;
      setContainer(null);
      if (!node) return;

      // Em dev (React 18 StrictMode/Fast Refresh) o cleanup pode rodar mais de uma vez.
      // Só remove se o nó ainda estiver anexado.
      const parent = node.parentNode;
      if (!parent) return;
      try {
        parent.removeChild(node);
      } catch {
        // no-op: nó já foi removido por outro ciclo
      }
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !isOpen || typeof document === 'undefined') return;
    lastFocusedRef.current = (document.activeElement as HTMLElement) || null;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusTarget = initialFocusSelector
      ? dialog?.querySelector(initialFocusSelector)
      : dialog?.querySelector('[autofocus]');

    const first = (focusTarget as HTMLElement) || getFocusableElements(dialog)[0];
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
      } else if (e.key === 'Tab') {
        if (!dialog) return;
        const focusables = getFocusableElements(dialog);
        if (focusables.length === 0) return;
        const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
        let nextIndex = currentIndex;
        if (e.shiftKey) {
          nextIndex = currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
        } else {
          nextIndex = currentIndex === focusables.length - 1 ? 0 : currentIndex + 1;
        }
        (focusables[nextIndex] || focusables[0]).focus();
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = '';
      lastFocusedRef.current?.focus?.();
    };
  }, [mounted, isOpen, initialFocusSelector]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (!closeOnBackdropClick) return;
    if (e.target === e.currentTarget) onCloseRef.current?.();
  }, [closeOnBackdropClick]);

  // Importante: durante SSR o modal não existe; no primeiro render do client também retornamos null.
  // Só renderizamos portal após mount para evitar erro de hidratação.
  if (!mounted || !isOpen || !container) return null;

  const backdropStyle: React.CSSProperties = { zIndex };
  const dialogStyle: React.CSSProperties = { zIndex: zIndex + 1 };

  return ReactDOM.createPortal(
    <div
      className={backdropClassName || 'fixed inset-0 bg-black/50 flex items-end justify-center overflow-y-auto p-2 sm:items-center sm:p-4'}
      style={backdropStyle}
      onMouseDown={handleBackdropClick}
      aria-hidden={false}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={dialogClassName || 'w-full max-w-2xl max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl bg-white shadow-2xl outline-none dark:bg-[var(--card)] sm:max-h-[calc(100dvh-2rem)]'}
        style={dialogStyle}
      >
        {children}
      </div>
    </div>,
    container
  );
}
