'use client';

import React from 'react';
import { X, Plus, Save, Trash2 } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import LoadingOverlay from '../LoadingOverlay';
import type { Questionario } from '@/app/types';
import { api } from '@/app/utils/api';

interface ModalEditarQuestionarioSolicitacaoProps {
  processoId: number;
  departamentoId: number;
  onClose: () => void;
}

const TIPOS_CAMPO: Array<{ valor: Questionario['tipo']; label: string }> = [
  { valor: 'titulo', label: 'Título (cabeçalho de seção)' },
  { valor: 'text', label: 'Texto Simples' },
  { valor: 'textarea', label: 'Texto Longo' },
  { valor: 'number', label: 'Número' },
  { valor: 'date', label: 'Data' },
  { valor: 'boolean', label: 'Sim/Não' },
  { valor: 'select', label: 'Seleção Única' },
  { valor: 'checkbox', label: 'Checklist' },
  { valor: 'file', label: 'Arquivo/Anexo' },
  { valor: 'phone', label: 'Telefone' },
  { valor: 'email', label: 'Email' },
  { valor: 'cpf', label: 'CPF' },
  { valor: 'cnpj', label: 'CNPJ' },
  { valor: 'cep', label: 'CEP' },
  { valor: 'money', label: 'Valor (R$)' },
  { valor: 'grupo_repetivel', label: 'Grupo Repetível' },
];

const TIPOS_SUB_CAMPO: Array<{ valor: Questionario['tipo']; label: string }> = [
  { valor: 'text', label: 'Texto' },
  { valor: 'textarea', label: 'Texto Longo' },
  { valor: 'number', label: 'Número' },
  { valor: 'date', label: 'Data' },
  { valor: 'boolean', label: 'Sim/Não' },
  { valor: 'select', label: 'Seleção' },
  { valor: 'file', label: 'Arquivo/Anexo' },
  { valor: 'phone', label: 'Telefone' },
  { valor: 'email', label: 'Email' },
  { valor: 'cpf', label: 'CPF' },
  { valor: 'cnpj', label: 'CNPJ' },
  { valor: 'cep', label: 'CEP' },
  { valor: 'money', label: 'Valor (R$)' },
];

