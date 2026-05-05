"use client";

import React from 'react';

interface LoadingOverlayProps {
  show: boolean;
  text?: string;
}

export default function LoadingOverlay({ show, text }: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[var(--card)] rounded-xl shadow-lg px-6 py-4 flex items-center gap-4">
        <svg className="w-8 h-8 text-cyan-600 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.2"></circle>
          <path d="M22 12a10 10 0 0 1-10 10" strokeLinecap="round"></path>
        </svg>
        <div>
          <div className="font-medium text-gray-900 dark:text-[var(--fg)]">{text || 'Carregando...'}</div>
          <div className="text-xs text-gray-500">Aguarde, por favor.</div>
        </div>
      </div>
    </div>
  );
}
