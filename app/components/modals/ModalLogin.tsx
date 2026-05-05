'use client';

import React, { useState } from 'react';
import { LogIn, KeyRound, ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import ModalBase from './ModalBase';
import { api } from '@/app/utils/api';
import { SENHA_MIN_LENGTH } from '@/app/utils/constants';

interface ModalLoginProps {
  onLogin: (usuario: any) => void;
}

function getDepartamentoId(usuario: any) {
  const departamentoRaw =
    usuario?.departamentoId ??
    usuario?.departamento_id ??
    usuario?.departamento?.id;
  const departamentoId = Number(departamentoRaw);
  return Number.isFinite(departamentoId) && departamentoId > 0 ? departamentoId : undefined;
}

export default function ModalLogin({ onLogin }: ModalLoginProps) {
  const [formData, setFormData] = useState({
    email: '',
    senha: '',
  });

  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [loading, setLoading] = useState(false);
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // Esqueci minha senha
  const [modoEsqueciSenha, setModoEsqueciSenha] = useState(false);
  const [etapaReset, setEtapaReset] = useState<'email' | 'codigo'>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);

  // Handlers de Esqueci Senha
  const handleSolicitarReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    if (!resetEmail.trim()) {
      setErro('Informe seu email');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSucesso('Código de verificação enviado para seu email.');
        setEtapaReset('codigo');
      } else {
        setErro(data.error || 'Erro ao solicitar redefinição');
      }
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!resetCode.trim()) {
      setErro('Informe o código de verificação');
      return;
    }
    if (novaSenha.length < SENHA_MIN_LENGTH) {
      setErro(`A senha deve ter no mínimo ${SENHA_MIN_LENGTH} caracteres`);
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim().toLowerCase(),
          code: resetCode.trim(),
          novaSenha
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSucesso('Senha redefinida com sucesso! Faça login.');
        setTimeout(() => {
          voltarParaLogin();
        }, 2000);
      } else {
        setErro(data.error || 'Erro ao redefinir senha');
      }
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const voltarParaLogin = () => {
    setModoEsqueciSenha(false);
    setEtapaReset('email');
    setErro('');
    setSucesso('');
    setResetEmail('');
    setResetCode('');
    setNovaSenha('');
    setConfirmarSenha('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    if (!formData.email || !formData.senha) {
      setErro('Preencha todos os campos');
      setLoading(false);
      return;
    }

    try {
      const response = await api.login(formData.email, formData.senha);

      if (response.needEmailCode) {
        setNeedCode(true);
        setLoading(false);
        return;
      }

      if (response.usuario) {
        const deptId = getDepartamentoId(response.usuario);
        const usuario = {
          id: response.usuario.id,
          nome: response.usuario.nome,
          email: response.usuario.email,
          role: response.usuario.role.toLowerCase() as 'admin' | 'admin_departamento' | 'gerente' | 'usuario',
          ativo: (response.usuario as any).ativo,
          isGhost: (response.usuario as any).isGhost,
          departamentoId: deptId,
          departamento_id: deptId,
          permissoes: response.usuario.permissoes || [],
        };
        onLogin(usuario);
      } else {
        setErro('Erro ao fazer login');
      }
    } catch (error: any) {
      setErro(error.message || 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const response = await api.verifyEmailCode(formData.email, code);
      if (response.usuario) {
        const deptId = getDepartamentoId(response.usuario);
        const usuario = {
          id: response.usuario.id,
          nome: response.usuario.nome,
          email: response.usuario.email,
          role: response.usuario.role.toLowerCase() as 'admin' | 'admin_departamento' | 'gerente' | 'usuario',
          ativo: (response.usuario as any).ativo,
          isGhost: (response.usuario as any).isGhost,
          departamentoId: deptId,
          departamento_id: deptId,
          permissoes: response.usuario.permissoes || [],
        };
        onLogin(usuario);
      } else {
        setErro('Erro ao verificar código');
      }
    } catch (err: any) {
      setErro(err.message || 'Código inválido');
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDER ESQUECI SENHA ====================
  if (modoEsqueciSenha) {
    return (
      <ModalBase
        isOpen
        onClose={() => {}}
        labelledBy="reset-title"
        describedBy="reset-desc"
        dialogClassName="w-full max-w-md bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none"
      >
        <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-8 text-white">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-white/25 p-3 rounded-2xl shadow-lg">
                <KeyRound size={40} className="text-white" />
              </div>
            </div>
            <h1 id="reset-title" className="text-2xl font-bold text-center">Redefinir Senha</h1>
            <p id="reset-desc" className="text-center text-white/90 mt-2">
              {etapaReset === 'email'
                ? 'Informe seu email para receber o código'
                : 'Informe o código e sua nova senha'}
            </p>
          </div>

          <div className="p-8">
            {etapaReset === 'email' ? (
              <form onSubmit={handleSolicitarReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-[var(--border)] rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all duration-200 text-gray-900 dark:text-[var(--fg)] bg-white dark:bg-[var(--card)]"
                      placeholder="seu@email.com"
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                </div>

                {erro && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm" role="alert">
                    {erro}
                  </div>
                )}
                {sucesso && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
                    {sucesso}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Mail size={20} />
                  {loading ? 'Enviando...' : 'Enviar Código'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetSenha} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Código de Verificação
                  </label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-[var(--border)] rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all text-gray-900 dark:text-[var(--fg)] bg-white dark:bg-[var(--card)] text-center text-2xl tracking-widest font-mono"
                    placeholder="000000"
                    maxLength={6}
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Nova Senha (mínimo {SENHA_MIN_LENGTH} caracteres)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type={mostrarNovaSenha ? 'text' : 'password'}
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 dark:border-[var(--border)] rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all text-gray-900 dark:text-[var(--fg)] bg-white dark:bg-[var(--card)]"
                      placeholder="Nova senha"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {mostrarNovaSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {novaSenha && novaSenha.length < SENHA_MIN_LENGTH && (
                    <p className="text-xs text-red-500 mt-1">
                      {SENHA_MIN_LENGTH - novaSenha.length} caracteres restantes
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="password"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-[var(--border)] rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all text-gray-900 dark:text-[var(--fg)] bg-white dark:bg-[var(--card)]"
                      placeholder="Confirme a senha"
                      disabled={loading}
                    />
                  </div>
                  {confirmarSenha && novaSenha !== confirmarSenha && (
                    <p className="text-xs text-red-500 mt-1">As senhas não coincidem</p>
                  )}
                </div>

                {erro && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm" role="alert">
                    {erro}
                  </div>
                )}
                {sucesso && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
                    {sucesso}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || novaSenha.length < SENHA_MIN_LENGTH || novaSenha !== confirmarSenha}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <KeyRound size={20} />
                  {loading ? 'Redefinindo...' : 'Redefinir Senha'}
                </button>

                <button
                  type="button"
                  onClick={() => { setEtapaReset('email'); setErro(''); setSucesso(''); }}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
                >
                  Reenviar código
                </button>
              </form>
            )}

            <button
              onClick={voltarParaLogin}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mt-4 py-2"
            >
              <ArrowLeft size={16} />
              Voltar para o login
            </button>
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-[var(--border)] text-center text-sm text-gray-600 dark:text-gray-300">
            Versão 1.0 - Controle de Tarefas &copy; 2026
          </div>
        </div>
      </ModalBase>
    );
  }

  // ==================== RENDER LOGIN NORMAL ====================
  return (
    <ModalBase
      isOpen
      onClose={() => {}}
      labelledBy="login-title"
      describedBy="login-desc"
      initialFocusSelector="#login-user"
      dialogClassName="w-full max-w-md bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none"
    >
        {/* Card Principal */}
        <div className="bg-white dark:bg-[var(--card)] rounded-2xl overflow-hidden">
          {/* Header com Gradient */}
          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-8 text-white">
            <h1 id="login-title" className="text-3xl font-bold text-center">Controle de Tarefas</h1>
            <p id="login-desc" className="text-center text-white/90 mt-2">Gerenciamento de Processos</p>
          </div>

          {/* Form */}
          <div className="p-8">
            <form onSubmit={(e) => (needCode ? handleVerifyCode(e) : handleSubmit(e))} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-[var(--border)] rounded-lg focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition-all duration-200 text-gray-900 dark:text-[var(--fg)] bg-white dark:bg-[var(--card)]"
                  placeholder="seu@email.com"
                  id="login-user"
                  aria-required
                  disabled={loading}
                />
              </div>

              {!needCode && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={formData.senha}
                      onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                      className="w-full px-4 py-3 pr-10 border-2 border-gray-200 dark:border-[var(--border)] rounded-lg focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition-all duration-200 text-gray-900 dark:text-[var(--fg)] bg-white dark:bg-[var(--card)]"
                      placeholder="Sua senha"
                      aria-required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {needCode && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Código de verificação
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-[var(--border)] rounded-lg focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition-all duration-200 text-gray-900 dark:text-[var(--fg)] bg-white dark:bg-[var(--card)]"
                    placeholder="000000"
                    aria-required
                    disabled={loading}
                  />
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setErro('');
                        setLoading(true);
                        try {
                          await api.login(formData.email, formData.senha);
                        } catch (err) {
                          // ignore
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="text-sm text-cyan-600 hover:underline"
                    >
                      Reenviar código
                    </button>
                  </div>
                </div>
              )}

              {erro && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm" role="alert">
                  {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                <LogIn size={20} />
                {loading ? (needCode ? 'Verificando...' : 'Entrando...') : (needCode ? 'Verificar código' : 'Entrar')}
              </button>

              {!needCode && (
                <button
                  type="button"
                  onClick={() => {
                    setModoEsqueciSenha(true);
                    setErro('');
                  }}
                  className="w-full text-sm text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 py-2 transition-colors"
                >
                  Esqueci minha senha
                </button>
              )}
            </form>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-[var(--border)] text-center text-sm text-gray-600 dark:text-gray-300">
            Versão 1.0 - Controle de Tarefas &copy; 2026
          </div>
        </div>
    </ModalBase>
  );
}
