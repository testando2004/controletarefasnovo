'use client';

import React, { useState, useEffect } from 'react';
import { Link2, X, ArrowRight, Save, FolderOpen, Edit3, Trash2, Check, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';
import ModalBase from './ModalBase';
import { api } from '@/app/utils/api';
import type { FluxoInterligacao } from '@/app/types';

interface ModalInterligarProps {
  processoNome: string;
  processoId: number;
  templates: Array<{ id: number; nome: string; descricao?: string }>;
  onConfirmar: (templateIds: number[], deptIndependente: boolean, chainToId: number) => Promise<number>;
  onPular: () => void;
  onCancelar?: () => void; // Cancel without finalizing (undo finalization)
  onClose: () => void;
}

export default function ModalInterligar({
  processoNome,
  processoId,
  templates,
  onConfirmar,
  onPular,
  onCancelar,
  onClose,
}: ModalInterligarProps) {
  const [templatesSelecionados, setTemplatesSelecionados] = useState<number[]>([]);
  const [paralelo, setParalelo] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- Fluxos Salvos ---
  const [fluxosSalvos, setFluxosSalvos] = useState<FluxoInterligacao[]>([]);
  const [loadingFluxos, setLoadingFluxos] = useState(false);
  const [showFluxosSalvos, setShowFluxosSalvos] = useState(true);
  const [salvarFluxoAberto, setSalvarFluxoAberto] = useState(false);
  const [novoFluxoNome, setNovoFluxoNome] = useState('');
  const [novoFluxoDescricao, setNovoFluxoDescricao] = useState('');
  const [salvandoFluxo, setSalvandoFluxo] = useState(false);
  const [editandoFluxo, setEditandoFluxo] = useState<number | null>(null);
  const [editFluxoNome, setEditFluxoNome] = useState('');
  const [editFluxoDescricao, setEditFluxoDescricao] = useState('');

  // Carregar fluxos salvos ao montar
  useEffect(() => {
    const carregarFluxos = async () => {
      setLoadingFluxos(true);
      try {
        const dados = await api.getFluxosInterligacao();
        setFluxosSalvos(Array.isArray(dados) ? dados : []);
      } catch (err) {
        console.error('Erro ao carregar fluxos salvos:', err);
      } finally {
        setLoadingFluxos(false);
      }
    };
    carregarFluxos();
  }, []);

  const toggleTemplate = (id: number) => {
    setTemplatesSelecionados(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const moverTemplate = (id: number, direcao: -1 | 1) => {
    setTemplatesSelecionados((prev) => {
      const index = prev.indexOf(id);
      if (index < 0) return prev;
      const nextIndex = index + direcao;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const handleConfirmar = async () => {
    if (templatesSelecionados.length === 0) return;
    setLoading(true);
    try {
      await onConfirmar(templatesSelecionados, paralelo, processoId);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleCancelar = () => {
    if (onCancelar) {
      onCancelar();
    }
    onClose();
  };

  // Aplicar um fluxo salvo (auto-check seus templateIds)
  const aplicarFluxo = (fluxo: FluxoInterligacao) => {
    const idsValidos = fluxo.templateIds.filter(id =>
      templates.some(t => t.id === id)
    );
    setTemplatesSelecionados(idsValidos);
  };

  // Salvar selecao atual como novo fluxo
  const handleSalvarFluxo = async () => {
    if (!novoFluxoNome.trim() || templatesSelecionados.length === 0) return;
    setSalvandoFluxo(true);
    try {
      const novoFluxo = await api.criarFluxoInterligacao({
        nome: novoFluxoNome.trim(),
        descricao: novoFluxoDescricao.trim() || undefined,
        templateIds: templatesSelecionados,
      });
      setFluxosSalvos(prev => [novoFluxo, ...prev]);
      setNovoFluxoNome('');
      setNovoFluxoDescricao('');
      setSalvarFluxoAberto(false);
    } catch (err) {
      console.error('Erro ao salvar fluxo:', err);
    } finally {
      setSalvandoFluxo(false);
    }
  };

  // Iniciar edicao de um fluxo
  const iniciarEdicaoFluxo = (fluxo: FluxoInterligacao) => {
    setEditandoFluxo(fluxo.id);
    setEditFluxoNome(fluxo.nome);
    setEditFluxoDescricao(fluxo.descricao || '');
    // Selecionar os templates do fluxo para edicao visual
    const idsValidos = fluxo.templateIds.filter(id =>
      templates.some(t => t.id === id)
    );
    setTemplatesSelecionados(idsValidos);
  };

  // Salvar edicao de fluxo
  const handleSalvarEdicaoFluxo = async () => {
    if (!editandoFluxo || !editFluxoNome.trim()) return;
    setSalvandoFluxo(true);
    try {
      const atualizado = await api.atualizarFluxoInterligacao(editandoFluxo, {
        nome: editFluxoNome.trim(),
        descricao: editFluxoDescricao.trim() || undefined,
        templateIds: templatesSelecionados,
      });
      setFluxosSalvos(prev => prev.map(f => f.id === editandoFluxo ? atualizado : f));
      setEditandoFluxo(null);
    } catch (err) {
      console.error('Erro ao atualizar fluxo:', err);
    } finally {
      setSalvandoFluxo(false);
    }
  };

  // Excluir fluxo
  const handleExcluirFluxo = async (id: number) => {
    try {
      await api.excluirFluxoInterligacao(id);
      setFluxosSalvos(prev => prev.filter(f => f.id !== id));
      if (editandoFluxo === id) setEditandoFluxo(null);
    } catch (err) {
      console.error('Erro ao excluir fluxo:', err);
    }
  };

  return (
    <ModalBase
      isOpen
      onClose={() => {/* Click fora NAO fecha/finaliza - usar botoes */}}
      labelledBy="interligar-title"
      dialogClassName="w-full max-w-lg bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none max-h-[90vh] overflow-y-auto"
      zIndex={1200}
    >
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 id="interligar-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Interligar Solicitacao
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Processo #{processoId} finalizado
            </p>
          </div>
          <button
            onClick={handleCancelar}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Cancelar (desfaz a finalização)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info */}
        <div className="flex items-start gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <ArrowRight className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
              A solicitacao &quot;{processoNome}&quot; foi finalizada com sucesso!
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
              O historico sera compartilhado e a proxima solicitacao sera criada automaticamente. Se voce escolher mais de uma atividade, as proximas ficam salvas em ordem.
            </p>
          </div>
        </div>

        {/* Fluxos Salvos */}
        {fluxosSalvos.length > 0 && (
          <div className="border border-indigo-200 dark:border-indigo-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowFluxosSalvos(!showFluxosSalvos)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
                  Fluxos Salvos ({fluxosSalvos.length})
                </span>
              </div>
              {showFluxosSalvos ? (
                <ChevronUp className="w-4 h-4 text-indigo-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-indigo-500" />
              )}
            </button>
            {showFluxosSalvos && (
              <div className="p-2 space-y-1.5 max-h-40 overflow-y-auto bg-white dark:bg-transparent">
                {fluxosSalvos.map(fluxo => {
                  const templateNomes = fluxo.templateIds
                    .map(id => templates.find(t => t.id === id)?.nome)
                    .filter(Boolean);
                  const isEditando = editandoFluxo === fluxo.id;

                  return (
                    <div
                      key={fluxo.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group"
                    >
                      {isEditando ? (
                        <div className="flex-1 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editFluxoNome}
                            onChange={(e) => setEditFluxoNome(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-indigo-300 dark:border-indigo-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-indigo-400"
                            placeholder="Nome do fluxo"
                          />
                          <input
                            type="text"
                            value={editFluxoDescricao}
                            onChange={(e) => setEditFluxoDescricao(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-indigo-400"
                            placeholder="Descricao (opcional)"
                          />
                          <p className="text-[10px] text-gray-400">
                            Selecione os templates abaixo e clique em salvar.
                          </p>
                          <div className="flex gap-1.5">
                            <button
                              onClick={handleSalvarEdicaoFluxo}
                              disabled={salvandoFluxo || !editFluxoNome.trim()}
                              className="px-2 py-1 text-[10px] bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50 flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              {salvandoFluxo ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button
                              onClick={() => setEditandoFluxo(null)}
                              className="px-2 py-1 text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-300"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => aplicarFluxo(fluxo)}
                            className="flex-1 text-left min-w-0"
                            title={`Aplicar: ${templateNomes.join(', ')}`}
                          >
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block truncate">
                              {fluxo.nome}
                            </span>
                            {fluxo.descricao && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 block truncate">
                                {fluxo.descricao}
                              </span>
                            )}
                            <span className="text-[10px] text-indigo-500 dark:text-indigo-400 block truncate">
                              {templateNomes.length > 0 ? templateNomes.join(', ') : 'Templates removidos'}
                            </span>
                          </button>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); iniciarEdicaoFluxo(fluxo); }}
                              className="p-1 text-gray-400 hover:text-indigo-500 rounded transition-colors"
                              title="Editar fluxo"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleExcluirFluxo(fluxo.id); }}
                              className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                              title="Excluir fluxo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Selecao dos templates (checkboxes - multipla selecao) */}
        {templates.length > 0 ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Selecione as atividades para continuar:
            </label>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              A primeira atividade sera criada agora. As demais ficarao salvas em fila e so aparecerao quando a anterior for finalizada.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {templates.map((template) => (
                <label
                  key={template.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                    ${templatesSelecionados.includes(template.id)
                      ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-600'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={templatesSelecionados.includes(template.id)}
                    onChange={() => toggleTemplate(template.id)}
                    className="w-4 h-4 text-purple-500 rounded focus:ring-purple-500"
                  />
                  {templatesSelecionados.includes(template.id) && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-xs font-bold text-white">
                      {templatesSelecionados.indexOf(template.id) + 1}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block truncate">
                      {template.nome}
                    </span>
                    {template.descricao && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">
                        {template.descricao}
                      </span>
                    )}
                  </div>
                  {templatesSelecionados.includes(template.id) && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          moverTemplate(template.id, -1);
                        }}
                        className="rounded p-1 text-gray-500 hover:bg-white/70 hover:text-purple-600"
                        title="Mover para cima"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          moverTemplate(template.id, 1);
                        }}
                        className="rounded p-1 text-gray-500 hover:bg-white/70 hover:text-purple-600"
                        title="Mover para baixo"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">
            Nenhuma atividade/template disponivel para interligar.
          </p>
        )}

        {/* Salvar Fluxo - visivel quando ha templates selecionados */}
        {templatesSelecionados.length > 0 && !editandoFluxo && (
          <div>
            {!salvarFluxoAberto ? (
              <button
                onClick={() => setSalvarFluxoAberto(true)}
                className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Salvar selecao como fluxo
              </button>
            ) : (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700 space-y-2">
                <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300">
                  Salvar selecao atual como fluxo reutilizavel:
                </p>
                <input
                  type="text"
                  value={novoFluxoNome}
                  onChange={(e) => setNovoFluxoNome(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-indigo-300 dark:border-indigo-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                  placeholder="Nome do fluxo (ex: Abertura completa)"
                />
                <input
                  type="text"
                  value={novoFluxoDescricao}
                  onChange={(e) => setNovoFluxoDescricao(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                  placeholder="Descricao (opcional)"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSalvarFluxo}
                    disabled={salvandoFluxo || !novoFluxoNome.trim()}
                    className="flex-1 px-3 py-1.5 text-xs bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 flex items-center justify-center gap-1 font-medium"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {salvandoFluxo ? 'Salvando...' : 'Salvar Fluxo'}
                  </button>
                  <button
                    onClick={() => { setSalvarFluxoAberto(false); setNovoFluxoNome(''); setNovoFluxoDescricao(''); }}
                    className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Departamentos paralelos */}
        {templatesSelecionados.length > 0 && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={paralelo}
                onChange={(e) => setParalelo(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
                  Departamentos trabalham em paralelo
                </span>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                  Ative se as solicitacoes interligadas devem ter departamentos independentes.
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Botoes - 3 opcoes claras */}
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { onPular(); onClose(); }}
              className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
            >
              Nao interligar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={templatesSelecionados.length === 0 || loading}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Link2 className="w-4 h-4" />
              {loading ? 'Salvando fila...' : `Criar proxima atividade${templatesSelecionados.length > 1 ? ` (+${templatesSelecionados.length - 1} na fila)` : ''}`}
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            {onCancelar
              ? 'Fechar (X) cancela e desfaz a finalizacao. "Nao interligar" finaliza sem criar continuacao.'
              : 'O processo ja foi finalizado. "Nao interligar" finaliza sem criar continuacao.'}
          </p>
        </div>
      </div>
    </ModalBase>
  );
}
