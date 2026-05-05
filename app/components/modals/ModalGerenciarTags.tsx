'use client';

import React, { useState } from 'react';
import { X, Edit, Check } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import { api } from '@/app/utils/api';
import ModalBase from './ModalBase';

interface ModalGerenciarTagsProps {
  onClose: () => void;
}

export default function ModalGerenciarTags({ onClose }: ModalGerenciarTagsProps) {
  const { tags, setTags, mostrarAlerta, mostrarConfirmacao, adicionarNotificacao } = useSistema();
  const [editando, setEditando] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [novaTag, setNovaTag] = useState({
    nome: '',
    cor: 'bg-red-500',
    texto: 'text-white',
  });

  const coresDisponiveis = [
    { bg: 'bg-red-500', text: 'text-white', nome: 'Vermelho' },
    { bg: 'bg-orange-500', text: 'text-white', nome: 'Laranja' },
    { bg: 'bg-yellow-500', text: 'text-white', nome: 'Amarelo' },
    { bg: 'bg-green-500', text: 'text-white', nome: 'Verde' },
    { bg: 'bg-blue-500', text: 'text-white', nome: 'Azul' },
    { bg: 'bg-indigo-500', text: 'text-white', nome: 'Índigo' },
    { bg: 'bg-purple-500', text: 'text-white', nome: 'Roxo' },
    { bg: 'bg-pink-500', text: 'text-white', nome: 'Rosa' },
    { bg: 'bg-gray-500', text: 'text-white', nome: 'Cinza' },
    { bg: 'bg-cyan-500', text: 'text-white', nome: 'Ciano' },
    { bg: 'bg-emerald-500', text: 'text-white', nome: 'Esmeralda' },
    { bg: 'bg-amber-500', text: 'text-white', nome: 'Âmbar' },
  ];

  const adicionarTag = async (tag: { nome: string; cor: string; texto?: string }) => {
    try {
      setLoading(true);
      const nova = await api.salvarTag({
        nome: tag.nome,
        cor: tag.cor,
        texto: tag.texto || 'text-white',
      });
      setTags((prev) => [...(prev || []), nova]);
      adicionarNotificacao('Tag criada com sucesso', 'sucesso');
      api.registrarLog?.({
        acao: 'CRIAR', entidade: 'TAG', entidadeId: nova?.id,
        entidadeNome: tag.nome,
        detalhes: `Tag criada: "${tag.nome}"`,
      });
      setNovaTag({ nome: '', cor: 'bg-red-500', texto: 'text-white' });
    } catch (error: any) {
      adicionarNotificacao(error.message || 'Erro ao criar tag', 'erro');
      await mostrarAlerta('Erro', error.message || 'Erro ao criar tag', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const editarTag = async (tagId: number, dados: any) => {
    try {
      setLoading(true);
      const atualizada = await api.atualizarTag(tagId, dados);
      setTags((prev) => (prev || []).map((t) => (t.id === tagId ? atualizada : t)));
      adicionarNotificacao('Tag atualizada com sucesso', 'sucesso');
      api.registrarLog?.({
        acao: 'EDITAR', entidade: 'TAG', entidadeId: tagId,
        entidadeNome: dados.nome,
        detalhes: `Tag editada: "${dados.nome}"`,
      });
      setEditando(null);
    } catch (error: any) {
      adicionarNotificacao(error.message || 'Erro ao atualizar tag', 'erro');
      await mostrarAlerta('Erro', error.message || 'Erro ao atualizar tag', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const excluirTagDireta = async (tagId: number) => {
    const tag = (tags || []).find((t) => t.id === tagId);
    const ok = await mostrarConfirmacao({
      titulo: 'Excluir Tag',
      mensagem: `Tem certeza que deseja excluir a tag "${tag?.nome || ''}"?\n\nEsta ação não poderá ser desfeita.`,
      tipo: 'perigo',
      textoConfirmar: 'Sim, Excluir',
      textoCancelar: 'Cancelar',
    });
    if (!ok) return;

    try {
      setLoading(true);
      await api.excluirTag(tagId);
      setTags((prev) => (prev || []).filter((t) => t.id !== tagId));
      adicionarNotificacao('Tag excluída com sucesso', 'sucesso');
      api.registrarLog?.({
        acao: 'EXCLUIR', entidade: 'TAG', entidadeId: tagId,
        entidadeNome: tag?.nome,
        detalhes: `Tag excluída: "${tag?.nome || ''}"`,
      });
      if (editando?.id === tagId) setEditando(null);
    } catch (error: any) {
      adicionarNotificacao(error.message || 'Erro ao excluir tag', 'erro');
      await mostrarAlerta('Erro', error.message || 'Erro ao excluir tag', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarNova = async () => {
    if (!novaTag.nome.trim()) {
      await mostrarAlerta('Atenção', 'Digite o nome da tag!', 'aviso');
      return;
    }
    await adicionarTag(novaTag);
  };

  const handleSalvarEdicao = async () => {
    if (!editando) return;
    await editarTag(editando.id, {
      nome: editando.nome,
      cor: editando.cor,
      texto: editando.texto || 'text-white',
    });
  };

  return (
    <ModalBase
      isOpen
      onClose={onClose}
      labelledBy="gerenciar-tags-title"
      dialogClassName="w-full max-w-3xl bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none max-h-[90vh] overflow-y-auto"
      zIndex={1060}
    >
      <div className="rounded-2xl">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <h3 id="gerenciar-tags-title" className="text-xl font-bold text-white">Gerenciar Tags</h3>
            <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
            <h4 className="font-semibold text-gray-800 mb-3">Criar Nova Tag</h4>
            <div className="space-y-4">
              <input
                type="text"
                value={novaTag.nome}
                onChange={(e) => setNovaTag({ ...novaTag, nome: e.target.value })}
                placeholder="Nome da tag (ex: Urgente, Revisão, etc.)"
                className="w-full px-4 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Selecione a Cor:</label>
                <div className="grid grid-cols-6 gap-2">
                  {coresDisponiveis.map((cor, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setNovaTag({ ...novaTag, cor: cor.bg, texto: cor.text })}
                      className={`w-10 h-10 rounded-full ${cor.bg} border-2 ${
                        novaTag.cor === cor.bg
                          ? 'border-gray-800 ring-2 ring-offset-2 ring-gray-400'
                          : 'border-transparent'
                      } transition-all hover:scale-110`}
                      title={cor.nome}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Cor selecionada: {coresDisponiveis.find((c) => c.bg === novaTag.cor)?.nome}
                </p>
              </div>

              <button
                onClick={handleSalvarNova}
                disabled={loading}
                className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Salvando...' : 'Criar Tag'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-800 dark:text-[var(--fg)]">Tags Existentes ({(tags || []).length})</h4>

            {(tags || []).map((tag) => (
              <div key={tag.id} className="flex items-center justify-between bg-gray-50 dark:bg-[var(--muted)] p-4 rounded-lg border border-gray-200 dark:border-[var(--border)]">
                {editando?.id === tag.id ? (
                  <div className="flex gap-3 flex-1 items-center">
                    <input
                      type="text"
                      value={editando.nome}
                      onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                    />

                    <select
                      value={editando.cor}
                      onChange={(e) => {
                        const corSelecionada = coresDisponiveis.find((c) => c.bg === e.target.value);
                        setEditando({
                          ...editando,
                          cor: e.target.value,
                          texto: corSelecionada?.text || 'text-white',
                        });
                      }}
                      className="px-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                    >
                      {coresDisponiveis.map((cor) => (
                        <option key={cor.bg} value={cor.bg}>
                          {cor.nome}
                        </option>
                      ))}
                    </select>

                    <button onClick={handleSalvarEdicao} className="text-green-600 hover:text-green-700 p-2">
                      <Check size={20} />
                    </button>
                    <button onClick={() => setEditando(null)} className="text-gray-600 hover:text-gray-700 p-2">
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${tag.cor}`}></div>
                      <span className={`${tag.cor} ${tag.texto || 'text-white'} px-3 py-1 rounded-full text-sm font-medium`}>
                        {tag.nome}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditando(tag)}
                        className="text-blue-600 hover:text-blue-700 p-2"
                        title="Editar tag"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          excluirTagDireta(tag.id);
                        }}
                        className="text-red-600 hover:text-red-700 p-2"
                        title="Excluir tag"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalBase>
  );
}
