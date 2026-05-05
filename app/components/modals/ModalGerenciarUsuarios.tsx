'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, UserPlus, Edit, Check, User, Play, Pause, Shield, ShieldCheck, Crown, Users } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import { api } from '@/app/utils/api';
import ModalBase from './ModalBase';
import { SENHA_MIN_LENGTH, MASTER_USER_EMAIL, GHOST_USER_EMAIL } from '@/app/utils/constants';
import { isSuperUsuario, isGhostUsuario, podeEditarUsuario, podeAlterarSenha } from '@/app/utils/permissions';

interface ModalGerenciarUsuariosProps {
  onClose: () => void;
}

const ROLE_ORDER: Record<string, number> = {
  admin: 0,
  admin_departamento: 1,
  gerente: 2,
  usuario: 3,
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  admin_departamento: 'Admin c/ Departamento',
  gerente: 'Gerente',
  usuario: 'Usuário',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'from-red-500 to-red-600',
  admin_departamento: 'from-orange-500 to-red-500',
  gerente: 'from-blue-500 to-blue-600',
  usuario: 'from-gray-500 to-gray-600',
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  admin_departamento: 'bg-orange-100 text-orange-700',
  gerente: 'bg-blue-100 text-blue-700',
  usuario: 'bg-gray-100 text-gray-700',
};

