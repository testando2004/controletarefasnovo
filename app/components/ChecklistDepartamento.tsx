'use client';

import React from 'react';
import { CheckCircle2, Circle, AlertCircle, FileText, ClipboardList } from 'lucide-react';

interface ChecklistItem {
  id: string;
  tipo: 'questionario' | 'documento';
  nome: string;
  completo: boolean;
  obrigatorio: boolean;
}

interface ChecklistDepartamentoProps {
  questionarios: any[];
  documentosObrigatorios: any[];
  respostas: Record<number, any>;
  documentos: any[];
  departamentoNome: string;
}

export default function ChecklistDepartamento({
  questionarios,
  documentosObrigatorios,
  respostas,
  documentos,
  departamentoNome,
}: ChecklistDepartamentoProps) {
  // Montar lista de itens do checklist
  const itensChecklist: ChecklistItem[] = [];

  // Adicionar questionários obrigatórios
  questionarios
    .filter(q => q.obrigatorio)
    .forEach(pergunta => {
      let completo = false;
      
      // Se for pergunta tipo file, verificar se há documentos anexados
      if (pergunta.tipo === 'file') {
        completo = documentos.some((d: any) => {
          const pergId = Number(d?.perguntaId ?? d?.pergunta_id);
          return pergId === pergunta.id;
        });
      } else {
        // Para outros tipos, verificar resposta
        const resposta = respostas[pergunta.id];
        completo = resposta !== undefined && resposta !== '' && resposta !== null;
      }
      
      itensChecklist.push({
        id: `q_${pergunta.id}`,
        tipo: 'questionario',
        nome: pergunta.label,
        completo,
        obrigatorio: true,
      });
    });

  // Adicionar documentos obrigatórios
  documentosObrigatorios.forEach(docObrig => {
    // Verifica se há documento do tipo obrigatório OU se há documentos anexados em perguntas do tipo file
    const enviado = documentos.some(
      d => d.tipo === docObrig.tipo || 
           d.tipoCategoria === docObrig.tipo || 
           d.tipo === docObrig.nome || 
           d.nome?.toLowerCase().includes(docObrig.nome?.toLowerCase())
    );

    itensChecklist.push({
      id: `d_${docObrig.id}`,
      tipo: 'documento',
      nome: docObrig.nome,
      completo: enviado,
      obrigatorio: true,
    });
  });

  const totalItens = itensChecklist.length;
  const itensCompletos = itensChecklist.filter(item => item.completo).length;
  const percentual = totalItens > 0 ? Math.round((itensCompletos / totalItens) * 100) : 100;
  const todosCompletos = totalItens > 0 && itensCompletos === totalItens;

  if (totalItens === 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Nenhum requisito obrigatório neste departamento</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com progresso */}
      <div className={`border rounded-lg p-4 ${
        todosCompletos 
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {todosCompletos ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            )}
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Checklist - {departamentoNome}
            </h3>
          </div>
          <span className={`text-sm font-medium ${
            todosCompletos 
              ? 'text-green-700 dark:text-green-400'
              : 'text-amber-700 dark:text-amber-400'
          }`}>
            {itensCompletos}/{totalItens} completos
          </span>
        </div>

        {/* Barra de progresso */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              todosCompletos 
                ? 'bg-green-600 dark:bg-green-500'
                : 'bg-amber-600 dark:bg-amber-500'
            }`}
            style={{ width: `${percentual}%` }}
          />
        </div>
      </div>

      {/* Lista de itens */}
      <div className="space-y-2">
        {itensChecklist.map(item => (
          <div
            key={item.id}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
              item.completo
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}
          >
            {/* Ícone de status */}
            <div className="mt-0.5">
              {item.completo ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400 dark:text-gray-600" />
              )}
            </div>

            {/* Ícone de tipo */}
            <div className="mt-0.5">
              {item.tipo === 'questionario' ? (
                <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              )}
            </div>

            {/* Nome do item */}
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                item.completo
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {item.nome}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {item.tipo === 'questionario' ? 'Pergunta obrigatória' : 'Documento obrigatório'}
              </p>
            </div>

            {/* Badge de status */}
            <div>
              {item.completo ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                  Completo
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                  Pendente
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mensagem de aviso se houver itens pendentes */}
      {!todosCompletos && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Requisitos pendentes
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Complete todos os itens obrigatórios antes de avançar este processo para o próximo departamento.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
