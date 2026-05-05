'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  FolderOpen,
  Plus,
  Search,
  Building2,
  Calendar,
  User as UserIcon,
  CheckCircle2,
  Clock,
  Pause,
  XCircle,
  FolderPlus,
  Filter,
  Trash2,
} from 'lucide-react';
import { api } from '@/app/utils/api';
import { useSistema } from '@/app/context/SistemaContext';
import type { Projeto, StatusProjeto } from '@/app/types';
import { formatarData } from '@/app/utils/helpers';
import LoadingOverlay from '@/app/components/LoadingOverlay';

interface SecaoProjetosProps {
  onAbrirProjeto: (projetoId: number) => void;
}

const STATUS_CONFIG: Record<StatusProjeto, { label: string; cor: string; icone: any }> = {
  EM_ANDAMENTO: { label: 'Em Andamento', cor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icone: Clock },
  CONCLUIDO:    { label: 'Concluído',    cor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icone: CheckCircle2 },
  PAUSADO:      { label: 'Pausado',      cor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icone: Pause },
  CANCELADO:    { label: 'Cancelado',    cor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icone: XCircle },
};

export default function SecaoProjetos({ onAbrirProjeto }: SecaoProjetosProps) {
  const { empresas, usuarios, usuarioLogado, mostrarAlerta, mostrarConfirmacao, adicionarNotificacao } = useSistema();

  const podeExcluirProjeto = (() => {
    const role = String(usuarioLogado?.role || '').toUpperCase();
    return role === 'ADMIN' || role === 'ADMIN_DEPARTAMENTO' || role === 'GERENTE';
  })();

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'' | StatusProjeto>('');
  const [filtroEmpresa, setFiltroEmpresa] = useState<number | ''>('');

  // Modal de criação
  const [criarAberto, setCriarAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoDescricao, setNovoDescricao] = useState('');
  const [novoEmpresaId, setNovoEmpresaId] = useState<number | ''>('');
  const [novoResponsavelId, setNovoResponsavelId] = useState<number | ''>('');
  const [novoDataEntrega, setNovoDataEntrega] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      setLoading(true);
      const dados = await api.getProjetos();
      setProjetos(Array.isArray(dados) ? dados : []);
    } catch (e: any) {
      adicionarNotificacao(e?.message || 'Erro ao carregar projetos', 'erro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const projetosFiltrados = useMemo(() => {
    const q = filtroBusca.trim().toLowerCase();
    return (projetos || []).filter((p) => {
      if (filtroStatus && p.status !== filtroStatus) return false;
      if (filtroEmpresa && p.empresaId !== filtroEmpresa) return false;
      if (!q) return true;
      const campos = [p.nome, p.descricao || '', (p as any).empresa?.razao_social || ''].join(' ').toLowerCase();
      return campos.includes(q);
    });
  }, [projetos, filtroBusca, filtroStatus, filtroEmpresa]);

  const handleExcluirProjeto = async (projeto: Projeto) => {
    const totalProcessos = projeto.processosCount || 0;
    const detalheProcessos = totalProcessos > 0
      ? `\n\n⚠️ Este projeto tem ${totalProcessos} solicitaç${totalProcessos === 1 ? 'ão' : 'ões'} vinculada${totalProcessos === 1 ? '' : 's'}.\nEla${totalProcessos === 1 ? '' : 's'} ${totalProcessos === 1 ? 'será desvinculada' : 'serão desvinculadas'} (não excluída${totalProcessos === 1 ? '' : 's'}).`
      : '';

    const confirmado = await mostrarConfirmacao({
      titulo: 'Excluir Projeto',
      mensagem: `Tem certeza que deseja excluir o projeto "${projeto.nome}"?${detalheProcessos}\n\nEsta ação não poderá ser desfeita.`,
      tipo: 'perigo',
      textoConfirmar: 'Sim, Excluir',
      textoCancelar: 'Cancelar',
    });
    if (!confirmado) return;

    try {
      await api.excluirProjeto(projeto.id);
      adicionarNotificacao('Projeto excluído com sucesso', 'sucesso');
      setProjetos((prev) => prev.filter((x) => x.id !== projeto.id));
    } catch (e: any) {
      await mostrarAlerta('Erro', e?.message || 'Erro ao excluir projeto', 'erro');
    }
  };

  const handleCriar = async () => {
    if (!novoNome.trim()) {
      await mostrarAlerta('Atenção', 'Digite o nome do projeto.', 'aviso');
      return;
    }
    try {
      setSalvando(true);
      const criado = await api.criarProjeto({
        nome: novoNome.trim(),
        descricao: novoDescricao.trim() || undefined,
        empresaId: typeof novoEmpresaId === 'number' ? novoEmpresaId : null,
        responsavelId: typeof novoResponsavelId === 'number' ? novoResponsavelId : null,
        dataEntrega: novoDataEntrega || null,
      });
      adicionarNotificacao('Projeto criado com sucesso', 'sucesso');
      setCriarAberto(false);
      setNovoNome('');
      setNovoDescricao('');
      setNovoEmpresaId('');
      setNovoResponsavelId('');
      setNovoDataEntrega('');
      await carregar();
      onAbrirProjeto(Number(criado?.id));
    } catch (e: any) {
      await mostrarAlerta('Erro', e?.message || 'Erro ao criar projeto', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      <LoadingOverlay show={loading && projetos.length === 0} text="Carregando projetos..." />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--fg)] flex items-center gap-2">
            <FolderOpen className="text-indigo-500" size={28} />
            Projetos
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Agrupe solicitações relacionadas ao mesmo assunto (ex.: Abertura de Empresa, Alteração Contratual).
          </p>
        </div>
        <button
          onClick={() => setCriarAberto(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2.5 rounded-xl hover:shadow-lg transition-all font-medium"
        >
          <FolderPlus size={18} />
          Novo Projeto
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-gray-200 dark:border-[var(--border)] p-3 flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filtroBusca}
            onChange={(e) => setFiltroBusca(e.target.value)}
            placeholder="Buscar por nome, descrição ou empresa..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg bg-white dark:bg-slate-900 text-sm"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg bg-white dark:bg-slate-900 text-sm"
        >
          <option value="">Todos status</option>
          <option value="EM_ANDAMENTO">Em Andamento</option>
          <option value="CONCLUIDO">Concluído</option>
          <option value="PAUSADO">Pausado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <select
          value={filtroEmpresa}
          onChange={(e) => setFiltroEmpresa(e.target.value ? Number(e.target.value) : '')}
          className="px-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg bg-white dark:bg-slate-900 text-sm max-w-xs"
        >
          <option value="">Todas empresas</option>
          {(empresas || []).map((e: any) => (
            <option key={e.id} value={e.id}>{e.razao_social || e.codigo || `#${e.id}`}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {projetosFiltrados.length === 0 && !loading ? (
        <div className="bg-white dark:bg-[var(--card)] rounded-xl border border-gray-200 dark:border-[var(--border)] p-12 text-center">
          <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {projetos.length === 0 ? 'Nenhum projeto ainda' : 'Nenhum projeto corresponde aos filtros'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {projetos.length === 0
              ? 'Projetos agrupam várias solicitações relacionadas — útil para acompanhar coisas como "Abertura de Empresa — Cliente X" do início ao fim.'
              : 'Ajuste os filtros ou crie um novo projeto.'}
          </p>
          {projetos.length === 0 && (
            <button
              onClick={() => setCriarAberto(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-5 py-2.5 rounded-xl hover:shadow-lg transition-all font-medium"
            >
              <FolderPlus size={18} />
              Criar Primeiro Projeto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projetosFiltrados.map((p) => {
            const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.EM_ANDAMENTO;
            const StatusIcon = st.icone;
            const responsavelNome = (p as any).responsavel?.nome;
            const empresaNome = (p as any).empresa?.razao_social || (p as any).empresa?.codigo;
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => onAbrirProjeto(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onAbrirProjeto(p.id);
                  }
                }}
                className="relative text-left bg-white dark:bg-[var(--card)] rounded-xl border border-gray-200 dark:border-[var(--border)] p-4 hover:shadow-lg hover:border-indigo-300 transition-all flex flex-col gap-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {podeExcluirProjeto && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleExcluirProjeto(p);
                    }}
                    title="Excluir projeto"
                    aria-label="Excluir projeto"
                    className="absolute top-2 right-2 p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors z-10"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <div className="flex items-start justify-between gap-2 pr-7">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-[var(--fg)] truncate">{p.nome}</h3>
                    {p.descricao && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{p.descricao}</p>
                    )}
                  </div>
                  <span className={`${st.cor} text-[10px] px-2 py-1 rounded-full font-semibold whitespace-nowrap flex items-center gap-1 flex-shrink-0`}>
                    <StatusIcon size={10} />
                    {st.label}
                  </span>
                </div>

                {empresaNome && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                    <Building2 size={12} className="text-gray-400" />
                    <span className="truncate">{empresaNome}</span>
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                  {responsavelNome && (
                    <span className="flex items-center gap-1">
                      <UserIcon size={12} />
                      {responsavelNome}
                    </span>
                  )}
                  {p.dataEntrega && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatarData(p.dataEntrega as any)}
                    </span>
                  )}
                  <span className="flex items-center gap-1 ml-auto">
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                      {p.processosCount || 0}
                    </span>
                    solicitaç{(p.processosCount || 0) === 1 ? 'ão' : 'ões'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de criação inline */}
      {criarAberto && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-lg">
            <LoadingOverlay show={salvando} text="Criando projeto..." />
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-5 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FolderPlus size={20} />
                Novo Projeto
              </h3>
              <button
                onClick={() => setCriarAberto(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg"
                aria-label="Fechar"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex.: Abertura de Empresa — ACME Ltda"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                <textarea
                  value={novoDescricao}
                  onChange={(e) => setNovoDescricao(e.target.value)}
                  rows={2}
                  placeholder="Detalhes do projeto (opcional)..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Empresa</label>
                  <select
                    value={novoEmpresaId}
                    onChange={(e) => setNovoEmpresaId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg text-sm"
                  >
                    <option value="">— Sem empresa —</option>
                    {(empresas || []).map((e: any) => (
                      <option key={e.id} value={e.id}>{e.razao_social || e.codigo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Responsável</label>
                  <select
                    value={novoResponsavelId}
                    onChange={(e) => setNovoResponsavelId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg text-sm"
                  >
                    <option value="">— Ninguém —</option>
                    {(usuarios || []).filter((u: any) => u.ativo !== false).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Prazo (opcional)</label>
                <input
                  type="date"
                  value={novoDataEntrega}
                  onChange={(e) => setNovoDataEntrega(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 dark:border-[var(--border)] flex gap-3">
              <button
                onClick={() => setCriarAberto(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleCriar}
                disabled={!novoNome.trim() || salvando}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg disabled:opacity-50 font-medium"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
