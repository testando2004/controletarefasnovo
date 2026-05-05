'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import type { Questionario } from '@/app/types';

// Tipos de campo compatíveis com o sistema (ModalQuestionarioProcesso espera esses valores)
const TIPOS_CAMPO: Array<{ valor: Questionario['tipo']; label: string }> = [
  { valor: 'titulo', label: 'Titulo (cabecalho de secao)' },
  { valor: 'text', label: 'Texto Simples' },
  { valor: 'textarea', label: 'Texto Longo' },
  { valor: 'number', label: 'Numero' },
  { valor: 'date', label: 'Data' },
  { valor: 'boolean', label: 'Sim/Nao' },
  { valor: 'select', label: 'Selecao Unica' },
  { valor: 'checkbox', label: 'Checklist' },
  { valor: 'file', label: 'Arquivo/Anexo' },
  { valor: 'phone', label: 'Telefone' },
  { valor: 'email', label: 'Email' },
  { valor: 'cpf', label: 'CPF' },
  { valor: 'cnpj', label: 'CNPJ' },
  { valor: 'cep', label: 'CEP' },
  { valor: 'money', label: 'Valor (R$)' },
  { valor: 'grupo_repetivel', label: 'Grupo Repetivel' },
];

const TIPOS_SUB_CAMPO: Array<{ valor: Questionario['tipo']; label: string }> = [
  { valor: 'text', label: 'Texto' },
  { valor: 'textarea', label: 'Texto Longo' },
  { valor: 'number', label: 'Numero' },
  { valor: 'date', label: 'Data' },
  { valor: 'boolean', label: 'Sim/Nao' },
  { valor: 'select', label: 'Selecao' },
  { valor: 'file', label: 'Arquivo/Anexo' },
  { valor: 'phone', label: 'Telefone' },
  { valor: 'email', label: 'Email' },
  { valor: 'cpf', label: 'CPF' },
  { valor: 'cnpj', label: 'CNPJ' },
  { valor: 'cep', label: 'CEP' },
  { valor: 'money', label: 'Valor (R$)' },
];

interface ModalQuestionarioProps {
  onClose: () => void;
  onSave: (perguntas: Questionario[]) => void;
  perguntasIniciais?: Questionario[];
}