export default function ModalGerenciarUsuarios({ onClose }: ModalGerenciarUsuariosProps) {
  const { departamentos, usuarios, setUsuarios, mostrarAlerta, mostrarConfirmacao, adicionarNotificacao, usuarioLogado } = useSistema();

  const [novoUsuario, setNovoUsuario] = useState({
    nome: '',
    email: '',
    senha: '',
    role: 'usuario' as 'admin' | 'admin_departamento' | 'gerente' | 'usuario',
    departamentoId: undefined as number | undefined,
    departamentosExtras: [] as number[],
    permissoes: [] as string[],
    require2FA: true,
  });

  const [editandoUsuario, setEditandoUsuario] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const ehSuperUsuario = useMemo(() => isSuperUsuario(usuarioLogado), [usuarioLogado]);
  const ehGhost = useMemo(() => isGhostUsuario(usuarioLogado), [usuarioLogado]);

  // Carregar usuários ao abrir o modal
  useEffect(() => {
    async function carregarUsuarios() {
      try {
        const usuariosData = await api.getUsuarios();
        const usuariosConvertidos = (usuariosData || []).map((u: any) => ({
          ...u,
          role: typeof u.role === 'string' ? u.role.toLowerCase() : u.role
        }));
        setUsuarios(usuariosConvertidos || []);
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      }
    }
    carregarUsuarios();
  }, [setUsuarios]);

  // Ordenar usuários por cargo e depois por nome
  const usuariosOrdenados = useMemo(() => {
    return [...usuarios]
      // Esconder ghost user de não-super users
      .filter(u => {
        if ((u as any).isGhost || u.email === GHOST_USER_EMAIL) {
          return ehSuperUsuario;
        }
        return true;
      })
      .sort((a, b) => {
        const roleA = ROLE_ORDER[a.role] ?? 99;
        const roleB = ROLE_ORDER[b.role] ?? 99;
        if (roleA !== roleB) return roleA - roleB;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });
  }, [usuarios, ehSuperUsuario]);

  // Agrupar por cargo
  const grupos = useMemo(() => {
    const map = new Map<string, typeof usuariosOrdenados>();
    for (const u of usuariosOrdenados) {
      const role = u.role || 'usuario';
      if (!map.has(role)) map.set(role, []);
      map.get(role)!.push(u);
    }
    return map;
  }, [usuariosOrdenados]);

  const permissoesDisponiveis = [
    { id: "criar_processo", label: "Criar Processos" },
    { id: "editar_processo", label: "Editar Processos" },
    { id: "excluir_processo", label: "Excluir Processos" },
    { id: "criar_tag", label: "Criar Tags" },
    { id: "editar_tag", label: "Editar Tags" },
    { id: "excluir_tag", label: "Excluir Tags" },
    { id: "criar_departamento", label: "Criar Departamentos" },
    { id: "editar_departamento", label: "Editar Departamentos" },
    { id: "excluir_departamento", label: "Excluir Departamentos" },
    { id: "gerenciar_usuarios", label: "Gerenciar Usuários" }
  ];

  const handleCriarUsuario = async () => {
    if (!String(novoUsuario.nome || '').trim() || !String(novoUsuario.email || '').trim() || !String(novoUsuario.senha || '').trim()) {
      await mostrarAlerta('Atenção', 'Preencha nome, email e senha.', 'aviso');
      return;
    }

    if (novoUsuario.senha.length < SENHA_MIN_LENGTH) {
      await mostrarAlerta('Atenção', `A senha deve ter no mínimo ${SENHA_MIN_LENGTH} caracteres.`, 'aviso');
      return;
    }

    // Validar que gerente/usuário/admin_departamento precisam ter departamento
    if (['gerente', 'usuario', 'admin_departamento'].includes(novoUsuario.role) && !novoUsuario.departamentoId) {
      await mostrarAlerta('Atenção', 'Este tipo de usuário deve ter um departamento associado.', 'aviso');
      return;
    }

    try {
      setLoading(true);
      const usuario = await api.salvarUsuario({
        nome: novoUsuario.nome,
        email: novoUsuario.email,
        senha: novoUsuario.senha,
        role: novoUsuario.role.toUpperCase() as 'ADMIN' | 'ADMIN_DEPARTAMENTO' | 'GERENTE' | 'USUARIO',
        departamentoId: novoUsuario.departamentoId,
        departamentosExtras: novoUsuario.departamentosExtras || [],
        permissoes: novoUsuario.permissoes,
        require2FA: novoUsuario.require2FA,
      } as any);

      const usuariosData = await api.getUsuarios();
      const usuariosConvertidos = (usuariosData || []).map((u: any) => ({
        ...u,
        role: typeof u.role === 'string' ? u.role.toLowerCase() : u.role,
        departamento_id: u.departamento?.id || u.departamentoId
      }));
      setUsuarios(usuariosConvertidos || []);

      adicionarNotificacao(usuario?.reativado ? 'Usuário reativado com sucesso' : 'Usuário criado com sucesso', 'sucesso');
      api.registrarLog?.({
        acao: 'CRIAR', entidade: 'USUARIO', entidadeId: usuario?.id,
        entidadeNome: novoUsuario.nome,
        detalhes: `Usuário ${usuario?.reativado ? 'reativado' : 'criado'}: "${novoUsuario.nome}" (${novoUsuario.email}) - Role: ${novoUsuario.role.toUpperCase()}`,
      });
      setNovoUsuario({ nome: '', email: '', senha: '', role: 'usuario', departamentoId: undefined, departamentosExtras: [], permissoes: [], require2FA: true });
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao criar usuário';
      adicionarNotificacao(errorMessage, 'erro');
      await mostrarAlerta('Erro', errorMessage, 'erro');
    } finally {
      setLoading(false);
    }
  };

  const handleEditarUsuario = async () => {
    if (!String(editandoUsuario?.nome || '').trim() || !String(editandoUsuario?.email || '').trim()) {
      await mostrarAlerta('Atenção', 'Preencha nome e email do usuário.', 'aviso');
      return;
    }

    // Validar senha mínima se estiver alterando
    if (editandoUsuario.senha && editandoUsuario.senha.length < SENHA_MIN_LENGTH) {
      await mostrarAlerta('Atenção', `A senha deve ter no mínimo ${SENHA_MIN_LENGTH} caracteres.`, 'aviso');
      return;
    }

    // Verificar permissão para alterar senha de admin
    if (editandoUsuario.senha) {
      const alvoUsuario = usuarios.find(u => u.id === editandoUsuario.id);
      if (alvoUsuario && !podeAlterarSenha(usuarioLogado, alvoUsuario)) {
        await mostrarAlerta('Atenção', 'Você não tem permissão para alterar a senha deste administrador.', 'aviso');
        return;
      }
    }

    try {
      setLoading(true);
      await api.atualizarUsuario(editandoUsuario.id, {
        nome: editandoUsuario.nome,
        email: editandoUsuario.email,
        role: (typeof editandoUsuario.role === 'string' ? editandoUsuario.role.toUpperCase() : editandoUsuario.role) as 'ADMIN' | 'ADMIN_DEPARTAMENTO' | 'GERENTE' | 'USUARIO',
        departamentoId: editandoUsuario.departamentoId,
        departamentosExtras: Array.isArray(editandoUsuario.departamentosExtras) ? editandoUsuario.departamentosExtras : [],
        permissoes: editandoUsuario.permissoes || [],
        ativo: editandoUsuario.ativo,
        ...(editandoUsuario.senha && { senha: editandoUsuario.senha }),
        ...(ehGhost && editandoUsuario.require2FA !== undefined && { require2FA: editandoUsuario.require2FA }),
      } as any);

      const usuariosData = await api.getUsuarios();
      const usuariosConvertidos = (usuariosData || []).map((u: any) => ({
        ...u,
        role: typeof u.role === 'string' ? u.role.toLowerCase() : u.role
      }));
      setUsuarios(usuariosConvertidos || []);

      adicionarNotificacao('Usuário atualizado com sucesso', 'sucesso');
      api.registrarLog?.({
        acao: 'EDITAR', entidade: 'USUARIO', entidadeId: editandoUsuario.id,
        entidadeNome: editandoUsuario.nome,
        detalhes: `Usuário editado: "${editandoUsuario.nome}" (${editandoUsuario.email})`,
      });
      setEditandoUsuario(null);
    } catch (error: any) {
      adicionarNotificacao(error.message || 'Erro ao editar usuário', 'erro');
      await mostrarAlerta('Erro', error.message || 'Erro ao editar usuário', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirUsuario = async (id: number) => {
    if (usuarioLogado?.id && id === usuarioLogado.id) {
      await mostrarAlerta('Atenção', 'Você não pode excluir seu próprio usuário.', 'aviso');
      return;
    }

    const alvo = usuarios.find(u => u.id === id);

    // Verificar se pode excluir admin
    if (alvo && (alvo.role === 'admin' || alvo.role === 'admin_departamento') && !ehSuperUsuario) {
      await mostrarAlerta('Atenção', 'Apenas usuários com permissões especiais podem excluir administradores.', 'aviso');
      return;
    }

    const ok = await mostrarConfirmacao({
      titulo: 'Excluir Usuário',
      mensagem: `Tem certeza que deseja excluir o usuário "${alvo?.nome || ''}"?\n\nEsta ação não poderá ser desfeita.`,
      tipo: 'perigo',
      textoConfirmar: 'Sim, Excluir',
      textoCancelar: 'Cancelar',
    });

    if (ok) {
      try {
        setLoading(true);
        await api.excluirUsuario(id, { permanente: true });
        const usuariosData = await api.getUsuarios();
        const usuariosConvertidos = (usuariosData || []).map((u: any) => ({
          ...u,
          role: typeof u.role === 'string' ? u.role.toLowerCase() : u.role
        }));
        setUsuarios(usuariosConvertidos || []);
        adicionarNotificacao('Usuário excluído com sucesso', 'sucesso');
        api.registrarLog?.({
          acao: 'EXCLUIR', entidade: 'USUARIO', entidadeId: id,
          entidadeNome: alvo?.nome,
          detalhes: `Usuário excluído: "${alvo?.nome || ''}" (${alvo?.email || ''})`,
        });
      } catch (error: any) {
        adicionarNotificacao(error.message || 'Erro ao excluir usuário', 'erro');
        await mostrarAlerta('Erro', error.message || 'Erro ao excluir usuário', 'erro');
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleStatusUsuario = async (usuario: any) => {
    if (usuarioLogado?.id && usuario?.id === usuarioLogado.id) {
      await mostrarAlerta('Atenção', 'Você não pode desativar seu próprio usuário.', 'aviso');
      return;
    }

    try {
      setLoading(true);
      await api.atualizarUsuario(usuario.id, {
        ativo: !usuario.ativo,
      });

      const usuariosData = await api.getUsuarios();
      const usuariosConvertidos = (usuariosData || []).map((u: any) => ({
        ...u,
        role: typeof u.role === 'string' ? u.role.toLowerCase() : u.role
      }));
      setUsuarios(usuariosConvertidos || []);

      adicionarNotificacao(`Usuário ${!usuario.ativo ? 'ativado' : 'desativado'} com sucesso`, 'sucesso');
      api.registrarLog?.({
        acao: 'EDITAR', entidade: 'USUARIO', entidadeId: usuario.id,
        entidadeNome: usuario.nome,
        campo: 'ativo',
        valorAnterior: String(usuario.ativo),
        valorNovo: String(!usuario.ativo),
        detalhes: `Usuário ${!usuario.ativo ? 'ativado' : 'desativado'}: "${usuario.nome}"`,
      });
    } catch (error: any) {
      adicionarNotificacao(error.message || 'Erro ao alterar status', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const podeMostrarBotoesEditar = (user: any) => {
    if (ehSuperUsuario) return true;
    // Admins podem editar a si mesmos
    if (usuarioLogado?.id && user.id === usuarioLogado.id) return true;
    // Admins normais não podem editar OUTROS admins
    if (user.role === 'admin' || user.role === 'admin_departamento') {
      return false;
    }
    return true;
  };

  const roleNeedsDept = (role: string) => ['gerente', 'usuario', 'admin_departamento'].includes(role);

  const currentRole = editandoUsuario
    ? (typeof editandoUsuario.role === 'string' ? editandoUsuario.role.toLowerCase() : editandoUsuario.role)
    : novoUsuario.role;

  return (
    <>
      <ModalBase
        isOpen
        onClose={onClose}
        labelledBy="gerenciar-usuarios-title"
        dialogClassName="w-full max-w-6xl bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none max-h-[90vh] overflow-y-auto"
        zIndex={1080}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-t-2xl sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Users size={22} className="text-white" />
              <h3 id="gerenciar-usuarios-title" className="text-xl font-bold text-white">Gerenciar Usuários</h3>
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                {usuariosOrdenados.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
            {/* Formulário Criar/Editar */}
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
              <h4 className="font-semibold text-gray-800 dark:text-[var(--fg)] mb-4">
                {editandoUsuario ? `Editando: ${editandoUsuario.nome}` : 'Criar Novo Usuário'}
              </h4>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nome do usuário *
                    </label>
                    <input
                      type="text"
                      name="nome_usuario"
                      autoComplete="off"
                      placeholder="Nome do usuário"
                      value={editandoUsuario ? editandoUsuario.nome : novoUsuario.nome}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 60);
                        editandoUsuario
                          ? setEditandoUsuario((prev: any) => ({ ...prev, nome: val }))
                          : setNovoUsuario(prev => ({ ...prev, nome: val }));
                      }}
                      maxLength={60}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {editandoUsuario ? 'Nova Senha (opcional)' : 'Senha *'}{' '}
                      <span className="text-xs text-gray-400">(mín. {SENHA_MIN_LENGTH} caracteres)</span>
                    </label>
                    {/* Verificar se pode alterar senha */}
                    {editandoUsuario && !podeAlterarSenha(usuarioLogado, editandoUsuario) ? (
                      <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500 text-sm">
                        Sem permissão para alterar senha deste admin
                      </div>
                    ) : (
                      <>
                        <input
                          type="password"
                          name={editandoUsuario ? 'nova_senha_usuario' : 'senha_novo_usuario'}
                          autoComplete="new-password"
                          placeholder={editandoUsuario ? "Nova senha (opcional)" : `Senha (mín. ${SENHA_MIN_LENGTH})`}
                          value={editandoUsuario ? (editandoUsuario.senha || '') : novoUsuario.senha}
                          onChange={(e) => {
                            const val = e.target.value.slice(0, 32);
                            editandoUsuario
                              ? setEditandoUsuario((prev: any) => ({ ...prev, senha: val }))
                              : setNovoUsuario(prev => ({ ...prev, senha: val }));
                          }}
                          maxLength={32}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)] ${
                            (editandoUsuario ? (editandoUsuario.senha || '') : novoUsuario.senha).length > 0 &&
                            (editandoUsuario ? (editandoUsuario.senha || '') : novoUsuario.senha).length < SENHA_MIN_LENGTH
                              ? 'border-red-400 dark:border-red-500'
                              : 'border-gray-300 dark:border-[var(--border)]'
                          }`}
                        />
                        {(() => {
                          const senhaAtual = editandoUsuario ? (editandoUsuario.senha || '') : novoUsuario.senha;
                          if (senhaAtual.length > 0 && senhaAtual.length < SENHA_MIN_LENGTH) {
                            return (
                              <p className="text-xs text-red-500 mt-1">
                                A senha deve ter no minimo {SENHA_MIN_LENGTH} caracteres ({SENHA_MIN_LENGTH - senhaAtual.length} restantes)
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email (login) *
                  </label>
                  <input
                    type="email"
                    name={editandoUsuario ? 'email_usuario_edicao' : 'email_usuario_criacao'}
                    autoComplete="off"
                    placeholder="email@empresa.com"
                    value={editandoUsuario ? editandoUsuario.email : novoUsuario.email}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 80);
                      editandoUsuario
                        ? setEditandoUsuario((prev: any) => ({ ...prev, email: val }))
                        : setNovoUsuario(prev => ({ ...prev, email: val }));
                    }}
                    maxLength={80}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tipo de Usuário
                    </label>
                    <select
                      value={currentRole}
                      onChange={(e) => {
                        const newRole = e.target.value as 'admin' | 'admin_departamento' | 'gerente' | 'usuario';
                        if (editandoUsuario) {
                          setEditandoUsuario((prev: any) => ({ ...prev, role: newRole }));
                        } else {
                          setNovoUsuario(prev => ({ ...prev, role: newRole }));
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                    >
                      <option value="usuario">Usuário</option>
                      <option value="gerente">Gerente</option>
                      <option value="admin_departamento">Admin c/ Departamento</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  {roleNeedsDept(currentRole) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Departamento principal *
                      </label>
                      <select
                        value={editandoUsuario ? (editandoUsuario.departamentoId ?? '') : (novoUsuario.departamentoId ?? '')}
                        onChange={(e) => {
                          const deptId = e.target.value ? parseInt(e.target.value) : undefined;
                          if (editandoUsuario) {
                            setEditandoUsuario((prev: any) => ({
                              ...prev,
                              departamentoId: deptId,
                              // Remove o dept principal da lista de extras (se houver)
                              departamentosExtras: (prev.departamentosExtras || []).filter((id: number) => id !== deptId),
                            }));
                          } else {
                            setNovoUsuario(prev => ({
                              ...prev,
                              departamentoId: deptId,
                              departamentosExtras: (prev.departamentosExtras || []).filter((id: number) => id !== deptId),
                            }));
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-[var(--border)] rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                      >
                        <option value="">Selecione...</option>
                        {departamentos.map(d => (
                          <option key={d.id} value={d.id}>{d.nome}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                        Este é o principal. É o default ao criar solicitação.
                      </p>
                    </div>
                  )}

                  {/* Departamentos adicionais — permite que usuário/gerente atue em mais de um dept */}
                  {roleNeedsDept(currentRole) && (() => {
                    const deptPrincipal = editandoUsuario
                      ? editandoUsuario.departamentoId
                      : novoUsuario.departamentoId;
                    const extras: number[] = editandoUsuario
                      ? (editandoUsuario.departamentosExtras || [])
                      : (novoUsuario.departamentosExtras || []);
                    const deptOpcoes = departamentos.filter((d: any) => d.id !== deptPrincipal);
                    return (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Departamentos adicionais
                          <span className="text-xs text-gray-400 ml-2">(opcional — mesmas permissões nesses deptos)</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {deptOpcoes.length === 0 ? (
                            <span className="text-xs text-gray-500 italic">Selecione o principal primeiro.</span>
                          ) : (
                            deptOpcoes.map((d: any) => {
                              const marcado = extras.includes(d.id);
                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => {
                                    const novos = marcado
                                      ? extras.filter((id) => id !== d.id)
                                      : [...extras, d.id];
                                    if (editandoUsuario) {
                                      setEditandoUsuario((prev: any) => ({ ...prev, departamentosExtras: novos }));
                                    } else {
                                      setNovoUsuario(prev => ({ ...prev, departamentosExtras: novos }));
                                    }
                                  }}
                                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                                    marcado
                                      ? 'bg-purple-500 text-white border-purple-500'
                                      : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-700 hover:border-purple-400'
                                  }`}
                                >
                                  {marcado ? '✓ ' : '+ '}{d.nome}
                                </button>
                              );
                            })
                          )}
                        </div>
                        {extras.length > 0 && (
                          <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1.5">
                            {extras.length} departamento{extras.length === 1 ? '' : 's'} adicional{extras.length === 1 ? '' : 'is'} selecionado{extras.length === 1 ? '' : 's'}.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {editandoUsuario && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Status
                      </label>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="checkbox"
                          checked={editandoUsuario.ativo}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setEditandoUsuario((prev: any) => ({ ...prev, ativo: checked }));
                          }}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Usuário ativo
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Toggle 2FA - somente ghost pode ver/alterar */}
                  {ehGhost && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Verificação em Dois Fatores
                      </label>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="checkbox"
                          checked={editandoUsuario ? (editandoUsuario.require2FA !== false) : novoUsuario.require2FA}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (editandoUsuario) {
                              setEditandoUsuario((prev: any) => ({ ...prev, require2FA: checked }));
                            } else {
                              setNovoUsuario(prev => ({ ...prev, require2FA: checked }));
                            }
                          }}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Exigir código por email no login
                        </label>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Se desmarcado, o usuário fará login apenas com email e senha (sem código de verificação).
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  {editandoUsuario ? (
                    <>
                      <button
                        onClick={() => setEditandoUsuario(null)}
                        className="flex-1 px-6 py-2 border border-gray-300 dark:border-[var(--border)] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleEditarUsuario}
                        disabled={loading}
                        className="flex-1 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleCriarUsuario}
                      disabled={loading}
                      className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <UserPlus size={18} />
                      {loading ? 'Criando...' : 'Criar Usuário'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Lista de Usuários por Cargo */}
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-[var(--fg)] mb-3">
                Usuários Cadastrados ({usuariosOrdenados.length})
              </h4>

              <div className="space-y-6">
                {Array.from(grupos.entries()).map(([role, users]) => (
                  <div key={role}>
                    {/* Header do grupo */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${ROLE_COLORS[role] || 'from-gray-400 to-gray-500'}`} />
                      <h5 className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        {ROLE_LABELS[role] || role} ({users.length})
                      </h5>
                    </div>

                    <div className="space-y-2">
                      {users.map(user => {
                        const canEdit = podeMostrarBotoesEditar(user);
                        const isGhost = (user as any).isGhost || user.email === GHOST_USER_EMAIL;
                        const isMaster = user.email === MASTER_USER_EMAIL;

                        return (
                          <div key={user.id} className={`bg-gray-50 dark:bg-[var(--muted)] rounded-lg p-4 border ${
                            isGhost ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10' :
                            isMaster ? 'border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-900/10' :
                            'border-gray-200 dark:border-[var(--border)]'
                          }`}>
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 bg-gradient-to-br ${ROLE_COLORS[user.role] || 'from-gray-500 to-gray-600'} rounded-full flex items-center justify-center text-white font-bold`}>
                                  {isGhost ? (
                                    <Shield size={18} />
                                  ) : (
                                    user.nome.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium dark:text-[var(--fg)] flex items-center gap-2">
                                    <span title={user.nome}>
                                      {user.nome.length > 40 ? user.nome.slice(0, 40) + '...' : user.nome}
                                    </span>
                                    {isGhost && (
                                      <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">GHOST</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                                  <div className="text-sm text-gray-600 dark:text-gray-300">
                                    {ROLE_LABELS[user.role] || 'Usuário'}
                                    {(user as any).departamento?.nome && ` - ${(user as any).departamento.nome}`}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE_COLORS[user.role] || 'bg-gray-100 text-gray-700'}`}>
                                  {ROLE_LABELS[user.role]}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  user.ativo
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {user.ativo ? 'Ativo' : 'Inativo'}
                                </span>

                                {canEdit && (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => toggleStatusUsuario(user)}
                                      className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
                                      title={user.ativo ? "Desativar" : "Ativar"}
                                    >
                                      {user.ativo ? <Pause size={16} /> : <Play size={16} />}
                                    </button>

                                    <button
                                      onClick={() => {
                                        setEditandoUsuario({
                                          ...user,
                                          role: typeof user.role === 'string' ? user.role.toLowerCase() : user.role,
                                          departamentoId: (user as any).departamento?.id ?? (user as any).departamentoId ?? undefined,
                                          departamentosExtras: Array.isArray((user as any).departamentosExtras) ? (user as any).departamentosExtras : [],
                                          require2FA: (user as any).require2FA !== false,
                                        });
                                      }}
                                      className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
                                      title="Editar"
                                    >
                                      <Edit size={16} />
                                    </button>

                                    <button
                                      onClick={() => handleExcluirUsuario(user.id)}
                                      className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                                      title="Excluir"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
      </ModalBase>
    </>
  );
}