export default function ModalEditarQuestionarioSolicitacao({
  processoId,
  departamentoId,
  onClose,
}: ModalEditarQuestionarioSolicitacaoProps) {
  const { processos, departamentos, setProcessos, mostrarAlerta, adicionarNotificacao } = useSistema();

  const processo = processos.find((p) => p.id === processoId);
  const departamento = departamentos.find((d) => d.id === departamentoId);

  const perguntasIniciais = React.useMemo<Questionario[]>(() => {
    const base = (processo?.questionariosPorDepartamento || {}) as any;
    const porNumero = base?.[departamentoId];
    const porString = base?.[String(departamentoId)];
    const arr = (Array.isArray(porNumero) ? porNumero : Array.isArray(porString) ? porString : []) as Questionario[];
    return arr.map((q, idx) => ({ ...q, ordem: q.ordem ?? idx + 1 }));
  }, [processo, departamentoId]);

  const [perguntas, setPerguntas] = React.useState<Questionario[]>(perguntasIniciais);
  const [editando, setEditando] = React.useState<Questionario | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setPerguntas(perguntasIniciais);
  }, [perguntasIniciais]);

  const perguntasDisponiveisCondicao = React.useMemo(() => {
    if (!editando) return [];
    return perguntas
      .filter((p) => Number(p.id) !== Number(editando.id))
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }, [perguntas, editando]);

  const iniciarNovaPergunta = (tipo: Questionario['tipo']) => {
    setEditando({
      id: Date.now(),
      label: '',
      tipo,
      obrigatorio: false,
      opcoes: (tipo === 'select' || tipo === 'checkbox') ? [''] : undefined,
      ordem: perguntas.length + 1,
      ...(tipo === 'grupo_repetivel' ? {
        modoRepeticao: 'manual' as const,
        subPerguntas: [],
      } : {}),
    });
  };

  const salvarPergunta = () => {
    if (!editando) return;
    if (!String(editando.label || '').trim()) {
      void mostrarAlerta('Atenção', 'Digite o texto da pergunta!', 'aviso');
      return;
    }

    const condicaoNormalizada =
      editando.condicao && Number(editando.condicao.perguntaId) > 0
        ? {
            perguntaId: Number(editando.condicao.perguntaId),
            operador: (editando.condicao.operador || 'igual') as 'igual' | 'diferente' | 'contem',
            valor: String(editando.condicao.valor ?? ''),
          }
        : undefined;

    const normalizada: Questionario = {
      ...editando,
      opcoes:
        (editando.tipo === 'select' || editando.tipo === 'checkbox')
          ? (editando.opcoes || []).map((o) => String(o || '').trim()).filter(Boolean)
          : undefined,
      ...(editando.tipo === 'grupo_repetivel' ? {
        modoRepeticao: editando.modoRepeticao || 'manual',
        controladoPor: editando.controladoPor,
        subPerguntas: (editando.subPerguntas || []).filter((sp) => String(sp.label || '').trim()),
      } : {
        modoRepeticao: undefined,
        controladoPor: undefined,
        subPerguntas: undefined,
      }),
      ...(editando.tipo === 'grupo_repetivel'
        ? { condicao: undefined }
        : { condicao: condicaoNormalizada }),
    };

    setPerguntas((prev) => {
      const existe = prev.some((p) => p.id === normalizada.id);
      const next = existe ? prev.map((p) => (p.id === normalizada.id ? normalizada : p)) : [...prev, normalizada];
      return next
        .map((p, idx) => ({ ...p, ordem: idx + 1 }))
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    });

    setEditando(null);
  };

  const excluirPergunta = (id: number) => {
    setPerguntas((prev) => prev.filter((p) => p.id !== id).map((p, idx) => ({ ...p, ordem: idx + 1 })));
  };

  const salvarAlteracoes = () => {
    if (!processo) {
      void mostrarAlerta('Erro', 'Processo não encontrado.', 'erro');
      return;
    }

    void (async () => {
      try {
        setSaving(true);
        await api.salvarQuestionariosProcesso(
          processoId,
          departamentoId,
          perguntas.map((p, idx) => ({ ...p, ordem: idx + 1 })) as any
        );
        // Recarrega o processo completo para refletir em todos os lugares (cards, ver completo, etc.)
        const atualizado = await api.getProcesso(processoId);
        setProcessos((prev: any) => (Array.isArray(prev) ? prev.map((x: any) => (x?.id === processoId ? atualizado : x)) : prev));
        adicionarNotificacao('Questionário atualizado com sucesso', 'sucesso');
        onClose();
      } catch (e: any) {
        void mostrarAlerta('Erro', e?.message || 'Erro ao salvar questionário', 'erro');
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <div className="fixed inset-0 z-[10025] flex items-end justify-center overflow-y-auto bg-black bg-opacity-60 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="relative max-h-[calc(100dvh-0.75rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl sm:max-h-[90vh]">
        <LoadingOverlay show={saving} text="Salvando questionário..." />
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-t-2xl sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white">Editar Quest.</h3>
              <p className="text-white opacity-90 text-sm mt-1">
                {(() => {
                  const nomeEmpresa = processo?.nomeEmpresa;
                  if (nomeEmpresa) return nomeEmpresa;

                  const emp = (processo as any)?.empresa;
                  if (typeof emp === 'string') return emp;
                  if (emp && typeof emp === 'object') {
                    return emp.razao_social || emp.apelido || emp.codigo || 'Processo';
                  }

                  return 'Processo';
                })()}
                {departamento?.nome ? ` • ${departamento.nome}` : ''}
              </p>
            </div>
            <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          {/* Ações: adicionar pergunta */}
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
            <h4 className="font-semibold text-orange-800 mb-3">Adicionar Pergunta</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {TIPOS_CAMPO.map((t) => (
                <button
                  key={t.valor}
                  type="button"
                  onClick={() => iniciarNovaPergunta(t.valor)}
                  className="px-3 py-2 rounded-lg border-2 border-orange-200 hover:border-orange-400 hover:bg-white transition-all font-medium text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus size={14} />
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Editor */}
          {editando && (
            <div className="border-2 border-orange-300 rounded-xl p-4 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Pergunta *</label>
                  <input
                    type="text"
                    value={editando.label}
                    onChange={(e) => setEditando({ ...editando, label: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                    placeholder="Digite o texto da pergunta..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
                  <select
                    value={editando.tipo}
                    onChange={(e) => {
                      const tipo = e.target.value as Questionario['tipo'];
                      setEditando({
                        ...editando,
                        tipo,
                        opcoes: (tipo === 'select' || tipo === 'checkbox') ? editando.opcoes || [''] : undefined,
                        ...(tipo === 'grupo_repetivel' ? {
                          modoRepeticao: editando.modoRepeticao || 'manual',
                          subPerguntas: editando.subPerguntas || [],
                        } : {}),
                      });
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                  >
                    {TIPOS_CAMPO.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editando.obrigatorio)}
                      onChange={(e) => setEditando({ ...editando, obrigatorio: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">Obrigatória</span>
                  </label>
                </div>

                {editando.tipo !== 'grupo_repetivel' && (
                  <div className="md:col-span-2 border border-orange-200 rounded-xl p-3 bg-orange-50/50 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editando.condicao)}
                        onChange={(e) => {
                          if (!e.target.checked) {
                            setEditando({ ...editando, condicao: undefined });
                            return;
                          }
                          const primeiraPergunta = perguntasDisponiveisCondicao[0];
                          setEditando({
                            ...editando,
                            condicao: {
                              perguntaId: primeiraPergunta ? Number(primeiraPergunta.id) : 0,
                              operador: 'igual',
                              valor: '',
                            },
                          });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">Exibir somente com condição</span>
                    </label>

                    {Boolean(editando.condicao) && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Pergunta base</label>
                          <select
                            value={Number(editando.condicao?.perguntaId || 0) || ''}
                            onChange={(e) =>
                              setEditando({
                                ...editando,
                                condicao: {
                                  perguntaId: Number(e.target.value || 0),
                                  operador: editando.condicao?.operador || 'igual',
                                  valor: editando.condicao?.valor || '',
                                },
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                          >
                            <option value="">Selecione...</option>
                            {perguntasDisponiveisCondicao.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label || `Pergunta #${p.id}`}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Operador</label>
                          <select
                            value={editando.condicao?.operador || 'igual'}
                            onChange={(e) =>
                              setEditando({
                                ...editando,
                                condicao: {
                                  perguntaId: Number(editando.condicao?.perguntaId || 0),
                                  operador: e.target.value as 'igual' | 'diferente' | 'contem',
                                  valor: editando.condicao?.valor || '',
                                },
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                          >
                            <option value="igual">Igual</option>
                            <option value="diferente">Diferente</option>
                            <option value="contem">Contém</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Valor</label>
                          <input
                            type="text"
                            value={editando.condicao?.valor || ''}
                            onChange={(e) =>
                              setEditando({
                                ...editando,
                                condicao: {
                                  perguntaId: Number(editando.condicao?.perguntaId || 0),
                                  operador: editando.condicao?.operador || 'igual',
                                  valor: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                            placeholder="Ex.: Sim"
                          />
                        </div>
                      </div>
                    )}

                    {Boolean(editando.condicao) && perguntasDisponiveisCondicao.length === 0 && (
                      <p className="text-xs text-amber-700">
                        Adicione ao menos uma pergunta antes para usar condicional.
                      </p>
                    )}
                  </div>
                )}

                {(editando.tipo === 'select' || editando.tipo === 'checkbox') && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Opções</label>
                    <div className="space-y-2">
                      {(editando.opcoes || ['']).map((op, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            value={op}
                            onChange={(e) => {
                              const next = [...(editando.opcoes || [])];
                              next[idx] = e.target.value;
                              setEditando({ ...editando, opcoes: next });
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            placeholder={`Opção ${idx + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = (editando.opcoes || []).filter((_, i) => i !== idx);
                              setEditando({ ...editando, opcoes: next.length > 0 ? next : [''] });
                            }}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Remover opcao"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => setEditando({ ...editando, opcoes: [...(editando.opcoes || []), ''] })}
                        className="w-full px-4 py-2 border-2 border-dashed border-orange-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 text-orange-700 font-medium"
                      >
                        + Adicionar Opção
                      </button>
                    </div>
                  </div>
                )}

                {editando.tipo === 'grupo_repetivel' && (
                  <div className="md:col-span-2 space-y-4">
                    {/* Modo de repetição */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Modo de Repeticao</label>
                        <select
                          value={editando.modoRepeticao || 'manual'}
                          onChange={(e) => setEditando({ ...editando, modoRepeticao: e.target.value as 'numero' | 'manual' })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="manual">Manual (botão adicionar)</option>
                          <option value="numero">Controlado por número</option>
                        </select>
                      </div>

                      {editando.modoRepeticao === 'numero' && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Controlado por (ID da pergunta)</label>
                          <select
                            value={editando.controladoPor || ''}
                            onChange={(e) => setEditando({ ...editando, controladoPor: e.target.value ? Number(e.target.value) : undefined })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="">Selecione a pergunta controladora...</option>
                            {perguntas.filter((p) => p.tipo === 'number' && p.id !== editando.id).map((p) => (
                              <option key={p.id} value={p.id}>{p.label || `Pergunta #${p.id}`}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Sub-perguntas */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Sub-perguntas do Grupo</label>
                      <div className="space-y-2">
                        {(editando.subPerguntas || []).map((sub, idx) => (
                          <div key={sub.id} className="border border-orange-200 rounded-lg p-3 bg-orange-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <input
                                type="text"
                                value={sub.label}
                                onChange={(e) => {
                                  const next = [...(editando.subPerguntas || [])];
                                  next[idx] = { ...next[idx], label: e.target.value };
                                  setEditando({ ...editando, subPerguntas: next });
                                }}
                                className="md:col-span-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                                placeholder="Texto da sub-pergunta"
                              />
                              <select
                                value={sub.tipo}
                                onChange={(e) => {
                                  const next = [...(editando.subPerguntas || [])];
                                  const novoTipo = e.target.value as Questionario['tipo'];
                                  next[idx] = {
                                    ...next[idx],
                                    tipo: novoTipo,
                                    opcoes: (novoTipo === 'select') ? next[idx].opcoes || [''] : undefined,
                                  };
                                  setEditando({ ...editando, subPerguntas: next });
                                }}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                              >
                                {TIPOS_SUB_CAMPO.map((t) => (
                                  <option key={t.valor} value={t.valor}>{t.label}</option>
                                ))}
                              </select>
                              <div className="flex gap-2 items-center">
                                <label className="flex items-center gap-1 cursor-pointer text-sm">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(sub.obrigatorio)}
                                    onChange={(e) => {
                                      const next = [...(editando.subPerguntas || [])];
                                      next[idx] = { ...next[idx], obrigatorio: e.target.checked };
                                      setEditando({ ...editando, subPerguntas: next });
                                    }}
                                    className="w-3.5 h-3.5"
                                  />
                                  Obrig.
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = (editando.subPerguntas || []).filter((_, i) => i !== idx);
                                    setEditando({ ...editando, subPerguntas: next });
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg ml-auto"
                                  title="Remover sub-pergunta"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Sub-pergunta Condicional */}
                            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                              <label className="flex items-center gap-2 mb-2">
                                <input
                                  type="checkbox"
                                  checked={!!sub.condicao}
                                  onChange={(e) => {
                                    const next = [...(editando.subPerguntas || [])];
                                    if (e.target.checked) {
                                      next[idx] = { ...next[idx], condicao: { perguntaId: 0, operador: 'igual', valor: '' } };
                                    } else {
                                      const { condicao, ...rest } = next[idx] as any;
                                      next[idx] = rest as Questionario;
                                    }
                                    setEditando({ ...editando, subPerguntas: next });
                                  }}
                                  className="w-3.5 h-3.5 text-blue-600 rounded"
                                />
                                <span className="text-xs font-medium text-gray-700">
                                  Condicional (só aparece se...)
                                </span>
                              </label>

                              {sub.condicao && (
                                <div className="space-y-2 mt-2">
                                  <select
                                    value={sub.condicao.perguntaId || ''}
                                    onChange={(e) => {
                                      const next = [...(editando.subPerguntas || [])];
                                      next[idx] = {
                                        ...next[idx],
                                        condicao: { ...(next[idx].condicao || { operador: 'igual', valor: '' }), perguntaId: Number(e.target.value) },
                                      } as Questionario;
                                      setEditando({ ...editando, subPerguntas: next });
                                    }}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                                  >
                                    <option value="">Depende da sub-pergunta...</option>
                                    {(editando.subPerguntas || [])
                                      .filter((s) => s.id !== sub.id && String(s.label || '').trim() !== '')
                                      .map((s) => (
                                        <option key={s.id} value={s.id}>{s.label}</option>
                                      ))}
                                  </select>
                                  <select
                                    value={sub.condicao.operador}
                                    onChange={(e) => {
                                      const next = [...(editando.subPerguntas || [])];
                                      next[idx] = {
                                        ...next[idx],
                                        condicao: { ...(next[idx].condicao as any), operador: e.target.value as any },
                                      } as Questionario;
                                      setEditando({ ...editando, subPerguntas: next });
                                    }}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                                  >
                                    <option value="igual">É igual a</option>
                                    <option value="diferente">É diferente de</option>
                                    <option value="contem">Contém</option>
                                  </select>
                                  <input
                                    type="text"
                                    value={sub.condicao.valor}
                                    onChange={(e) => {
                                      const next = [...(editando.subPerguntas || [])];
                                      next[idx] = {
                                        ...next[idx],
                                        condicao: { ...(next[idx].condicao as any), valor: e.target.value },
                                      } as Questionario;
                                      setEditando({ ...editando, subPerguntas: next });
                                    }}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                                    placeholder="Ex: Sim"
                                  />
                                </div>
                              )}
                            </div>
                            {/* Opções para sub-perguntas do tipo select */}
                            {sub.tipo === 'select' && (
                              <div className="mt-2 pl-2">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Opções da sub-pergunta</label>
                                {(sub.opcoes || ['']).map((op, oIdx) => (
                                  <div key={oIdx} className="flex gap-1 mb-1">
                                    <input
                                      type="text"
                                      value={op}
                                      onChange={(e) => {
                                        const nextSubs = [...(editando.subPerguntas || [])];
                                        const nextOps = [...(nextSubs[idx].opcoes || [])];
                                        nextOps[oIdx] = e.target.value;
                                        nextSubs[idx] = { ...nextSubs[idx], opcoes: nextOps };
                                        setEditando({ ...editando, subPerguntas: nextSubs });
                                      }}
                                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-orange-400"
                                      placeholder={`Opção ${oIdx + 1}`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextSubs = [...(editando.subPerguntas || [])];
                                        const nextOps = (nextSubs[idx].opcoes || []).filter((_, i) => i !== oIdx);
                                        nextSubs[idx] = { ...nextSubs[idx], opcoes: nextOps.length > 0 ? nextOps : [''] };
                                        setEditando({ ...editando, subPerguntas: nextSubs });
                                      }}
                                      className="px-2 py-1 text-red-500 hover:bg-red-50 rounded text-xs"
                                    >
                                      X
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextSubs = [...(editando.subPerguntas || [])];
                                    nextSubs[idx] = { ...nextSubs[idx], opcoes: [...(nextSubs[idx].opcoes || []), ''] };
                                    setEditando({ ...editando, subPerguntas: nextSubs });
                                  }}
                                  className="text-xs text-orange-600 hover:text-orange-800 font-medium mt-1"
                                >
                                  + Opção
                                </button>
                              </div>
                            )}
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => {
                            const novaSub: Questionario = {
                              id: Date.now() + Math.random(),
                              label: '',
                              tipo: 'text',
                              obrigatorio: false,
                              ordem: (editando.subPerguntas || []).length + 1,
                            };
                            setEditando({ ...editando, subPerguntas: [...(editando.subPerguntas || []), novaSub] });
                          }}
                          className="w-full px-4 py-2 border-2 border-dashed border-orange-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 text-orange-700 font-medium text-sm"
                        >
                          + Adicionar Sub-pergunta
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-col-reverse gap-3 border-t border-gray-200 pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setEditando(null)}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={salvarPergunta}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all font-medium flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Salvar Pergunta
                </button>
              </div>
            </div>
          )}

          {/* Lista */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="font-semibold text-gray-800 mb-3">Perguntas ({perguntas.length})</h4>
            {perguntas.length === 0 ? (
              <div className="text-sm text-gray-600">Nenhuma pergunta neste departamento.</div>
            ) : (
              <div className="space-y-2">
                {perguntas
                  .slice()
                  .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                  .map((p, idx) => (
                    <div key={p.id} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 truncate" title={p.label}>
                          {idx + 1}. {p.label}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Tipo: {p.tipo} {p.obrigatorio ? '• Obrigatória' : ''}
                        </div>
                        {(p.tipo === 'select' || p.tipo === 'checkbox') && p.opcoes && p.opcoes.length > 0 && (
                          <div className="text-xs text-gray-600 mt-1 truncate" title={p.opcoes.join(', ')}>
                            Opções: {p.opcoes.join(', ')}
                          </div>
                        )}
                        {p.condicao && (
                          <div className="text-xs text-orange-700 mt-1">
                            Condição: exibir quando &quot;
                            {perguntas.find((x) => Number(x.id) === Number(p.condicao?.perguntaId))?.label || `Pergunta #${p.condicao.perguntaId}`}&quot;
                            {' '}
                            {p.condicao.operador}
                            {' '}
                            &quot;{p.condicao.valor}&quot;
                          </div>
                        )}
                        {p.tipo === 'grupo_repetivel' && (
                          <div className="text-xs text-gray-600 mt-1">
                            Modo: {p.modoRepeticao === 'numero' ? 'Controlado por número' : 'Manual'}
                            {p.subPerguntas && p.subPerguntas.length > 0 && ` | ${p.subPerguntas.length} sub-pergunta(s)`}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setEditando({
                            ...p,
                            opcoes: p.opcoes || ((p.tipo === 'select' || p.tipo === 'checkbox') ? [''] : undefined),
                            ...(p.tipo === 'grupo_repetivel' ? {
                              modoRepeticao: p.modoRepeticao || 'manual',
                              subPerguntas: p.subPerguntas || [],
                              controladoPor: p.controladoPor,
                            } : {}),
                          })}
                          className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 text-sm font-medium"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => excluirPergunta(p.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                          title="Excluir pergunta"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-4 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100 transition-all duration-200 font-medium"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={salvarAlteracoes}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

