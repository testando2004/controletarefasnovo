'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, RotateCcw, Clock, FileText, FolderKanban, AlertTriangle, Search, Filter, Loader2, CheckSquare, Square, Eye, ChevronUp, User, MessageSquare, Tag as TagIcon, Home } from 'lucide-react';
import ModalBase from './ModalBase';
import { ItemLixeira } from '@/app/types';
import { api } from '@/app/utils/api';

interface ModalLixeiraProps {
  isOpen: boolean;
  onClose: () => void;
  onRestaurar?: (item: ItemLixeira) => void;
  onExcluirPermanente?: (item: ItemLixeira) => void;
}

type FiltroTipo =
  | 'todos'
  | 'PROCESSO'
  | 'DOCUMENTO'
  | 'DEPARTAMENTO'
  | 'COMENTARIO'
  | 'USUARIO'
  | 'TEMPLATE'
  | 'TAG'
  | 'EMPRESA'
  | 'EMPRESA_DOCUMENTO'
  | 'NOTIFICACAO';

export default function ModalLixeira({ isOpen, onClose, onRestaurar, onExcluirPermanente }: ModalLixeiraProps) {
  const [itens, setItens] = useState<ItemLixeira[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [busca, setBusca] = useState('');
  const [confirmExcluir, setConfirmExcluir] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  
  // Seleção múltipla
  const [itensSelecionados, setItensSelecionados] = useState<Set<number>>(new Set());
  
  // Preview expandido
  const [itemExpandido, setItemExpandido] = useState<number | null>(null);

  // Carregar itens da lixeira
  const carregarItens = async () => {
    try {
      setLoading(true);
      setErro(null);
      const response = await api.getLixeira();
      if (Array.isArray(response)) {
        setItens(response);
      }
    } catch (error: any) {
      console.error('Erro ao carregar lixeira:', error);
      setErro('Erro ao carregar itens da lixeira');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      carregarItens();
      setItensSelecionados(new Set());
      setItemExpandido(null);
    }
  }, [isOpen]);

  // Filtrar itens
  const itensFiltrados = useMemo(() => {
    return itens.filter(item => {
      // Filtro por tipo
      if (filtroTipo !== 'todos' && item.tipoItem !== filtroTipo) {
        return false;
      }
      // Filtro por busca
      if (busca.trim()) {
        const termoBusca = busca.toLowerCase();
        return (
          item.nomeItem?.toLowerCase().includes(termoBusca) ||
          item.descricaoItem?.toLowerCase().includes(termoBusca)
        );
      }
      return true;
    });
  }, [itens, filtroTipo, busca]);

  // Estatísticas
  const stats = useMemo(() => {
    const byType = itens.reduce((acc: any, i) => {
      acc[i.tipoItem] = (acc[i.tipoItem] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const expirando = itens.filter(i => (i.diasRestantes || 0) <= 3).length;
    return { byType, expirando, total: itens.length };
  }, [itens]);

  // Toggle seleção
  const toggleSelecao = (id: number) => {
    setItensSelecionados(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) {
        novo.delete(id);
      } else {
        novo.add(id);
      }
      return novo;
    });
  };

  // Selecionar todos
  const selecionarTodos = () => {
    if (itensSelecionados.size === itensFiltrados.length) {
      setItensSelecionados(new Set());
    } else {
      setItensSelecionados(new Set(itensFiltrados.map(i => i.id)));
    }
  };

  // Restaurar item
  const handleRestaurar = async (item: ItemLixeira) => {
    try {
      setActionLoading(item.id);
      setErro(null);
      setSucesso(null);
      
      await api.restaurarItemLixeira(item.id);
      
      setSucesso(`${item.tipoItem === 'DOCUMENTO' ? 'Documento' : 'Processo'} "${item.nomeItem}" restaurado com sucesso!`);
      setItens(prev => prev.filter(i => i.id !== item.id));
      setItensSelecionados(prev => {
        const novo = new Set(prev);
        novo.delete(item.id);
        return novo;
      });
      
      if (onRestaurar) {
        onRestaurar(item);
      }
      
      // Limpar mensagem após 3 segundos
      setTimeout(() => setSucesso(null), 3000);
    } catch (error: any) {
      console.error('Erro ao restaurar item:', error);
      setErro(error?.message || 'Erro ao restaurar item');
    } finally {
      setActionLoading(null);
    }
  };

  // Restaurar em lote
  const handleRestaurarLote = async () => {
    if (itensSelecionados.size === 0) return;
    
    setBatchLoading(true);
    setErro(null);
    setSucesso(null);
    
    let sucedidos = 0;
    let falhas = 0;
    
    for (const id of itensSelecionados) {
      try {
        await api.restaurarItemLixeira(id);
        sucedidos++;
        setItens(prev => prev.filter(i => i.id !== id));
      } catch {
        falhas++;
      }
    }
    
    setItensSelecionados(new Set());
    setBatchLoading(false);
    
    if (falhas === 0) {
      setSucesso(`${sucedidos} ${sucedidos === 1 ? 'item restaurado' : 'itens restaurados'} com sucesso!`);
    } else {
      setErro(`${sucedidos} restaurados, ${falhas} falharam`);
    }
    
    setTimeout(() => { setSucesso(null); setErro(null); }, 3000);
  };

  // Excluir permanentemente
  const handleExcluirPermanente = async (item: ItemLixeira) => {
    try {
      setActionLoading(item.id);
      setErro(null);
      setSucesso(null);
      
      await api.excluirItemLixeiraPermanente(item.id);
      
      setSucesso(`Item "${item.nomeItem}" excluído permanentemente`);
      setItens(prev => prev.filter(i => i.id !== item.id));
      setConfirmExcluir(null);
      setItensSelecionados(prev => {
        const novo = new Set(prev);
        novo.delete(item.id);
        return novo;
      });
      
      if (onExcluirPermanente) {
        onExcluirPermanente(item);
      }
      
      setTimeout(() => setSucesso(null), 3000);
    } catch (error: any) {
      console.error('Erro ao excluir item:', error);
      setErro(error?.message || 'Erro ao excluir item permanentemente');
    } finally {
      setActionLoading(null);
    }
  };

  // Excluir em lote
  const handleExcluirLote = async () => {
    if (itensSelecionados.size === 0) return;
    
    setBatchLoading(true);
    setErro(null);
    setSucesso(null);
    
    let sucedidos = 0;
    let falhas = 0;
    
    for (const id of itensSelecionados) {
      try {
        await api.excluirItemLixeiraPermanente(id);
        sucedidos++;
        setItens(prev => prev.filter(i => i.id !== id));
      } catch {
        falhas++;
      }
    }
    
    setItensSelecionados(new Set());
    setBatchLoading(false);
    
    if (falhas === 0) {
      setSucesso(`${sucedidos} ${sucedidos === 1 ? 'item excluído' : 'itens excluídos'} permanentemente`);
    } else {
      setErro(`${sucedidos} excluídos, ${falhas} falharam`);
    }
    
    setTimeout(() => { setSucesso(null); setErro(null); }, 3000);
  };

  // Formatar data
  const formatarData = (data: string | Date) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Cor dos dias restantes
  const corDiasRestantes = (dias: number) => {
    if (dias <= 3) return 'text-red-500 bg-red-50 dark:bg-red-900/20';
    if (dias <= 7) return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
    return 'text-green-500 bg-green-50 dark:bg-green-900/20';
  };

  // Ícone do tipo
  const IconeTipo = ({ tipo }: { tipo: string }) => {
    switch (tipo) {
      case 'DOCUMENTO':
      case 'EMPRESA_DOCUMENTO':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'PROCESSO':
        return <FolderKanban className="w-5 h-5 text-purple-500" />;
      case 'DEPARTAMENTO':
        return <FolderKanban className="w-5 h-5 text-amber-500" />;
      case 'COMENTARIO':
        return <MessageSquare className="w-5 h-5 text-green-500" />;
      case 'USUARIO':
        return <User className="w-5 h-5 text-indigo-500" />;
      case 'TAG':
        return <TagIcon className="w-5 h-5 text-pink-500" />;
      case 'EMPRESA':
        return <Home className="w-5 h-5 text-yellow-500" />;
      default:
        return <FolderKanban className="w-5 h-5 text-gray-500" />;
    }
  };

  // Renderizar preview dos dados
  const renderPreview = (item: ItemLixeira) => {
    const dados = item.dadosOriginais;
    if (!dados) return null;

    const formatarTamanho = (bytes: number | string) => {
      const b = Number(bytes);
      if (isNaN(b)) return 'N/A';
      if (b < 1024) return `${b} B`;
      if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
      return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (item.tipoItem === 'DOCUMENTO') {
      return (
        <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 text-sm">
          <div className="grid grid-cols-2 gap-2">
            {dados.tipo && <div><span className="text-gray-500">Tipo:</span> <span className="font-medium">{dados.tipo}</span></div>}
            {dados.tamanho && <div><span className="text-gray-500">Tamanho:</span> <span className="font-medium">{formatarTamanho(dados.tamanho)}</span></div>}
            {dados.processoId && <div><span className="text-gray-500">Processo ID:</span> <span className="font-medium">#{dados.processoId}</span></div>}
            {dados.departamentoId && <div><span className="text-gray-500">Departamento ID:</span> <span className="font-medium">#{dados.departamentoId}</span></div>}
          </div>
        </div>
      );
    }

    if (item.tipoItem === 'PROCESSO') {
      return (
        <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 text-sm">
          <div className="grid grid-cols-2 gap-2">
            {dados.nomeServico && <div><span className="text-gray-500">Serviço:</span> <span className="font-medium">{dados.nomeServico}</span></div>}
            {dados.status && <div><span className="text-gray-500">Status:</span> <span className="font-medium">{dados.status}</span></div>}
            {dados.prioridade && <div><span className="text-gray-500">Prioridade:</span> <span className="font-medium">{dados.prioridade}</span></div>}
            {dados.email && <div><span className="text-gray-500">Email:</span> <span className="font-medium">{dados.email}</span></div>}
            {dados.telefone && <div><span className="text-gray-500">Telefone:</span> <span className="font-medium">{dados.telefone}</span></div>}
          </div>
          {dados.descricao && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-gray-500">Descrição:</span>
              <p className="mt-1 text-gray-700 dark:text-gray-300">{dados.descricao.substring(0, 200)}{dados.descricao.length > 200 ? '...' : ''}</p>
            </div>
          )}
        </div>
      );
    }

    if (item.tipoItem === 'DEPARTAMENTO') {
      return (
        <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 text-sm">
          <div className="grid grid-cols-1 gap-2">
            {dados.nome && <div><span className="text-gray-500">Nome:</span> <span className="font-medium">{dados.nome}</span></div>}
            {dados.responsavel && <div><span className="text-gray-500">Responsável:</span> <span className="font-medium">{dados.responsavel}</span></div>}
            {dados.descricao && <div><span className="text-gray-500">Descrição:</span> <span className="font-medium">{dados.descricao}</span></div>}
          </div>
        </div>
      );
    }

    if (item.tipoItem === 'COMENTARIO') {
      return (
        <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 text-sm">
          <div>
            {dados.texto && <div><span className="text-gray-500">Texto:</span> <p className="mt-1 text-gray-700 dark:text-gray-300">{String(dados.texto).substring(0,300)}</p></div>}
            {dados.autorId && <div className="mt-2"><span className="text-gray-500">Autor ID:</span> <span className="font-medium">#{dados.autorId}</span></div>}
          </div>
        </div>
      );
    }

    if (item.tipoItem === 'USUARIO') {
      return (
        <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 text-sm">
          <div className="grid grid-cols-1 gap-2">
            {dados.nome && <div><span className="text-gray-500">Nome:</span> <span className="font-medium">{dados.nome}</span></div>}
            {dados.email && <div><span className="text-gray-500">Email:</span> <span className="font-medium">{dados.email}</span></div>}
            {typeof dados.ativo !== 'undefined' && <div><span className="text-gray-500">Ativo:</span> <span className="font-medium">{String(dados.ativo)}</span></div>}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} zIndex={1050}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Lixeira
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Itens excluídos são removidos permanentemente após 15 dias
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Estatísticas rápidas */}
        {!loading && itens.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-4">
            {/* Mostrar contadores por tipo dinamicamente */}
            {Object.entries(stats.byType as Record<string, number>).map(([tipo, count]) => {
              const tipoStr = String(tipo);
              const cnt = Number(count) || 0;
              return (
                <div key={tipoStr} className="flex items-center gap-2 text-sm">
                  <IconeTipo tipo={tipoStr} />
                  <span className="text-gray-600 dark:text-gray-400">{cnt} {tipoStr.toLowerCase().replace(/_/g, ' ')}</span>
                </div>
              );
            })}
            {stats.expirando > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-red-600 dark:text-red-400 font-medium">{stats.expirando} expirando em breve!</span>
              </div>
            )}
          </div>
        )}

        {/* Filtros e ações em lote */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 items-center">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar na lixeira..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtro por tipo */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos os tipos</option>
              <option value="DOCUMENTO">Documentos</option>
              <option value="PROCESSO">Processos</option>
              <option value="DEPARTAMENTO">Departamentos</option>
              <option value="COMENTARIO">Comentários</option>
              <option value="USUARIO">Usuários</option>
              <option value="TEMPLATE">Templates</option>
              <option value="TAG">Tags</option>
              <option value="EMPRESA_DOCUMENTO">Documentos da Empresa</option>
              <option value="EMPRESA">Empresas</option>
              <option value="NOTIFICACAO">Notificações</option>
            </select>
          </div>

          {/* Ações em lote */}
          {itensSelecionados.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-500">{itensSelecionados.size} selecionados</span>
              <button
                onClick={handleRestaurarLote}
                disabled={batchLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {batchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Restaurar
              </button>
              <button
                onClick={handleExcluirLote}
                disabled={batchLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {batchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Excluir
              </button>
            </div>
          )}
        </div>

        {/* Mensagens de feedback */}
        {erro && (
          <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="w-4 h-4" />
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="mx-4 mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-300">
            <RotateCcw className="w-4 h-4" />
            {sucesso}
          </div>
        )}

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : itensFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Lixeira vazia
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {busca || filtroTipo !== 'todos' 
                  ? 'Nenhum item encontrado com os filtros aplicados' 
                  : 'Não há itens na lixeira no momento'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Cabeçalho da lista com selecionar todos */}
              <div className="flex items-center gap-2 px-2 py-1">
                <button
                  onClick={selecionarTodos}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {itensSelecionados.size === itensFiltrados.length ? (
                    <CheckSquare className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {itensSelecionados.size === itensFiltrados.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>

              {itensFiltrados.map((item) => (
                <div
                  key={item.id}
                  className={`bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border transition-colors ${
                    itensSelecionados.has(item.id)
                      ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : (item.diasRestantes || 0) <= 3
                        ? 'border-red-200 dark:border-red-800'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelecao(item.id)}
                      className="mt-1 flex-shrink-0"
                    >
                      {itensSelecionados.has(item.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-500" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>

                    {/* Info do item */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5">
                        <IconeTipo tipo={item.tipoItem} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900 dark:text-white truncate">
                            {item.nomeItem}
                          </h4>
                          {(item.diasRestantes || 0) <= 3 && (
                            <span className="flex-shrink-0 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium rounded-full">
                              ⚠️ Expira em breve!
                            </span>
                          )}
                        </div>
                        {item.descricaoItem && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {item.descricaoItem}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Excluído em {formatarData(item.deletadoEm)}{item.deletadoPor?.nome ? ` • por ${item.deletadoPor.nome}` : ''}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${corDiasRestantes(item.diasRestantes || 0)}`}>
                            {item.diasRestantes} {item.diasRestantes === 1 ? 'dia restante' : 'dias restantes'}
                          </span>
                        </div>

                        {/* Preview expandido */}
                        {itemExpandido === item.id && renderPreview(item)}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2">
                      {/* Botão ver detalhes */}
                      <button
                        onClick={() => setItemExpandido(itemExpandido === item.id ? null : item.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                        title={itemExpandido === item.id ? 'Ocultar detalhes' : 'Ver detalhes'}
                      >
                        {itemExpandido === item.id ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>

                      {/* Botão restaurar */}
                      <button
                        onClick={() => handleRestaurar(item)}
                        disabled={actionLoading === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
                        title="Restaurar item"
                      >
                        {actionLoading === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Restaurar</span>
                      </button>

                      {/* Botão excluir permanente */}
                      {confirmExcluir === item.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleExcluirPermanente(item)}
                            disabled={actionLoading === item.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            {actionLoading === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Confirmar'
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmExcluir(null)}
                            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmExcluir(item.id)}
                          disabled={actionLoading === item.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
                          title="Excluir permanentemente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {itensFiltrados.length} {itensFiltrados.length === 1 ? 'item' : 'itens'} na lixeira
              {itensSelecionados.size > 0 && ` • ${itensSelecionados.size} selecionados`}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}
