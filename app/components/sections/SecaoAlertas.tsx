'use client';

import React from 'react';
import { AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';

// Função para extrair data local corretamente (evita problema de timezone)
function getLocalDate(dateValue: string | Date): Date {
  const d = new Date(dateValue);
  // Usar UTC para evitar que o timezone mude o dia
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
}

export default function SecaoAlertas() {
  const { processos } = useSistema();

  const calcularPrazo = (p: any): Date | undefined => {
    if (p?.dataEntrega) {
      return getLocalDate(p.dataEntrega);
    }

    const inicio = p?.dataInicio || p?.criadoEm || p?.dataCriacao;
    if (!inicio) return undefined;
    const d = getLocalDate(inicio);
    d.setDate(d.getDate() + 15);
    return d;
  };

  const processosEmRisco = processos.filter((p) => {
    const prazo = calcularPrazo(p);
    if (!prazo) return false;
    const diasRestantes = Math.ceil((prazo.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return diasRestantes < 5 && p.status === 'em_andamento';
  });

  if (processosEmRisco.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-red-600 flex-shrink-0 mt-1" size={24} />
        <div className="flex-1">
          <h3 className="font-bold text-red-900 text-lg mb-2">
            ⚠️ {processosEmRisco.length} Processo(s) em Risco
          </h3>
          <p className="text-red-700 text-sm mb-4">
            Os seguintes processos estão próximos do prazo de entrega:
          </p>
          <div className="space-y-2">
            {processosEmRisco.map((p) => (
              <div key={p.id} className="bg-white bg-opacity-70 rounded-lg p-3 flex items-center gap-2">
                <Clock size={16} className="text-orange-600" />
                <span className="text-sm text-gray-900">
                  <strong>
                    {typeof (p as any).empresa === 'string'
                      ? (p as any).empresa
                      : (p as any).empresa?.razao_social ||
                        (p as any).empresa?.apelido ||
                        (p as any).nomeEmpresa ||
                        'Empresa'}
                  </strong>{' '}
                  - Entrega em{' '}
                  {(calcularPrazo(p) ?? new Date(p.dataEntrega!)).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
