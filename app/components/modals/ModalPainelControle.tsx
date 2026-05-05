'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Shield, Users, Settings, WifiOff, RefreshCw, Power, AlertTriangle, Monitor, Activity } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import ModalBase from './ModalBase';

interface SessaoAtiva {
  id: number;
  usuarioId: number;
  usuario?: { id: number; nome: string; email: string; role: string };
  ip?: string;
  userAgent?: string;
  criadoEm: string;
  ultimoAcesso: string;
  ativo: boolean;
}

interface ModalPainelControleProps {
  onClose: () => void;
}

export default function ModalPainelControle({ onClose }: ModalPainelControleProps) {
  const { mostrarAlerta, mostrarConfirmacao, adicionarNotificacao } = useSistema();
  const [abaAtiva, setAbaAtiva] = useState<'sessoes' | 'manutencao' | 'sistema'>('sessoes');
  const [sessoes, setSessoes] = useState<SessaoAtiva[]>([]);
  const [modoManutencao, setModoManutencao] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingSessoes, setLoadingSessoes] = useState(false);

  const carregarSessoes = useCallback(async () => {
    setLoadingSessoes(true);
    try {
      const res = await fetch('/api/admin/sessoes');
      if (res.ok) {
        const data = await res.json();
        setSessoes(data.sessoes || []);
      }
    } catch (err) {
      console.error('Erro ao carregar sessões:', err);
    } finally {
      setLoadingSessoes(false);
    }
  }, []);

  const carregarManutencao = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/manutencao');
      if (res.ok) {
        const data = await res.json();
        setModoManutencao(data.ativo || false);
      }
    } catch (err) {
      console.error('Erro ao carregar modo manutenção:', err);
    }
  }, []);

  useEffect(() => {
    carregarSessoes();
    carregarManutencao();
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(() => {
      carregarSessoes();
    }, 30000);
    return () => clearInterval(interval);
  }, [carregarSessoes, carregarManutencao]);

  const desconectarSessao = async (sessaoId: number, nomeUsuario: string) => {
    const ok = await mostrarConfirmacao({
      titulo: 'Desconectar Sessão',
      mensagem: `Deseja desconectar a sessão de "${nomeUsuario}"?`,
      tipo: 'perigo',
      textoConfirmar: 'Desconectar',
      textoCancelar: 'Cancelar',
    });
    if (!ok) return;

    try {
      const res = await fetch('/api/admin/sessoes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessaoId }),
      });
      if (res.ok) {
        adicionarNotificacao(`Sessão de ${nomeUsuario} desconectada`, 'sucesso');
        carregarSessoes();
      }
    } catch (err) {
      adicionarNotificacao('Erro ao desconectar sessão', 'erro');
    }
  };

  const desconectarTodas = async () => {
    const ok = await mostrarConfirmacao({
      titulo: 'Desconectar Todas',
      mensagem: 'Deseja desconectar TODAS as sessões ativas (exceto a sua)?',
      tipo: 'perigo',
      textoConfirmar: 'Desconectar Todas',
      textoCancelar: 'Cancelar',
    });
    if (!ok) return;

    try {
      const res = await fetch('/api/admin/sessoes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todas: true }),
      });
      if (res.ok) {
        adicionarNotificacao('Todas as sessões foram desconectadas', 'sucesso');
        carregarSessoes();
      }
    } catch (err) {
      adicionarNotificacao('Erro ao desconectar sessões', 'erro');
    }
  };

  const toggleManutencao = async () => {
    const novoEstado = !modoManutencao;
    const ok = await mostrarConfirmacao({
      titulo: novoEstado ? 'Ativar Manutenção' : 'Desativar Manutenção',
      mensagem: novoEstado
        ? 'Ao ativar, TODOS os usuários (exceto ghost e master) serão redirecionados para a tela de manutenção em tempo real.'
        : 'Ao desativar, o sistema voltará ao normal para todos os usuários.',
      tipo: novoEstado ? 'perigo' : 'info',
      textoConfirmar: novoEstado ? 'Ativar Manutenção' : 'Desativar Manutenção',
      textoCancelar: 'Cancelar',
    });
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/manutencao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: novoEstado }),
      });
      if (res.ok) {
        setModoManutencao(novoEstado);
        adicionarNotificacao(
          novoEstado ? 'Modo manutenção ATIVADO' : 'Modo manutenção DESATIVADO',
          novoEstado ? 'info' : 'sucesso'
        );
      }
    } catch (err) {
      adicionarNotificacao('Erro ao alterar modo manutenção', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR');
  };

  const tempoAtras = (data: string) => {
    const diff = Date.now() - new Date(data).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  return (
    <ModalBase
      isOpen
      onClose={onClose}
      labelledBy="painel-controle-title"
      dialogClassName="w-full max-w-5xl bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none max-h-[90vh] overflow-y-auto"
      zIndex={1090}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-800 p-6 rounded-t-2xl sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="text-white" size={24} />
            <h3 id="painel-controle-title" className="text-xl font-bold text-white">Painel de Controle</h3>
            <span className="bg-red-900/50 text-red-200 text-xs px-2 py-1 rounded-full">GHOST</span>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Abas */}
        <div className="flex gap-2 mt-4">
          {[
            { id: 'sessoes' as const, label: 'Sessões Ativas', icon: Users },
            { id: 'manutencao' as const, label: 'Manutenção', icon: Settings },
            { id: 'sistema' as const, label: 'Sistema', icon: Monitor },
          ].map(aba => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                abaAtiva === aba.id
                  ? 'bg-white text-red-700'
                  : 'text-white/80 hover:bg-white/20'
              }`}
            >
              <aba.icon size={16} />
              {aba.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Aba: Sessões Ativas */}
        {abaAtiva === 'sessoes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-gray-800 dark:text-[var(--fg)]">
                Sessões Ativas ({sessoes.filter(s => s.ativo).length})
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={carregarSessoes}
                  disabled={loadingSessoes}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-[var(--muted)] text-gray-700 dark:text-[var(--fg)] rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <RefreshCw size={14} className={loadingSessoes ? 'animate-spin' : ''} />
                  Atualizar
                </button>
                <button
                  onClick={desconectarTodas}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <Power size={14} />
                  Desconectar Todas
                </button>
              </div>
            </div>

            {sessoes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users size={48} className="mx-auto mb-2 opacity-30" />
                <p>Nenhuma sessão ativa encontrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessoes.filter(s => s.ativo).map(sessao => (
                  <div key={sessao.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[var(--muted)] rounded-lg border border-gray-200 dark:border-[var(--border)]">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <div>
                        <div className="font-medium text-sm dark:text-[var(--fg)]">
                          {sessao.usuario?.nome || 'Desconhecido'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {sessao.usuario?.email} • {sessao.usuario?.role?.toUpperCase()}
                        </div>
                        <div className="text-xs text-gray-400">
                          IP: {sessao.ip || 'N/A'} • Último acesso: {tempoAtras(sessao.ultimoAcesso)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => desconectarSessao(sessao.id, sessao.usuario?.nome || 'Desconhecido')}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="Desconectar"
                    >
                      <WifiOff size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Aba: Manutenção */}
        {abaAtiva === 'manutencao' && (
          <div className="space-y-6">
            <div className={`p-6 rounded-xl border-2 ${
              modoManutencao
                ? 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700'
                : 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {modoManutencao ? (
                    <AlertTriangle className="text-red-600" size={32} />
                  ) : (
                    <Activity className="text-green-600" size={32} />
                  )}
                  <div>
                    <h4 className="text-lg font-bold text-gray-800 dark:text-[var(--fg)]">
                      {modoManutencao ? 'MANUTENÇÃO ATIVA' : 'Sistema Operacional'}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {modoManutencao
                        ? 'Apenas ghost e master têm acesso ao sistema'
                        : 'Todos os usuários podem acessar normalmente'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={toggleManutencao}
                  disabled={loading}
                  className={`px-6 py-3 rounded-lg font-bold text-white transition-all ${
                    modoManutencao
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  } disabled:opacity-50`}
                >
                  {loading ? 'Processando...' : modoManutencao ? 'Desativar Manutenção' : 'Ativar Manutenção'}
                </button>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-xl p-4">
              <h5 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Como funciona:</h5>
              <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                <li>• Ao ativar, todos os usuários verão a tela de manutenção em tempo real</li>
                <li>• Não é necessário que eles atualizem a página</li>
                <li>• Apenas o ghost user e o master user mantêm acesso</li>
                <li>• Ao desativar, o acesso é restaurado automaticamente</li>
              </ul>
            </div>
          </div>
        )}

        {/* Aba: Sistema */}
        {abaAtiva === 'sistema' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Status do Sistema</div>
                <div className="text-2xl font-bold text-blue-800 dark:text-blue-300 mt-1">
                  {modoManutencao ? 'Em Manutenção' : 'Operacional'}
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
                <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Sessões Ativas</div>
                <div className="text-2xl font-bold text-purple-800 dark:text-purple-300 mt-1">
                  {sessoes.filter(s => s.ativo).length}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-700">
                <div className="text-sm text-green-600 dark:text-green-400 font-medium">Versão</div>
                <div className="text-2xl font-bold text-green-800 dark:text-green-300 mt-1">2.0</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-700">
                <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">Ambiente</div>
                <div className="text-2xl font-bold text-orange-800 dark:text-orange-300 mt-1">
                  {process.env.NODE_ENV === 'production' ? 'Produção' : 'Desenvolvimento'}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-[var(--muted)] rounded-xl p-4 border border-gray-200 dark:border-[var(--border)]">
              <h5 className="font-semibold text-gray-800 dark:text-[var(--fg)] mb-2">Ações Rápidas</h5>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={carregarSessoes}
                  className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                >
                  Atualizar Sessões
                </button>
                <button
                  onClick={() => setAbaAtiva('manutencao')}
                  className="px-3 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
                >
                  Gerenciar Manutenção
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalBase>
  );
}
