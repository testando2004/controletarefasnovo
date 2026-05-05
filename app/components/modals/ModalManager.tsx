'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import ModalBase from './ModalBase';

export type ModalEntry = {
  id: number;
  element: React.ReactNode;
};

interface ModalManagerValue {
  open: (render: (close: () => void) => React.ReactNode) => number;
  close: (id: number) => void;
  closeTop: () => void;
  count: number;
}

const ModalManagerContext = createContext<ModalManagerValue | undefined>(undefined);

export function ModalManagerProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<ModalEntry[]>([]);
  const nextId = useRef(1);

  const close = useCallback((id: number) => {
    setStack((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const open = useCallback((render: (close: () => void) => React.ReactNode) => {
    const id = nextId.current++;
    const closeFn = () => close(id);
    const element = render(closeFn);
    setStack((prev) => [...prev, { id, element }]);
    return id;
  }, [close]);

  const closeTop = useCallback(() => {
    setStack((prev) => prev.slice(0, -1));
  }, []);

  const value = useMemo<ModalManagerValue>(() => ({ open, close, closeTop, count: stack.length }), [open, close, closeTop, stack.length]);

  return (
    <ModalManagerContext.Provider value={value}>
      {children}
      {stack.map((entry, idx) => (
        <ModalBase key={entry.id} isOpen onClose={() => close(entry.id)} zIndex={1000 + idx * 10}>
          {entry.element}
        </ModalBase>
      ))}
    </ModalManagerContext.Provider>
  );
}

export function useModalManager() {
  const ctx = useContext(ModalManagerContext);
  if (!ctx) throw new Error('useModalManager must be used within ModalManagerProvider');
  return ctx;
}
