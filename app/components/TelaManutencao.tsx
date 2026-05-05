'use client';

import React from 'react';
import { Settings, Wrench } from 'lucide-react';

export default function TelaManutencao() {
  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
      <div className="text-center max-w-md px-8">
        {/* Ícone animado */}
        <div className="relative mx-auto w-32 h-32 mb-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <Settings size={64} className="text-yellow-400 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Wrench size={28} className="text-yellow-300" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">
          Sistema em Manutenção
        </h1>

        <p className="text-gray-300 text-lg mb-6">
          Estamos realizando melhorias no sistema. Por favor, aguarde alguns instantes.
        </p>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">
            O sistema será restaurado automaticamente quando a manutenção finalizar.
            Não é necessário atualizar a página.
          </p>
        </div>

        {/* Barra de loading */}
        <div className="mt-8 w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div className="bg-yellow-400 h-full rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  );
}
