'use client';

import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import ModalBase from './ModalBase';

export type TipoAlerta = 'info' | 'aviso' | 'erro' | 'sucesso';

interface ModalAlertaProps {
  titulo: string;
  mensagem: unknown;
  tipo?: TipoAlerta;
  onClose: () => void;
}

export default function ModalAlerta({
  titulo,
  mensagem,
  tipo = 'info',
  onClose,
}: ModalAlertaProps) {
  const mensagemTexto = React.useMemo(() => {
    if (typeof mensagem === 'string') return mensagem;
    if (mensagem instanceof Error) return mensagem.message;
    try {
      return JSON.stringify(mensagem, null, 2);
    } catch {
      return String(mensagem);
    }
  }, [mensagem]);

  const getConfig = () => {
    switch (tipo) {
      case 'erro':
        return {
          cor: 'from-red-500 to-red-600',
          icone: <AlertCircle size={24} className="text-white" />,
          iconeCentral: <AlertCircle size={32} className="text-red-600" />,
        };
      case 'aviso':
        return {
          cor: 'from-amber-500 to-amber-600',
          icone: <AlertCircle size={24} className="text-white" />,
          iconeCentral: <AlertCircle size={32} className="text-amber-600" />,
        };
      case 'sucesso':
        return {
          cor: 'from-green-500 to-green-600',
          icone: <CheckCircle size={24} className="text-white" />,
          iconeCentral: <CheckCircle size={32} className="text-green-600" />,
        };
      default:
        return {
          cor: 'from-blue-500 to-blue-600',
          icone: <AlertCircle size={24} className="text-white" />,
          iconeCentral: <AlertCircle size={32} className="text-blue-600" />,
        };
    }
  };

  const config = getConfig();

  return (
    <ModalBase isOpen onClose={onClose} labelledBy="alert-title" dialogClassName="w-full max-w-md bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none" zIndex={1500} closeOnBackdropClick>
      <div className="rounded-2xl relative">
        <div className={`bg-gradient-to-r ${config.cor} p-6 rounded-t-2xl`}>
          <div className="flex items-center gap-3">
            <div className="bg-white bg-opacity-20 p-2 rounded-full">{config.icone}</div>
            <h3 id="alert-title" className="text-xl font-bold text-white">{titulo}</h3>
          </div>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {config.iconeCentral}
            </div>
            <p className="text-gray-600 dark:text-gray-200 whitespace-pre-wrap">{mensagemTexto}</p>
          </div>

          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            OK
          </button>
        </div>
      </div>
    </ModalBase>
  );
}
