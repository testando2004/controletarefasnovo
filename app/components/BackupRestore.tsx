'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Upload, Clock, HardDrive, FolderOpen, History, Shield, AlertTriangle, Check, X, RefreshCw, ToggleLeft, ToggleRight, FolderCheck } from 'lucide-react';
import { fetchAutenticado } from '@/app/utils/api';
import { useSistema } from '@/app/context/SistemaContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

function getApiErrorMessage(err: any, fallback: string): string {
  const error = String(err?.error || '').trim();
  const details = String(err?.details || '').trim();
  if (error && details) return `${error}: ${details}`;
  if (error) return error;
  if (details) return details;
  return fallback;
}

// ─── Tipos ──────────────────────────────────────────────────
type FrequenciaBackup = '4dias' | 'semanal' | 'quinzenal';

interface BackupHistoricoItem {
  data: string;
  tipo: 'manual' | 'automatico';
  tamanho: string;
  contagem: Record<string, number>;
  pastaDestino?: string;
}

export interface BackupConfig {
  ativo: boolean;
  frequencia: FrequenciaBackup;
  ultimoBackup: string | null;
  proximoBackup: string | null;
  pastaDestino: string | null;
}

// ─── Helpers ────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function calcularProximoBackup(ultimoBackup: string, frequencia: FrequenciaBackup): string {
  const data = new Date(ultimoBackup);
  switch (frequencia) {
    case '4dias':
      data.setDate(data.getDate() + 4);
      break;
    case 'semanal':
      data.setDate(data.getDate() + 7);
      break;
    case 'quinzenal':
      data.setDate(data.getDate() + 15);
      break;
  }
  return data.toISOString();
}

export function deveExecutarAutoBackup(config: BackupConfig): boolean {
  if (!config.ativo) return false;
  if (!config.ultimoBackup) return true; // nunca fez backup, executar agora
  const proximo = config.proximoBackup
    ? new Date(config.proximoBackup)
    : new Date(calcularProximoBackup(config.ultimoBackup, config.frequencia));
  return new Date() >= proximo;
}

