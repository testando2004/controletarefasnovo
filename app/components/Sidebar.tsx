'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Briefcase,
  FolderOpen,
  Calendar,
  BarChart3,
  Layers,
  ScrollText,
  HardDrive,
  Building2,
  Bell,
  Plus,
  FileText,
  TrendingUp,
  Users,
  Upload,
  Shield,
  User,
  X,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import { temPermissao as verificarPermissao, isGhostUsuario } from '@/app/utils/permissions';
import { GHOST_USER_EMAIL, MASTER_USER_EMAIL } from '@/app/utils/constants';
import NotificacoesPanel from './NotificacoesPanel';

export type AbaSidebar =
  | 'dashboard'
  | 'meus-processos'
  | 'projetos'
  | 'calendario'
  | 'graficos'
  | 'departamentos'
  | 'logs'
  | 'backup';

interface SidebarProps {
  abaAtiva: AbaSidebar;
  setAbaAtiva: (aba: AbaSidebar) => void;
  onNovaEmpresa: () => void;
  onAtividade: () => void;
  onGerenciarUsuarios: () => void;
  onAnalytics: () => void;
  onSelecionarTemplate: () => void;
  onLogout: () => void;
  onImportarPlanilha?: () => void;
}

export default function Sidebar({
  abaAtiva,
  setAbaAtiva,
  onNovaEmpresa,
  onAtividade,
  onGerenciarUsuarios,
  onAnalytics,
  onSelecionarTemplate,
  onLogout,
  onImportarPlanilha,
}: SidebarProps) {
  const { notificacoes, usuarioLogado, setShowPainelControle, modoManutencao } = useSistema();
  const [showNotifs, setShowNotifs] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const notifBellMobileRef = useRef<HTMLButtonElement>(null);
  const notifBellDesktopRef = useRef<HTMLButtonElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showNotifs) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        notifPanelRef.current?.contains(target) ||
        notifBellMobileRef.current?.contains(target) ||
        notifBellDesktopRef.current?.contains(target)
      ) {
        return;
      }
      setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showNotifs]);

  const notificacoesArray = Array.isArray(notificacoes) ? notificacoes : [];
  const notifsNaoLidas = notificacoesArray.filter((n) => !n.lida).length;

  const isSuperUser = useMemo(() => {
    if (!usuarioLogado) return false;
    return (
      (usuarioLogado as any).isGhost === true ||
      usuarioLogado.email === GHOST_USER_EMAIL ||
      usuarioLogado.email === MASTER_USER_EMAIL
    );
  }, [usuarioLogado]);

  const isAdminLike = useMemo(() => {
    const role = String(usuarioLogado?.role || '').toLowerCase();
    return role === 'admin' || role === 'admin_departamento';
  }, [usuarioLogado?.role]);

  const temPermissao = (permissao: string, contexto: any = {}) =>
    verificarPermissao(usuarioLogado, permissao, contexto);

  // Persistir estado da sidebar
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('tarefas-sidebar-open') : null;
    if (stored !== null) setSidebarOpen(stored === 'true');
  }, []);

  // Avisar a pagina principal sobre mudancas (para ajustar padding do conteudo)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('tarefas-sidebar-changed', { detail: sidebarOpen }));
  }, [sidebarOpen]);

  const toggleSidebar = () => {
    setSidebarOpen((v) => {
      try {
        localStorage.setItem('tarefas-sidebar-open', String(!v));
      } catch {}
      return !v;
    });
  };

  // Itens de navegação (tabs)
  type NavItem = {
    id: AbaSidebar;
    label: string;
    icon: LucideIcon;
    visible: boolean;
  };

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: true },
    { id: 'meus-processos', label: 'Meus Processos', icon: Briefcase, visible: true },
    { id: 'projetos', label: 'Projetos', icon: FolderOpen, visible: true },
    { id: 'calendario', label: 'Calendário', icon: Calendar, visible: true },
    { id: 'graficos', label: 'Gráficos', icon: BarChart3, visible: true },
    { id: 'departamentos', label: 'Departamentos', icon: Layers, visible: true },
    { id: 'logs', label: 'Histórico de Logs', icon: ScrollText, visible: isAdminLike || isSuperUser },
    { id: 'backup', label: 'Backup', icon: HardDrive, visible: isAdminLike },
  ];

  // Botões de ação (modais)
  type ActionItem = {
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    visible: boolean;
    gradient: string;
    title?: string;
  };

  const actionItems: ActionItem[] = [
    {
      label: 'Nova Solicitação',
      icon: FileText,
      onClick: onSelecionarTemplate,
      visible: temPermissao('criar_processo'),
      gradient: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
      title: 'Nova Solicitação (Ctrl+N)',
    },
    {
      label: 'Atividade',
      icon: Plus,
      onClick: onAtividade,
      visible: temPermissao('criar_processo_personalizado'),
      gradient: 'from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700',
      title: 'Criar Atividade (Ctrl+N)',
    },
    {
      label: 'Análises',
      icon: TrendingUp,
      onClick: onAnalytics,
      visible: temPermissao('ver_analises'),
      gradient: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
    },
    {
      label: 'Usuários',
      icon: Users,
      onClick: onGerenciarUsuarios,
      visible: temPermissao('gerenciar_usuarios'),
      gradient: 'from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700',
    },
    {
      label: 'Importar',
      icon: Upload,
      onClick: () => onImportarPlanilha?.(),
      visible: temPermissao('gerenciar_usuarios') && !!onImportarPlanilha,
      gradient: 'from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700',
      title: 'Importar empresas via planilha CSV',
    },
  ];

  const empresasUrl = process.env.NEXT_PUBLIC_EMPRESAS_URL || 'https://controle-empresas.vercel.app/dashboard';

  // ==================== RENDERIZADORES ====================

  const renderLogo = (collapsed: boolean) => (
    <div className={`flex items-center border-b border-gray-100 dark:border-gray-700 ${collapsed ? 'justify-center px-0 py-4' : 'gap-3 px-4 py-4'}`}>
      {!collapsed && (
        <div className="leading-tight min-w-0 overflow-hidden">
          <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 tracking-widest uppercase whitespace-nowrap">Controle de</span>
          <span className="block text-xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none whitespace-nowrap">Tarefas</span>
        </div>
      )}
    </div>
  );

  const renderBotaoEmpresas = (collapsed: boolean, onClickExtra?: () => void) => (
    <div className={collapsed ? 'px-1.5 pt-2 pb-1' : 'px-2 pt-2 pb-1'}>
      <a
        href={empresasUrl}
        onClick={onClickExtra}
        title="Voltar para o Controle de Empresas"
        className={`flex items-center rounded-lg text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all
          ${collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2.5 text-sm font-bold'}`}
      >
        <Building2 size={18} className="shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1">Controle de Empresas</span>
          </>
        )}
      </a>
    </div>
  );

  const renderNavItems = (collapsed: boolean, onNavClick?: () => void) => (
    <>
      {!collapsed && (
        <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase">
          Navegação
        </div>
      )}
      <nav className="px-1.5 space-y-0.5">
        {navItems.filter((i) => i.visible).map((i) => {
          const Icon = i.icon;
          const active = abaAtiva === i.id;
          return (
            <button
              key={i.id}
              onClick={() => {
                setAbaAtiva(i.id);
                onNavClick?.();
              }}
              title={collapsed ? i.label : undefined}
              className={`w-full flex items-center rounded-lg text-sm font-semibold transition-all
                ${collapsed ? 'justify-center p-2' : 'gap-3 px-2.5 py-2'}
                ${active
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'}
              `}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate flex-1 text-left">{i.label}</span>}
            </button>
          );
        })}
      </nav>
    </>
  );

  const renderActionItems = (collapsed: boolean, onActionClick?: () => void) => {
    const visibleActions = actionItems.filter((a) => a.visible);
    if (visibleActions.length === 0 && !isGhostUsuario(usuarioLogado)) return null;
    return (
      <>
        {!collapsed && (
          <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase">
            Ações
          </div>
        )}
        <div className="px-1.5 space-y-1">
          {visibleActions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={() => {
                  a.onClick();
                  onActionClick?.();
                }}
                title={collapsed ? a.label : a.title}
                className={`w-full flex items-center rounded-lg text-white bg-gradient-to-r ${a.gradient} shadow-sm hover:shadow-md transition-all
                  ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2 text-sm font-semibold'}`}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate flex-1 text-left">{a.label}</span>}
              </button>
            );
          })}
          {isGhostUsuario(usuarioLogado) && (
            <button
              onClick={() => {
                setShowPainelControle(true);
                onActionClick?.();
              }}
              title={collapsed ? 'Painel de Controle (Ghost)' : 'Painel de Controle (Ghost)'}
              className={`w-full flex items-center relative rounded-lg text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-sm hover:shadow-md transition-all
                ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2 text-sm font-semibold'}`}
            >
              <Shield size={18} className="shrink-0" />
              {!collapsed && <span className="truncate flex-1 text-left">Painel de Controle</span>}
              {modoManutencao && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
              )}
            </button>
          )}
        </div>
      </>
    );
  };

  const renderRodape = (collapsed: boolean) => (
    <div className="border-t border-gray-100 dark:border-gray-700 p-1.5 space-y-1 mt-2">
      {usuarioLogado && !collapsed && (
        <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 bg-gray-50 dark:bg-gray-700">
          <User size={13} className="text-gray-400 dark:text-gray-300 shrink-0" />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate flex-1">{usuarioLogado.nome}</span>
          <span
            className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase leading-none shrink-0 ${
              usuarioLogado.role === 'admin'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                : usuarioLogado.role === 'admin_departamento'
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                : usuarioLogado.role === 'gerente'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
            }`}
          >
            {usuarioLogado.role === 'admin' ? 'Admin' : usuarioLogado.role === 'admin_departamento' ? 'Admin Dept' : usuarioLogado.role === 'gerente' ? 'Gerente' : 'Usuário'}
          </span>
        </div>
      )}

      <div className={`flex items-center gap-0.5 ${collapsed ? 'flex-col' : ''}`}>
        {/* Toggle (apenas desktop) */}
        <button
          onClick={toggleSidebar}
          className="hidden md:flex flex-1 items-center justify-center rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition"
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Notificações */}
        <div className="relative">
          <button
            ref={notifBellDesktopRef}
            onClick={() => setShowNotifs((v) => !v)}
            className="flex items-center justify-center rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition relative"
            title="Notificações"
          >
            <Bell size={16} className={notifsNaoLidas > 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-400 dark:text-gray-300'} />
            {notifsNaoLidas > 0 && (
              <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[8px] font-black px-0.5">
                {notifsNaoLidas > 9 ? '9+' : notifsNaoLidas}
              </span>
            )}
          </button>

        </div>

        {/* Logout */}
        {usuarioLogado && (
          <button
            onClick={onLogout}
            className="flex items-center justify-center rounded-lg p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition"
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </div>
  );

  // ==================== RENDER ====================

  return (
    <>
      {/* ── Mobile Top Bar ── */}
      <div className="fixed top-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Controle de Tarefas</span>
          </div>
          <button
            ref={notifBellMobileRef}
            onClick={() => setShowNotifs((v) => !v)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 relative"
          >
            <Bell size={20} className={notifsNaoLidas > 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-400 dark:text-gray-300'} />
            {notifsNaoLidas > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center px-0.5">
                {notifsNaoLidas > 9 ? '9+' : notifsNaoLidas}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile Drawer Overlay ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      {/* ── Mobile Sidebar Drawer ── */}
      <aside
        className={`fixed top-0 left-0 h-full z-[70] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg flex flex-col transition-transform duration-300 ease-in-out w-72 md:hidden overflow-y-auto ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="leading-tight">
              <span className="block text-[10px] font-bold text-gray-400 tracking-widest uppercase">Controle de</span>
              <span className="block text-base font-extrabold text-gray-900 dark:text-white leading-none">Tarefas</span>
            </div>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {renderBotaoEmpresas(false, () => setMobileMenuOpen(false))}
        {renderNavItems(false, () => setMobileMenuOpen(false))}
        {renderActionItems(false, () => setMobileMenuOpen(false))}
        {renderRodape(false)}
      </aside>

      {/* ── Desktop Sidebar ── */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-md flex-col transition-all duration-200 ease-in-out hidden md:flex overflow-y-auto ${
          sidebarOpen ? 'w-64' : 'w-[72px]'
        }`}
      >
        {renderLogo(!sidebarOpen)}
        {renderBotaoEmpresas(!sidebarOpen)}
        {renderNavItems(!sidebarOpen)}
        {renderActionItems(!sidebarOpen)}
        {renderRodape(!sidebarOpen)}
      </aside>


      {/* ── Painel de Notificacoes (Portal para escapar do overflow da sidebar) ── */}
      {showNotifs && mounted && createPortal(
        <NotificacoesPortal
          sidebarOpen={sidebarOpen}
          onClose={() => setShowNotifs(false)}
          panelRef={notifPanelRef}
        />,
        document.body
      )}
    </>
  );
}

// ==================== PORTAL DE NOTIFICACOES ====================
// Componente isolado que calcula posicao do painel via JS (evita problemas
// com classes Tailwind dinamicas que poderiam nao ser geradas no build).
function NotificacoesPortal({
  sidebarOpen,
  onClose,
  panelRef,
}: {
  sidebarOpen: boolean;
  onClose: () => void;
  panelRef: React.RefObject<HTMLDivElement>;
}) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const desktopStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '1rem',
    left: sidebarOpen ? '17rem' : '5.5rem',
    zIndex: 90,
  };

  const mobileStyle: React.CSSProperties = {
    position: 'fixed',
    top: '3.5rem',
    right: '0.5rem',
    zIndex: 90,
  };

  return (
    <div ref={panelRef} style={isDesktop ? desktopStyle : mobileStyle}>
      <NotificacoesPanel onClose={onClose} />
    </div>
  );
}