export default function ModalQuestionario({
  onClose,
  onSave,
  perguntasIniciais = [],
}: ModalQuestionarioProps) {
  const [perguntas, setPerguntas] = useState<Questionario[]>(perguntasIniciais);
  const [novaPergunta, setNovaPergunta] = useState<{
    label: string;
    tipo: Questionario['tipo'];
    opcoes: string;
    obrigatorio: boolean;
    // grupo_repetivel
    modoRepeticao: 'numero' | 'manual';
    controladoPor?: number;
    subPerguntas: Questionario[];
  }>({
    label: '',
    tipo: 'text',
    opcoes: '',
    obrigatorio: false,
    modoRepeticao: 'manual',
    subPerguntas: [],
  });

  // Sub-pergunta sendo editada
  const [novaSubPergunta, setNovaSubPergunta] = useState<{
    label: string;
    tipo: Questionario['tipo'];
    obrigatorio: boolean;
    opcoes: string;
    condicao: { perguntaId: number; operador: 'igual' | 'diferente' | 'contem'; valor: string } | null;
  }>({
    label: '',
    tipo: 'text',
    obrigatorio: false,
    opcoes: '',
    condicao: null,
  });

  console.log('[ModalQuestionario] perguntas atuais:', perguntas.map(p => ({ id: p.id, label: p.label, tipo: p.tipo })));

  const handleAdicionarSubPergunta = () => {
    if (!novaSubPergunta.label.trim()) return;

    const sub: Questionario = {
      id: Date.now() + Math.random(),
      label: novaSubPergunta.label,
      tipo: novaSubPergunta.tipo,
      obrigatorio: novaSubPergunta.obrigatorio,
      opcoes: novaSubPergunta.tipo === 'select' ? novaSubPergunta.opcoes.split(',').map(o => o.trim()).filter(Boolean) : undefined,
      ordem: novaPergunta.subPerguntas.length + 1,
      ...(novaSubPergunta.condicao && novaSubPergunta.condicao.perguntaId ? { condicao: novaSubPergunta.condicao } : {}),
    };

    console.log('[ModalQuestionario] adicionando sub-pergunta:', sub);

    setNovaPergunta(prev => ({
      ...prev,
      subPerguntas: [...prev.subPerguntas, sub],
    }));

    setNovaSubPergunta({ label: '', tipo: 'text', obrigatorio: false, opcoes: '', condicao: null });
  };

  const handleRemoverSubPergunta = (subId: number) => {
    setNovaPergunta(prev => ({
      ...prev,
      subPerguntas: prev.subPerguntas.filter(s => s.id !== subId),
    }));
  };

  const handleAdicionarPergunta = () => {
    if (!novaPergunta.label.trim()) return;

    const opcoes =
      (novaPergunta.tipo === 'select' || novaPergunta.tipo === 'checkbox')
        ? novaPergunta.opcoes.split(',').map((o) => o.trim()).filter(Boolean)
        : undefined;

    const pergunta: Questionario = {
      id: Date.now(),
      label: novaPergunta.label,
      tipo: novaPergunta.tipo,
      obrigatorio: novaPergunta.obrigatorio,
      opcoes: opcoes && opcoes.length > 0 ? opcoes : undefined,
      ordem: perguntas.length + 1,
      ...(novaPergunta.tipo === 'grupo_repetivel' ? {
        modoRepeticao: novaPergunta.modoRepeticao,
        controladoPor: novaPergunta.modoRepeticao === 'numero' ? novaPergunta.controladoPor : undefined,
        subPerguntas: novaPergunta.subPerguntas,
      } : {}),
    };

    console.log('[ModalQuestionario] adicionando pergunta:', pergunta);

    setPerguntas([...perguntas, pergunta]);

    setNovaPergunta({
      label: '',
      tipo: 'text',
      opcoes: '',
      obrigatorio: false,
      modoRepeticao: 'manual',
      subPerguntas: [],
    });
    setNovaSubPergunta({ label: '', tipo: 'text', obrigatorio: false, opcoes: '', condicao: null });
  };

  const handleRemoverPergunta = (id: number) => {
    setPerguntas(perguntas.filter((p) => p.id !== id));
  };

  const handleSalvar = () => {
    console.log('[ModalQuestionario] salvando perguntas:', JSON.stringify(perguntas, null, 2));
    onSave(perguntas);
  };

  // Perguntas do tipo 'number' para poder referenciar no controladoPor
  const perguntasNumero = perguntas.filter(p => p.tipo === 'number');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Criar Questionario</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Adicionar Nova Pergunta */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
            <h3 className="font-semibold text-gray-900">Adicionar Pergunta</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pergunta *
              </label>
              <textarea
                value={novaPergunta.label}
                onChange={(e) => setNovaPergunta({ ...novaPergunta, label: e.target.value.slice(0, 200) })}
                maxLength={200}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                rows={2}
                placeholder="Digite a pergunta... (max. 200 caracteres)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo
                </label>
                <select
                  value={novaPergunta.tipo}
                  onChange={(e) => {
                    const tipo = e.target.value as Questionario['tipo'];
                    setNovaPergunta({
                      ...novaPergunta,
                      tipo,
                      opcoes: '',
                      ...(tipo === 'grupo_repetivel' ? { modoRepeticao: 'manual' as const, subPerguntas: [] } : {}),
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  {TIPOS_CAMPO.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={novaPergunta.obrigatorio}
                    onChange={(e) =>
                      setNovaPergunta({ ...novaPergunta, obrigatorio: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Obrigatoria</span>
                </label>
              </div>
            </div>

            {/* Opcoes para select/checkbox */}
            {(novaPergunta.tipo === 'select' || novaPergunta.tipo === 'checkbox') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Opcoes (separadas por virgula)
                </label>
                <input
                  type="text"
                  value={novaPergunta.opcoes}
                  onChange={(e) => setNovaPergunta({ ...novaPergunta, opcoes: e.target.value.slice(0, 200) })}
                  maxLength={200}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Opcao 1, Opcao 2, Opcao 3 (max. 200 caracteres)"
                />
              </div>
            )}

            {/* Config para grupo_repetivel */}
            {novaPergunta.tipo === 'grupo_repetivel' && (
              <div className="space-y-4 border-t border-gray-200 pt-4">
                <h4 className="font-semibold text-cyan-700 text-sm">Configuracao do Grupo Repetivel</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Modo de Repeticao</label>
                    <select
                      value={novaPergunta.modoRepeticao}
                      onChange={(e) => setNovaPergunta({ ...novaPergunta, modoRepeticao: e.target.value as 'numero' | 'manual' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="manual">Manual (botao adicionar)</option>
                      <option value="numero">Controlado por numero</option>
                    </select>
                  </div>

                  {novaPergunta.modoRepeticao === 'numero' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Controlado por (pergunta tipo numero)</label>
                      <select
                        value={novaPergunta.controladoPor || ''}
                        onChange={(e) => setNovaPergunta({ ...novaPergunta, controladoPor: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="">Selecione...</option>
                        {perguntasNumero.map((p) => (
                          <option key={p.id} value={p.id}>{p.label || `Pergunta #${p.id}`}</option>
                        ))}
                      </select>
                      {perguntasNumero.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">Adicione uma pergunta do tipo &quot;Numero&quot; antes para poder referencia-la aqui.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Sub-perguntas */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sub-perguntas do Grupo ({novaPergunta.subPerguntas.length})
                  </label>

                  {novaPergunta.subPerguntas.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {novaPergunta.subPerguntas.map((sub, idx) => (
                        <div key={sub.id} className="bg-cyan-50 border border-cyan-200 rounded-lg p-2 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-gray-900">{idx + 1}. {sub.label}</span>
                              <span className="text-xs text-gray-500 ml-2">({TIPOS_SUB_CAMPO.find(t => t.valor === sub.tipo)?.label || sub.tipo})</span>
                              {sub.obrigatorio && <span className="text-red-500 ml-1 text-xs">*</span>}
                              {sub.opcoes && sub.opcoes.length > 0 && (
                                <span className="text-xs text-gray-500 ml-2">Opcoes: {sub.opcoes.join(', ')}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoverSubPergunta(sub.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {sub.condicao && (
                            <div className="text-xs text-blue-700 mt-1">
                              Condicional: exibir quando &quot;
                              {novaPergunta.subPerguntas.find((x) => Number(x.id) === Number(sub.condicao?.perguntaId))?.label || `Sub-pergunta #${sub.condicao.perguntaId}`}&quot;
                              {' '}{sub.condicao.operador}{' '}
                              &quot;{sub.condicao.valor}&quot;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulario para adicionar sub-pergunta */}
                  <div className="border border-cyan-200 rounded-lg p-3 bg-white space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={novaSubPergunta.label}
                        onChange={(e) => setNovaSubPergunta({ ...novaSubPergunta, label: e.target.value.slice(0, 200) })}
                        className="md:col-span-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                        placeholder="Texto da sub-pergunta"
                      />
                      <select
                        value={novaSubPergunta.tipo}
                        onChange={(e) => setNovaSubPergunta({ ...novaSubPergunta, tipo: e.target.value as Questionario['tipo'] })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                      >
                        {TIPOS_SUB_CAMPO.map((t) => (
                          <option key={t.valor} value={t.valor}>{t.label}</option>
                        ))}
                      </select>
                      <div className="flex gap-2 items-center">
                        <label className="flex items-center gap-1 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={novaSubPergunta.obrigatorio}
                            onChange={(e) => setNovaSubPergunta({ ...novaSubPergunta, obrigatorio: e.target.checked })}
                            className="w-3.5 h-3.5"
                          />
                          Obrig.
                        </label>
                        <button
                          type="button"
                          onClick={handleAdicionarSubPergunta}
                          className="ml-auto px-3 py-1.5 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 text-sm font-medium flex items-center gap-1"
                        >
                          <Plus size={14} />
                          Add
                        </button>
                      </div>
                    </div>

                    {novaSubPergunta.tipo === 'select' && (
                      <div>
                        <input
                          type="text"
                          value={novaSubPergunta.opcoes}
                          onChange={(e) => setNovaSubPergunta({ ...novaSubPergunta, opcoes: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                          placeholder="Opcoes separadas por virgula (ex: Opcao 1, Opcao 2)"
                        />
                      </div>
                    )}

                    {/* Sub-pergunta Condicional (só aparece se já houver outras sub-perguntas cadastradas) */}
                    {novaPergunta.subPerguntas.length > 0 && (
                      <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                        <label className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={!!novaSubPergunta.condicao}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNovaSubPergunta({
                                  ...novaSubPergunta,
                                  condicao: { perguntaId: 0, operador: 'igual', valor: '' },
                                });
                              } else {
                                setNovaSubPergunta({ ...novaSubPergunta, condicao: null });
                              }
                            }}
                            className="w-3.5 h-3.5 text-blue-600 rounded"
                          />
                          <span className="text-xs font-medium text-gray-700">
                            Condicional (só aparece se...)
                          </span>
                        </label>

                        {novaSubPergunta.condicao && (
                          <div className="space-y-2 mt-2">
                            <select
                              value={novaSubPergunta.condicao.perguntaId || ''}
                              onChange={(e) => setNovaSubPergunta({
                                ...novaSubPergunta,
                                condicao: { ...(novaSubPergunta.condicao as any), perguntaId: Number(e.target.value) },
                              })}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                            >
                              <option value="">Depende da sub-pergunta...</option>
                              {novaPergunta.subPerguntas.map((s) => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                            <select
                              value={novaSubPergunta.condicao.operador}
                              onChange={(e) => setNovaSubPergunta({
                                ...novaSubPergunta,
                                condicao: { ...(novaSubPergunta.condicao as any), operador: e.target.value as any },
                              })}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                            >
                              <option value="igual">É igual a</option>
                              <option value="diferente">É diferente de</option>
                              <option value="contem">Contém</option>
                            </select>
                            <input
                              type="text"
                              value={novaSubPergunta.condicao.valor}
                              onChange={(e) => setNovaSubPergunta({
                                ...novaSubPergunta,
                                condicao: { ...(novaSubPergunta.condicao as any), valor: e.target.value },
                              })}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                              placeholder="Ex: Sim"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleAdicionarPergunta}
              disabled={!novaPergunta.label.trim()}
              className="w-full bg-cyan-500 text-white px-4 py-2 rounded-lg hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
              Adicionar Pergunta
            </button>
          </div>

          {/* Lista de Perguntas */}
          {perguntas.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">
                Perguntas ({perguntas.length})
              </h3>
              {perguntas.map((pergunta, index) => (
                <div
                  key={pergunta.id}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {index + 1}. {pergunta.label}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Tipo: {TIPOS_CAMPO.find(t => t.valor === pergunta.tipo)?.label || pergunta.tipo}
                        {pergunta.obrigatorio && ' | Obrigatoria'}
                      </p>
                      {pergunta.opcoes && pergunta.opcoes.length > 0 && (
                        <p className="text-xs text-gray-600 mt-1">
                          Opcoes: {pergunta.opcoes.join(', ')}
                        </p>
                      )}
                      {pergunta.tipo === 'grupo_repetivel' && (
                        <div className="text-xs text-gray-600 mt-1">
                          Modo: {pergunta.modoRepeticao === 'numero' ? 'Controlado por numero' : 'Manual'}
                          {pergunta.subPerguntas && pergunta.subPerguntas.length > 0 && (
                            <span> | {pergunta.subPerguntas.length} sub-pergunta(s): {pergunta.subPerguntas.map(s => s.label).join(', ')}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoverPergunta(pergunta.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Botoes de Acao */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all font-medium flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Salvar Questionario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
