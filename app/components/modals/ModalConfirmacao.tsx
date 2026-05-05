'use client';

import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import ModalBase from './ModalBase';

type TipoConfirmacao = 'info' | 'aviso' | 'perigo' | 'sucesso' | 'warning' | 'error' | 'success';

interface ModalConfirmacaoProps {
  titulo: string;
  mensagem: unknown;
  onConfirm: () => void;
  onCancel: () => void;
  tipo?: TipoConfirmacao;
  textoConfirmar?: string;
  textoCancelar?: string;
}

export default function ModalConfirmacao({
  titulo,
  mensagem,
  onConfirm,
  onCancel,
  tipo = 'info',
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
}: ModalConfirmacaoProps) {
  const mensagemTexto = React.useMemo(() => {
    if (typeof mensagem === 'string') return mensagem;
    if (mensagem instanceof Error) return mensagem.message;
    try {
      return JSON.stringify(mensagem, null, 2);
    } catch {
      return String(mensagem);
    }
  }, [mensagem]);

  const tipoNormalizado: 'info' | 'aviso' | 'perigo' | 'sucesso' = (() => {
    if (tipo === 'warning') return 'aviso';
    if (tipo === 'error') return 'perigo';
    if (tipo === 'success') return 'sucesso';
    if (tipo === 'info' || tipo === 'aviso' || tipo === 'perigo' || tipo === 'sucesso') return tipo;
    return 'info';
  })();

  const getConfigTipo = () => {
    switch (tipoNormalizado) {
      case 'perigo':
        return {
          cor: 'from-red-500 to-red-600',
          icone: <AlertCircle size={24} className="text-white" />,
          iconeCentral: <AlertCircle size={32} className="text-red-600" />,
          botaoConfirmar: 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
        };
      case 'aviso':
        return {
          cor: 'from-amber-500 to-amber-600',
          icone: <AlertCircle size={24} className="text-white" />,
          iconeCentral: <AlertCircle size={32} className="text-amber-600" />,
          botaoConfirmar: 'from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700',
        };
      case 'sucesso':
        return {
          cor: 'from-green-500 to-green-600',
          icone: <CheckCircle size={24} className="text-white" />,
          iconeCentral: <CheckCircle size={32} className="text-green-600" />,
          botaoConfirmar: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
        };
      default:
        return {
          cor: 'from-blue-500 to-blue-600',
          icone: <AlertCircle size={24} className="text-white" />,
          iconeCentral: <AlertCircle size={32} className="text-blue-600" />,
          botaoConfirmar: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
        };
    }
  };

  const config = getConfigTipo();

  return (
    <ModalBase isOpen onClose={onCancel} labelledBy="confirm-title" dialogClassName="w-full max-w-md bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none" zIndex={1500} closeOnBackdropClick>
      <div className="rounded-2xl">
        <div className={`bg-gradient-to-r ${config.cor} p-6 rounded-t-2xl`}>
          <div className="flex items-center gap-3">
            <div className="bg-white bg-opacity-20 p-2 rounded-full">
              {config.icone}
            </div>
            <h3 id="confirm-title" className="text-xl font-bold text-white">{titulo}</h3>
          </div>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {config.iconeCentral}
            </div>
            <p className="text-gray-600 dark:text-gray-200 whitespace-pre-wrap">{mensagemTexto}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-[var(--border)] rounded-xl hover:bg-gray-100 dark:hover:bg-[var(--muted)] transition-all duration-200 font-medium"
            >
              {textoCancelar}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-6 py-3 bg-gradient-to-r ${config.botaoConfirmar} text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl`}
            >
              {textoConfirmar}
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}