export function getBackupConfig(): BackupConfig {
  const padrao: BackupConfig = {
    ativo: false,
    frequencia: 'semanal',
    ultimoBackup: null,
    proximoBackup: null,
    pastaDestino: null,
  };
  try {
    const saved = localStorage.getItem('backup_config');
    if (saved) return { ...padrao, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return padrao;
}

function salvarBackupConfig(config: BackupConfig) {
  localStorage.setItem('backup_config', JSON.stringify(config));
}

function getBackupHistorico(): BackupHistoricoItem[] {
  try {
    const saved = localStorage.getItem('backup_historico');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

function salvarBackupHistorico(historico: BackupHistoricoItem[]) {
  localStorage.setItem('backup_historico', JSON.stringify(historico.slice(0, 20)));
}

// ─── IndexedDB para armazenar o DirectoryHandle ────────────
const IDB_NAME = 'backup-handles';
const IDB_STORE = 'handles';
const IDB_KEY = 'pastaBackup';

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function salvarDirectoryHandle(handle: FileSystemDirectoryHandle) {
  const db = await openHandleDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const r = tx.objectStore(IDB_STORE).get(IDB_KEY);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return null;
  }
}

async function removerDirectoryHandle() {
  try {
    const db = await openHandleDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* ignore */ }
}

async function verificarPermissaoPasta(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const perm = await (handle as any).queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') return true;
    const req = await (handle as any).requestPermission({ mode: 'readwrite' });
    return req === 'granted';
  } catch {
    return false;
  }
}

// ─── Função exportável para auto-backup (chamada de page.tsx) ──
export async function executarAutoBackupSeNecessario() {
  const config = getBackupConfig();
  if (!config.ativo || !deveExecutarAutoBackup(config)) return;

  try {
    const response = await fetchAutenticado(`${API_URL}/backup`);
    if (!response.ok) return;
    const data = await response.json();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const dataFormatada = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const nomeArquivo = `backup-sistema-${dataFormatada}.json`;

    // Tentar salvar na pasta configurada via File System Access API
    let salvoNaPasta = false;
    const handle = await getDirectoryHandle();
    if (handle) {
      try {
        const permOk = await verificarPermissaoPasta(handle);
        if (permOk) {
          const fileHandle = await handle.getFileHandle(nomeArquivo, { create: true });
          const writable = await (fileHandle as any).createWritable();
          await writable.write(blob);
          await writable.close();
          salvoNaPasta = true;
        }
      } catch {
        // Fallback para download normal
      }
    }

    if (!salvoNaPasta) {
      // Download normal
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // Atualizar config e histórico
    const agora = new Date().toISOString();
    const novaConfig: BackupConfig = {
      ...config,
      ultimoBackup: agora,
      proximoBackup: calcularProximoBackup(agora, config.frequencia),
    };
    salvarBackupConfig(novaConfig);

    const historico = getBackupHistorico();
    historico.unshift({
      data: agora,
      tipo: 'automatico',
      tamanho: formatBytes(blob.size),
      contagem: data.contagem || {},
      pastaDestino: salvoNaPasta ? config.pastaDestino || undefined : undefined,
    });
    salvarBackupHistorico(historico);

    console.log(`[Backup Auto] Concluído: ${nomeArquivo} (${formatBytes(blob.size)})${salvoNaPasta ? ' - salvo na pasta' : ' - download'}`);
  } catch (err) {
    console.error('[Backup Auto] Falha:', err);
  }
}

// ─── Componente Principal ───────────────────────────────────
export default function BackupRestore() {
  const { mostrarAlerta, mostrarConfirmacao, usuarioLogado } = useSistema();
  const [exportando, setExportando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [historico, setHistorico] = useState<BackupHistoricoItem[]>([]);
  const [config, setConfig] = useState<BackupConfig>(getBackupConfig());
  const [nomePasta, setNomePasta] = useState<string | null>(null);
  const [suportaFileSystem, setSupportaFileSystem] = useState(false);
  const [statusPasta, setStatusPasta] = useState<'verificando' | 'acessivel' | 'sem-permissao' | 'sem-pasta'>('sem-pasta');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verificar suporte à File System Access API
  useEffect(() => {
    setSupportaFileSystem(typeof window !== 'undefined' && 'showDirectoryPicker' in window);
  }, []);

  // Carregar dados salvos e verificar status da pasta
  useEffect(() => {
    setConfig(getBackupConfig());
    setHistorico(getBackupHistorico());
    // Carregar nome da pasta salva e verificar permissão
    (async () => {
      const handle = await getDirectoryHandle();
      if (!handle) {
        setStatusPasta('sem-pasta');
        return;
      }
      setNomePasta(handle.name);
      setStatusPasta('verificando');
      try {
        const perm = await (handle as any).queryPermission({ mode: 'readwrite' });
        setStatusPasta(perm === 'granted' ? 'acessivel' : 'sem-permissao');
      } catch {
        setStatusPasta('sem-permissao');
      }
    })();
  }, []);

  const atualizarConfig = useCallback((novaConfig: BackupConfig) => {
    setConfig(novaConfig);
    salvarBackupConfig(novaConfig);
  }, []);

  const adicionarHistorico = useCallback((item: BackupHistoricoItem) => {
    setHistorico(prev => {
      const novo = [item, ...prev].slice(0, 20);
      salvarBackupHistorico(novo);
      return novo;
    });
  }, []);

  // ─── Escolher pasta de destino ───────────────────────────
  const escolherPasta = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      await salvarDirectoryHandle(handle);
      setNomePasta(handle.name);
      setStatusPasta('acessivel');
      atualizarConfig({ ...config, pastaDestino: handle.name });
      void mostrarAlerta?.('Pasta Selecionada', `Os backups serão salvos na pasta "${handle.name}".`, 'sucesso');
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      void mostrarAlerta?.('Erro', 'Não foi possível selecionar a pasta.', 'erro');
    }
  };

  const removerPasta = async () => {
    await removerDirectoryHandle();
    setNomePasta(null);
    setStatusPasta('sem-pasta');
    atualizarConfig({ ...config, pastaDestino: null });
  };

  // ─── Verificar se a pasta ainda está acessível ─────────
  const verificarPastaAcessivel = async (): Promise<{ handle: FileSystemDirectoryHandle | null; acessivel: boolean }> => {
    const handle = await getDirectoryHandle();
    if (!handle) return { handle: null, acessivel: false };
    try {
      const perm = await (handle as any).queryPermission({ mode: 'readwrite' });
      return { handle, acessivel: perm === 'granted' };
    } catch {
      return { handle, acessivel: false };
    }
  };

  // ─── Exportar backup ────────────────────────────────────
  const executarExportacao = async (tipo: 'manual' | 'automatico' = 'manual') => {
    setExportando(true);
    try {
      // 1) Se tem pasta configurada e é manual, verificar/pedir permissão ANTES de exportar
      let handleParaSalvar: FileSystemDirectoryHandle | null = null;
      const handleSalvo = await getDirectoryHandle();

      if (handleSalvo) {
        // Verificar permissão atual
        let permOk = false;
        try {
          const perm = await (handleSalvo as any).queryPermission({ mode: 'readwrite' });
          if (perm === 'granted') {
            permOk = true;
          } else {
            // Pedir permissão (só funciona com gesto do usuário, ou seja, clique manual)
            if (tipo === 'manual') {
              const req = await (handleSalvo as any).requestPermission({ mode: 'readwrite' });
              permOk = req === 'granted';
            }
          }
        } catch {
          permOk = false;
        }

        if (permOk) {
          handleParaSalvar = handleSalvo;
        } else if (tipo === 'manual') {
          // Permissão negada no manual - avisar o usuário
          void mostrarAlerta?.(
            'Permissão Necessária',
            `O navegador perdeu a permissão para salvar na pasta "${nomePasta}". Selecione a pasta novamente.`,
            'info'
          );
          try {
            const novoHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
            await salvarDirectoryHandle(novoHandle);
            setNomePasta(novoHandle.name);
            atualizarConfig({ ...config, pastaDestino: novoHandle.name });
            handleParaSalvar = novoHandle;
          } catch (pickErr: any) {
            if (pickErr?.name === 'AbortError') {
              // Usuário cancelou - continuar com download normal
            }
          }
        }
      }

      // 2) Buscar dados do servidor
      const response = await fetchAutenticado(`${API_URL}/backup`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(err, 'Erro ao exportar backup'));
      }
      const data = await response.json();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const dataFormatada = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const nomeArquivo = `backup-sistema-${dataFormatada}.json`;

      // 3) Salvar na pasta ou fazer download
      let salvoNaPasta = false;
      let nomePastaUsada = nomePasta;

      if (handleParaSalvar) {
        try {
          const fileHandle = await handleParaSalvar.getFileHandle(nomeArquivo, { create: true });
          const writable = await (fileHandle as any).createWritable();
          await writable.write(blob);
          await writable.close();

          // 4) Verificação: confirmar que o arquivo foi criado
          try {
            const verificacao = await handleParaSalvar.getFileHandle(nomeArquivo);
            const arquivoVerificado = await verificacao.getFile();
            if (arquivoVerificado.size > 0) {
              salvoNaPasta = true;
              nomePastaUsada = handleParaSalvar.name;
              setStatusPasta('acessivel');
            }
          } catch {
            // Se não conseguir verificar, confiar que foi salvo
            salvoNaPasta = true;
            nomePastaUsada = handleParaSalvar.name;
            setStatusPasta('acessivel');
          }
        } catch (writeErr) {
          console.error('[Backup] Erro ao salvar na pasta:', writeErr);
          // Fallback para download
        }
      }

      if (!salvoNaPasta) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // 5) Atualizar config e histórico
      const agora = new Date().toISOString();
      const novaConfig: BackupConfig = {
        ...config,
        ultimoBackup: agora,
        proximoBackup: calcularProximoBackup(agora, config.frequencia),
      };
      atualizarConfig(novaConfig);

      adicionarHistorico({
        data: agora,
        tipo,
        tamanho: formatBytes(blob.size),
        contagem: data.contagem || {},
        pastaDestino: salvoNaPasta ? (nomePastaUsada || undefined) : undefined,
      });

      // 6) Feedback claro ao usuário
      if (tipo === 'manual') {
        if (salvoNaPasta) {
          void mostrarAlerta?.(
            'Backup Salvo na Pasta',
            `Arquivo "${nomeArquivo}" salvo com sucesso na pasta "${nomePastaUsada}"!\nTamanho: ${formatBytes(blob.size)}`,
            'sucesso'
          );
        } else {
          void mostrarAlerta?.(
            'Backup Exportado',
            `Arquivo "${nomeArquivo}" baixado via download. (${formatBytes(blob.size)})${handleSalvo ? '\n\nDica: Para salvar direto na pasta, selecione a pasta novamente na seção "Pasta de Destino".' : ''}`,
            'sucesso'
          );
        }
      }
    } catch (err: any) {
      void mostrarAlerta?.('Erro no Backup', err.message || 'Erro ao exportar backup', 'erro');
    } finally {
      setExportando(false);
    }
  };

  // ─── Restaurar backup ──────────────────────────────────
  const handleArquivoSelecionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (arquivo) {
      if (!arquivo.name.endsWith('.json')) {
        void mostrarAlerta?.('Arquivo Inválido', 'Selecione um arquivo JSON de backup.', 'erro');
        return;
      }
      setArquivoSelecionado(arquivo);
    }
  };

  const executarRestauracao = async () => {
    if (!arquivoSelecionado) return;

    const confirmou = await mostrarConfirmacao({
      titulo: 'Restaurar Backup',
      mensagem: `ATENÇÃO: Esta ação irá SUBSTITUIR TODOS os dados atuais do sistema pelos dados do arquivo "${arquivoSelecionado.name}".\n\nEsta ação NÃO pode ser desfeita. Recomendamos exportar um backup atual antes de continuar.\n\nDeseja prosseguir?`,
      tipo: 'perigo',
      textoConfirmar: 'Sim, Restaurar',
      textoCancelar: 'Cancelar',
    });

    if (!confirmou) return;

    setRestaurando(true);
    try {
      const conteudo = await arquivoSelecionado.text();
      let dados: any;
      try {
        dados = JSON.parse(conteudo);
      } catch {
        throw new Error('O arquivo selecionado não é um JSON válido.');
      }

      if (!dados?.versao || !dados?.dados) {
        throw new Error('O arquivo não parece ser um backup válido do sistema.');
      }

      const response = await fetchAutenticado(`${API_URL}/backup`, {
        method: 'POST',
        body: JSON.stringify(dados),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(err, 'Erro ao restaurar backup'));
      }

      void mostrarAlerta?.('Backup Restaurado', 'Todos os dados foram restaurados com sucesso! A página será recarregada.', 'sucesso');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      void mostrarAlerta?.('Erro na Restauração', err.message || 'Erro ao restaurar backup', 'erro');
    } finally {
      setRestaurando(false);
      setArquivoSelecionado(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── Toggle e frequência ────────────────────────────────
  const toggleAutoBackup = () => {
    const novaConfig = { ...config, ativo: !config.ativo };
    if (novaConfig.ativo && !novaConfig.ultimoBackup) {
      novaConfig.proximoBackup = new Date().toISOString();
    }
    atualizarConfig(novaConfig);
  };

  const alterarFrequencia = (freq: FrequenciaBackup) => {
    atualizarConfig({
      ...config,
      frequencia: freq,
      proximoBackup: config.ultimoBackup
        ? calcularProximoBackup(config.ultimoBackup, freq)
        : config.proximoBackup,
    });
  };

  // ─── Guard: admin-only ──────────────────────────────────
  const isAdmin =
    usuarioLogado?.role === 'admin' ||
    usuarioLogado?.role === 'admin_departamento' ||
    (usuarioLogado?.role as string)?.toUpperCase() === 'ADMIN' ||
    (usuarioLogado?.role as string)?.toUpperCase() === 'ADMIN_DEPARTAMENTO';

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
        <Shield size={48} className="mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
        <p>Apenas administradores podem acessar a área de backup.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <HardDrive size={24} className="text-indigo-500" />
          Backup e Restauração
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Exporte seus dados como arquivo JSON para ter um backup local. Se precisar, restaure a partir de um backup anterior.
        </p>
      </div>

      {/* Exportar Backup */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Download size={24} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Exportar Backup</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Baixa um arquivo JSON com todos os dados do sistema.
              {nomePasta && (
                <span className="text-indigo-600 dark:text-indigo-400"> Será salvo na pasta <strong>&ldquo;{nomePasta}&rdquo;</strong>.</span>
              )}
            </p>
            <button
              onClick={() => executarExportacao('manual')}
              disabled={exportando}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 font-medium text-white shadow-lg transition-all duration-200 hover:from-blue-600 hover:to-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {exportando ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Exportar Backup
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pasta de Destino */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
            <FolderCheck size={24} className="text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pasta de Destino</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Escolha uma pasta local para salvar os backups automaticamente (ex: sua pasta &ldquo;backups&rdquo; sincronizada com o Drive).
            </p>

            {!suportaFileSystem && (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Seu navegador não suporta a seleção de pasta. Use o Chrome ou Edge para habilitar esta funcionalidade. Os backups serão baixados normalmente via download.
                </p>
              </div>
            )}

            {suportaFileSystem && (
              <div className="mt-4">
                {nomePasta ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${
                        statusPasta === 'acessivel'
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : statusPasta === 'sem-permissao'
                            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                      }`}>
                        <FolderCheck size={18} className={
                          statusPasta === 'acessivel'
                            ? 'text-green-600 dark:text-green-400'
                            : statusPasta === 'sem-permissao'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-gray-500'
                        } />
                        <span className={`text-sm font-medium ${
                          statusPasta === 'acessivel'
                            ? 'text-green-800 dark:text-green-300'
                            : statusPasta === 'sem-permissao'
                              ? 'text-amber-800 dark:text-amber-300'
                              : 'text-gray-700 dark:text-gray-300'
                        }`}>{nomePasta}</span>
                        {statusPasta === 'acessivel' && (
                          <Check size={14} className="text-green-600 dark:text-green-400" />
                        )}
                        {statusPasta === 'sem-permissao' && (
                          <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                        )}
                      </div>
                      <button
                        onClick={escolherPasta}
                        className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                      >
                        Alterar pasta
                      </button>
                      <button
                        onClick={removerPasta}
                        className="text-sm text-red-500 dark:text-red-400 hover:underline font-medium"
                      >
                        Remover
                      </button>
                    </div>
                    {statusPasta === 'sem-permissao' && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2">
                        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                          O navegador perdeu a permissão de acesso a esta pasta. Clique em <strong>&ldquo;Alterar pasta&rdquo;</strong> para selecioná-la novamente, ou ao exportar o sistema pedirá permissão automaticamente.
                        </p>
                      </div>
                    )}
                    {statusPasta === 'acessivel' && (
                      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check size={12} />
                        Pasta acessível - backups serão salvos diretamente aqui
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={escolherPasta}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 sm:w-auto"
                  >
                    <FolderOpen size={18} />
                    Escolher pasta (ex: sua pasta &ldquo;backups&rdquo; no Drive)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backup Automático */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
            <Clock size={24} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Backup Automático</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Quando ativado, o sistema exporta o backup automaticamente ao abrir o app (se já passou o prazo).
            </p>

            {/* Toggle */}
            <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <button
                onClick={toggleAutoBackup}
                className="flex items-center gap-2 text-sm font-medium"
              >
                {config.ativo ? (
                  <ToggleRight size={32} className="text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <ToggleLeft size={32} className="text-gray-400" />
                )}
                <span className={config.ativo ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}>
                  {config.ativo ? 'Backup automático ativado' : 'Ativar backup automático'}
                </span>
              </button>
            </div>

            {/* Frequência */}
            {config.ativo && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                    Frequência
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {([
                      { valor: '4dias' as FrequenciaBackup, label: 'A cada 4 dias' },
                      { valor: 'semanal' as FrequenciaBackup, label: 'Semanal' },
                      { valor: 'quinzenal' as FrequenciaBackup, label: 'Quinzenal' },
                    ]).map(({ valor, label }) => (
                      <button
                        key={valor}
                        onClick={() => alterarFrequencia(valor)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          config.frequencia === valor
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 ring-2 ring-indigo-500'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info de datas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Último backup:</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium mt-1">
                      {config.ultimoBackup
                        ? new Date(config.ultimoBackup).toLocaleString('pt-BR')
                        : 'Nenhum backup realizado'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Próximo backup automático:</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium mt-1">
                      {config.proximoBackup
                        ? new Date(config.proximoBackup).toLocaleString('pt-BR')
                        : 'Ao abrir o app'}
                    </p>
                  </div>
                </div>

                {nomePasta && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
                    <FolderCheck size={16} className="text-green-600 dark:text-green-400 shrink-0" />
                    <p className="text-sm text-green-800 dark:text-green-300">
                      Os backups automáticos serão salvos na pasta <strong>&ldquo;{nomePasta}&rdquo;</strong>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Restaurar Backup */}
      <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-lg dark:border-red-900/40 dark:bg-gray-800 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <Upload size={24} className="text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Restaurar Backup</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Faz upload de um arquivo JSON de backup e substitui <strong>TODOS</strong> os dados atuais.
            </p>

            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2">
              <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Atenção:</strong> A restauração substitui todos os dados existentes. Faça um backup antes de restaurar.
              </p>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <label className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 sm:w-auto">
                <FolderOpen size={18} />
                Selecionar arquivo de backup
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleArquivoSelecionado}
                />
              </label>
              <span className="self-center break-all text-sm text-gray-500 dark:text-gray-400">
                {arquivoSelecionado ? arquivoSelecionado.name : 'Nenhum arquivo escolhido'}
              </span>
            </div>

            {arquivoSelecionado && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={executarRestauracao}
                  disabled={restaurando}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 font-medium text-white shadow-lg transition-all duration-200 hover:from-red-600 hover:to-red-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {restaurando ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Restaurando...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Restaurar Backup
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setArquivoSelecionado(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Histórico de Backups */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <History size={20} className="text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Histórico de Backups</h3>
        </div>

        {historico.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
            Nenhum backup realizado ainda.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {historico.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-600 dark:bg-gray-700/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${
                    item.tipo === 'automatico'
                      ? 'bg-purple-100 dark:bg-purple-900/30'
                      : 'bg-blue-100 dark:bg-blue-900/30'
                  }`}>
                    {item.tipo === 'automatico' ? (
                      <Clock size={14} className="text-purple-600 dark:text-purple-400" />
                    ) : (
                      <Download size={14} className="text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {new Date(item.data).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.tipo === 'automatico' ? 'Backup automático' : 'Backup manual'} · {item.tamanho}
                      {item.pastaDestino && ` · Pasta: ${item.pastaDestino}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Check size={14} className="text-green-500" />
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">Concluído</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
