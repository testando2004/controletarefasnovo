'use client';

import React, { useState } from 'react';
import { Bell, Download, TrendingUp, Plus, FileText, Users, User, X, Upload, Shield, Building2 } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import { temPermissao as verificarPermissao, isGhostUsuario } from '@/app/utils/permissions';
import NotificacoesPanel from './NotificacoesPanel';

interface HeaderProps {
  onNovaEmpresa: () => void;
  onAtividade: () => void;
  onGerenciarUsuarios: () => void;
  onAnalytics: () => void;
  onSelecionarTemplate: () => void;
  onLogout: () => void;
  onLogs?: () => void;
  onImportarPlanilha?: () => void;
}

export default function Header({
  onNovaEmpresa,
  onAtividade,
  onGerenciarUsuarios,
  onAnalytics,
  onSelecionarTemplate,
  onLogout,
  onLogs,
  onImportarPlanilha,
}: HeaderProps) {
  const { notificacoes, usuarioLogado, realtimeInfo, setProcessos, setTags, setDepartamentos, setEmpresas, adicionarNotificacao, setGlobalLoading, setShowPainelControle, modoManutencao } = useSistema();
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Garantir que notificacoes seja sempre um array
  const notificacoesArray = Array.isArray(notificacoes) ? notificacoes : [];
  const notificacoesNaoLidas = notificacoesArray.filter((n) => !n.lida);

  const temPermissao = (permissao: string, contexto: any = {}) => {
    return verificarPermissao(usuarioLogado, permissao, contexto);
  };

  const realtimeStatus = (() => {
    if (!usuarioLogado) return null;
    if (!realtimeInfo) return { label: 'Realtime: desconhecido', dotClassName: 'bg-gray-400' };

    const statuses = [realtimeInfo.processos, realtimeInfo.core, realtimeInfo.notificacoes];
    if (statuses.some(s => s === 'connecting')) {
      return { label: 'Realtime: reconectando', dotClassName: 'bg-blue-500' };
    }
    if (statuses.some(s => s === 'fallback')) {
      return { label: 'Realtime: fallback', dotClassName: 'bg-yellow-500' };
    }
    if (statuses.every(s => s === 'connected')) {
      return { label: 'Realtime: conectado', dotClassName: 'bg-green-500' };
    }
    return { label: 'Realtime: desligado', dotClassName: 'bg-gray-400' };
  })();

  return (
    <div className="bg-white shadow-lg border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          {/* Logo e Título */}
          <div className="flex items-center gap-4 min-w-0 shrink-0">
            <div className="min-w-0">
              <h1 className="leading-[1.05] tracking-tight">
                <span className="block text-base md:text-lg font-bold text-gray-700 whitespace-nowrap">
                  Controle de
                </span>
                <span className="block -mt-0.5 text-2xl md:text-3xl font-extrabold text-gray-900 whitespace-nowrap">
                  Tarefas
                </span>
              </h1>
              <p
                className="text-gray-600 text-sm leading-snug whitespace-nowrap truncate"
                title="Gerenciamento de Processos"
              >
                Gerenciamento de Processos
              </p>
            </div>
          </div>

          {/* Ações e Botões */}
          <div className="flex w-full xl:w-auto items-center justify-start xl:justify-end gap-2 sm:gap-3 flex-wrap">
            {/* Notificações */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-3 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors relative"
              >
                <Bell size={20} className="text-gray-600" />
                {notificacoesNaoLidas.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notificacoesNaoLidas.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <NotificacoesPanel onClose={() => setShowNotifications(false)} />
              )}
            </div>

            {/* Botão Voltar para Controle de Empresas */}
            {usuarioLogado && (
              <a
                href={process.env.NEXT_PUBLIC_EMPRESAS_URL || 'https://controle-empresas.vercel.app/dashboard'}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-4 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap shrink-0"
                title="Voltar para o Controle de Empresas"
                aria-label="Voltar para o Controle de Empresas"
              >
                <Building2 size={20} />
                <span className="hidden sm:inline">Controle Empresas</span>
              </a>
            )}

            {/* Botão Análises - todos podem ver */}
            {temPermissao('ver_analises') && (
              <button
                onClick={onAnalytics}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap"
              >
                <TrendingUp size={20} />
                <span className="hidden sm:inline">Análises</span>
              </button>
            )}

            {/* Botões de Criação */}
            {temPermissao('criar_processo') && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onSelecionarTemplate}
                  className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap"
                  title="Nova Solicitação usando Templates (Ctrl+N)"
                >
                  <FileText size={20} />
                  <span className="hidden sm:inline">Nova Solicitação</span>
                </button>

                {/* Apenas admin e gerente podem criar atividades */}
                {temPermissao('criar_processo_personalizado') && (
                  <button
                    onClick={onAtividade}
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-4 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap"
                    title="Criar Atividade (Ctrl+N)"
                  >
                    <Plus size={20} />
                    <span className="hidden sm:inline">Atividade</span>
                  </button>
                )}
              </div>
            )}

            {/* Botão Usuários - apenas admin */}
            {temPermissao('gerenciar_usuarios') && (
              <button
                onClick={onGerenciarUsuarios}
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-4 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap"
              >
                <Users size={20} />
                <span className="hidden sm:inline">Usuários</span>
              </button>
            )}

            {/* Botão Importar Planilha - apenas admin */}
            {temPermissao('gerenciar_usuarios') && onImportarPlanilha && (
              <button
                onClick={onImportarPlanilha}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-4 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap"
                title="Importar empresas via planilha CSV"
              >
                <Upload size={20} />
                <span className="hidden sm:inline">Importar</span>
              </button>
            )}

            {/* Botão Painel de Controle - apenas ghost user */}
            {isGhostUsuario(usuarioLogado) && (
              <button
                onClick={() => setShowPainelControle(true)}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap relative"
                title="Painel de Controle (Ghost)"
              >
                <Shield size={20} />
                <span className="hidden sm:inline">Controle</span>
                {modoManutencao && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                )}
              </button>
            )}



            {/* Info Usuário */}
            {usuarioLogado && (
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 rounded-xl max-w-full">
                <User size={16} className="text-gray-600" />
                <span className="text-sm font-medium text-gray-700 max-w-[140px] sm:max-w-[220px] truncate">{usuarioLogado.nome}</span>
                <span
                  className={`hidden sm:inline-flex px-2 py-1 rounded-full text-xs ${
                    usuarioLogado.role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : usuarioLogado.role === 'admin_departamento'
                      ? 'bg-orange-100 text-orange-700'
                      : usuarioLogado.role === 'gerente'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {usuarioLogado.role === 'admin' ? 'Admin' : usuarioLogado.role === 'admin_departamento' ? 'Admin Dept' : usuarioLogado.role === 'gerente' ? 'Gerente' : 'Usuário'}
                </span>
                <button
                  onClick={onLogout}
                  className="ml-2 text-red-600 hover:text-red-700"
                  title="Sair"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
