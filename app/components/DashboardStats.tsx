'use client';

import React from 'react';
import { Building, Clock, CheckCircle, AlertCircle, TrendingUp, Star } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import { Processo } from '@/app/types';

export default function DashboardStats() {
  const { processos: processosRaw } = useSistema();
  const processos = processosRaw as Processo[];

  const emAndamento = processos.filter((p) => p.status === 'em_andamento').length;
  const finalizados = processos.filter((p) => p.status === 'finalizado').length;
  const taxaSucesso = processos.length > 0 ? Math.round((finalizados / processos.length) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Total de Processos */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Total de Processos</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{processos.length}</p>
          </div>
          <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-4 rounded-xl">
            <Building className="text-white" size={24} />
          </div>
        </div>
      </div>

      {/* Em Andamento */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Em Andamento</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{emAndamento}</p>
            <p className="text-xs text-amber-600 mt-2">Aguardando processamento</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-4 rounded-xl">
            <Clock className="text-white" size={24} />
          </div>
        </div>
      </div>

      {/* Finalizados */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Finalizados</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{finalizados}</p>
            <p className="text-xs text-green-600 mt-2">Empresas registradas</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl">
            <CheckCircle className="text-white" size={24} />
          </div>
        </div>
      </div>

      {/* Taxa de Sucesso */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Taxa de Sucesso</p>
            <p className="text-3xl font-bold text-cyan-600 mt-1">{taxaSucesso}%</p>
          </div>
          <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-4 rounded-xl">
            <AlertCircle className="text-white" size={24} />
          </div>
        </div>
      </div>
    </div>
  );
}
