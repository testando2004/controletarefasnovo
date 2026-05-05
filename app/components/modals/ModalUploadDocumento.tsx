'use client';

import React from 'react';
import { X, Upload, File, Trash2, Download, Edit, Shield } from 'lucide-react';
import { Processo } from '@/app/types';
import { useSistema } from '@/app/context/SistemaContext';
import { api } from '@/app/utils/api';
import { formatarTamanhoParcela, formatarDataHora, formatarNomeArquivo } from '@/app/utils/helpers';
import { LIMITES, MENSAGENS } from '@/app/utils/constants';
import ModalBase from './ModalBase';
import LoadingOverlay from '../LoadingOverlay';

interface ModalUploadDocumentoProps {
  processo?: Processo;
  perguntaId?: number | null;
  perguntaLabel?: string | null;
  departamentoId?: number | null;
  onClose: () => void;
}

export default function ModalUploadDocumento({
  processo,
  perguntaId = null,
  perguntaLabel = null,
  departamentoId = null,
  onClose,
}: ModalUploadDocumentoProps) {
  const { adicionarDocumentoProcesso, adicionarNotificacao, mostrarAlerta, setProcessos, usuarios, usuarioLogado, departamentos } = useSistema();
  const [uploading, setUploading] = React.useState(false);
  const [arquivos, setArquivos] = React.useState<Array<{ id: number; nome: string; tamanho: number; tipo: string; file: File }>>([]);
  const [visibility, setVisibility] = React.useState<'PUBLIC' | 'ROLES' | 'USERS' | 'DEPARTAMENTOS'>('PUBLIC');
  const [selectedRoles, setSelectedRoles] = React.useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = React.useState<number[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = React.useState<number[]>([]);
  const [arrastando, setArrastando] = React.useState(false);
  const [editandoPermissoes, setEditandoPermissoes] = React.useState<number | null>(null);
  const [editVisibility, setEditVisibility] = React.useState<'PUBLIC' | 'ROLES' | 'USERS' | 'DEPARTAMENTOS'>('PUBLIC');
  const [editRoles, setEditRoles] = React.useState<string[]>([]);
  const [editUserIds, setEditUserIds] = React.useState<number[]>([]);
  const [editDeptIds, setEditDeptIds] = React.useState<number[]>([]);
  const processoDocumentos = React.useMemo(
    () => (Array.isArray(processo?.documentos) ? processo.documentos : []),
    [processo?.documentos]
  );
  const processoDepartamentoAtual = processo?.departamentoAtual;
  const documentosIniciaisRef = React.useRef<any[]>(processoDocumentos);
  const [documentosLocal, setDocumentosLocal] = React.useState<any[]>(() => documentosIniciaisRef.current);

  React.useEffect(() => {
    documentosIniciaisRef.current = processoDocumentos;
  }, [processoDocumentos]);

  React.useEffect(() => {
    setDocumentosLocal(documentosIniciaisRef.current);
  }, [processo?.id]);

  // Carregar documentos do backend ao abrir o modal (dados filtrados por permissão)
  React.useEffect(() => {
    if (!processo?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const docs = await api.getDocumentos(processo.id);
        if (!cancelled) setDocumentosLocal(Array.isArray(docs) ? docs : []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [processo?.id]);

  // Reset selected files and visibility when modal opens for different process/question
  React.useEffect(() => {
    setArquivos([]);
    setVisibility('PUBLIC');
    setSelectedRoles([]);
    setSelectedUserIds([]);
    setSelectedDeptIds([]);
    setEditandoPermissoes(null);
  }, [processo?.id, perguntaId]);

  // Auto-include current user in selectedUserIds when visibility is USERS
  React.useEffect(() => {
    if (visibility !== 'USERS' || !usuarioLogado?.id) return;
    setSelectedUserIds(prev => (
      prev.includes(usuarioLogado.id) ? prev : [...prev, usuarioLogado.id]
    ));
  }, [visibility, usuarioLogado?.id]);

  const documentos = documentosLocal;
  const documentosFiltrados = React.useMemo(() => {
    if (perguntaId) {
      return documentos.filter((d: any) => {
        if (Number(d.perguntaId) !== Number(perguntaId)) return false;
        if (departamentoId === null || departamentoId === undefined) return true;
        const dDept = Number(d?.departamentoId ?? d?.departamento_id);
        if (!Number.isFinite(dDept)) return true;
        return dDept === Number(departamentoId);
      });
    }

    // Quando aberto para um processo, mostrar apenas os documentos do departamento atual
    // do processo (comportamento solicitado pelo usuário). Isso evita que documentos
    // de departamentos anteriores apareçam no modal de upload após avançar o processo.
    if (typeof processoDepartamentoAtual === 'number') {
      return documentos.filter((d: any) => Number(d.departamentoId) === Number(processoDepartamentoAtual));
    }

    return documentos;
  }, [documentos, perguntaId, departamentoId, processoDepartamentoAtual]);

  const handleArquivosSelecionados = (fileList: FileList | null) => {
    if (!fileList) return;
    const tamanhoMaxBytes = LIMITES.TAMANHO_MAX_ARQUIVO_MB * 1024 * 1024;
    const docsNoProcesso = Number(
      (processo as any)?._count?.documentos ??
      (processo as any)?.documentosCount ??
      (Array.isArray(documentosLocal) ? documentosLocal.length : 0)
    );
    const limiteRestante = LIMITES.LIMITE_DOCUMENTOS_POR_PROCESSO - docsNoProcesso - arquivos.length;

    if (limiteRestante <= 0) {
      void mostrarAlerta?.(
        'Limite de documentos',
        `Este processo já atingiu o limite de ${LIMITES.LIMITE_DOCUMENTOS_POR_PROCESSO} documentos.`,
        'aviso'
      );
      return;
    }

    const recebidos = Array.from(fileList);
    const validos: File[] = [];
    const rejeitadosPorTamanho: string[] = [];

    for (const arquivo of recebidos) {
      if (arquivo.size > tamanhoMaxBytes) {
        rejeitadosPorTamanho.push(arquivo.name);
      } else {
        validos.push(arquivo);
      }
    }

    if (rejeitadosPorTamanho.length > 0) {
      const exemplo = rejeitadosPorTamanho.slice(0, 3).join(', ');
      void mostrarAlerta?.(
        'Arquivo muito grande',
        `${MENSAGENS.ARQUIVO_MUITO_GRANDE}${exemplo ? `\nArquivos ignorados: ${exemplo}` : ''}`,
        'aviso'
      );
    }

    const permitidos = validos.slice(0, Math.max(0, limiteRestante));
    const ignoradosPorLimite = validos.length - permitidos.length;

    if (ignoradosPorLimite > 0) {
      void mostrarAlerta?.(
        'Limite de documentos',
        `Somente ${limiteRestante} arquivo(s) foram adicionados. Limite por processo: ${LIMITES.LIMITE_DOCUMENTOS_POR_PROCESSO}.`,
        'aviso'
      );
    }

    if (permitidos.length === 0) return;
    const novos = permitidos.map((f, idx) => ({ id: Date.now() + idx, nome: f.name, tamanho: f.size, tipo: f.type || 'application/octet-stream', file: f }));
    setArquivos(prev => [...prev, ...novos]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
    handleArquivosSelecionados(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
  };

  const enviar = async () => {
    if (!processo || arquivos.length === 0) return;
    setUploading(true);
    let sucessos = 0;
    let erros = 0;
    const mensagensErro: string[] = [];
    try {
      for (let i = 0; i < arquivos.length; i++) {
        const a = arquivos[i];
          try {
            if (process.env.NODE_ENV !== 'production') {
              try { console.debug('ModalUploadDocumento - enviando', { processoId: processo.id, perguntaId, visibility, selectedRoles, selectedUserIds, fileName: a.nome }); } catch {}
            }
            const novo = await adicionarDocumentoProcesso(
              processo.id,
              a.file,
              a.tipo,
              (departamentoId ?? undefined) ?? processo.departamentoAtual,
              perguntaId ?? undefined,
              {
                visibility,
                allowedRoles: selectedRoles,
                allowedUserIds: selectedUserIds,
                allowedDepartamentos: selectedDeptIds,
              }
            );
            if (process.env.NODE_ENV !== 'production') {
              try { console.debug('ModalUploadDocumento - novoDocumento', novo); } catch {}
            }
            // Atualiza lista local imediatamente para feedback
            try {
              setDocumentosLocal(prev => {
                const list = Array.isArray(prev) ? prev.slice() : [];
                // evita duplicatas
                if (!list.some((d: any) => Number(d.id) === Number(novo.id))) list.push(novo);
                if (process.env.NODE_ENV !== 'production') {
                  try { console.debug('ModalUploadDocumento - documentosLocal (após push)', list); } catch {}
                }
                return list;
              });
            } catch {
              // noop
            }
            sucessos++;
          } catch (err: any) {
          erros++;
          const msg = err instanceof Error ? err.message : String(err);
          if (msg && !mensagensErro.includes(msg)) mensagensErro.push(msg);
        }
      }
      setArquivos([]);
      if (sucessos > 0) {
        adicionarNotificacao(sucessos === 1 ? 'Documento enviado com sucesso!' : `${sucessos} documentos enviados com sucesso!`, 'sucesso');
        // Atualizar estado global e lista local com documentos atualizados
        if (processo) {
          try {
            const [processoAtualizado, docsAtualizados] = await Promise.all([
              api.getProcesso(processo.id),
              api.getDocumentos(processo.id),
            ]);
            setProcessos((prev: any) => prev.map((p: any) => (p.id === processo.id ? processoAtualizado : p)));
            setDocumentosLocal(Array.isArray(docsAtualizados) ? docsAtualizados : []);
          } catch { /* silent */ }
        }
        onClose();
      }
      if (erros > 0) {
        const detalhe = mensagensErro.length > 0 ? `\n\nDetalhe: ${mensagensErro.join(' | ')}` : '';
        await mostrarAlerta('Erro no Upload', `${erros} arquivo(s) não puderam ser enviados${detalhe}`, 'erro');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemover = async (id: number) => {
    if (!processo) return;
    const prev = documentosLocal.slice();
    try {
      setUploading(true);

      // Remoção imediata local para feedback instantâneo
      setDocumentosLocal(prevList => prevList.filter((d: any) => d.id !== id));

      await api.excluirDocumento(id);

      // Recarrega o processo e documentos atualizados do servidor
      try {
        const [processoAtualizado, docsAtualizados] = await Promise.all([
          api.getProcesso(processo.id),
          api.getDocumentos(processo.id),
        ]);
        setProcessos((prevState: any) => prevState.map((p: any) => (p.id === processo.id ? processoAtualizado : p)));
        setDocumentosLocal(Array.isArray(docsAtualizados) ? docsAtualizados : []);
      } catch (err) {
        // Se falhar ao recarregar, mantemos a remoção local já aplicada
      }

      adicionarNotificacao('Documento excluído com sucesso', 'sucesso');
    } catch (err: any) {
      // Restaura lista local em caso de erro para evitar perder o item
      setDocumentosLocal(prev);
      const msg = err instanceof Error ? err.message : 'Erro ao excluir documento';
      await mostrarAlerta('Erro', msg, 'erro');
    } finally {
      setUploading(false);
    }
  };

  const handleEditarPermissoes = async (docId: number) => {
    if (!processo) return;
    try {
      setUploading(true);
      await api.atualizarDocumento(docId, {
        visibility: editVisibility,
        allowedRoles: editRoles,
        allowedUserIds: editUserIds,
        allowedDepartamentos: editDeptIds,
      });
      // Recarregar processo e documentos para refletir alterações
      const [processoAtualizado, docsAtualizados] = await Promise.all([
        api.getProcesso(processo.id),
        api.getDocumentos(processo.id),
      ]);
      setProcessos((prev: any) => prev.map((p: any) => (p.id === processo.id ? processoAtualizado : p)));
      setDocumentosLocal(Array.isArray(docsAtualizados) ? docsAtualizados : []);
      setEditandoPermissoes(null);
      adicionarNotificacao('Permissões atualizadas com sucesso', 'sucesso');
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar permissões';
      await mostrarAlerta('Erro', msg, 'erro');
    } finally {
      setUploading(false);
    }
  };

  const iniciarEdicaoPermissoes = (doc: any) => {
    setEditandoPermissoes(doc.id);
    setEditVisibility(doc.visibility || 'PUBLIC');
    setEditRoles(doc.allowedRoles || []);
    setEditUserIds(doc.allowedUserIds || []);
    setEditDeptIds(doc.allowedDepartamentos || []);
  };

  const handleDownload = (doc: any) => {
    try {
      const a = document.createElement('a');
      a.href = doc.url;
      a.download = doc.nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // noop
    }
  };

  return (
    <ModalBase isOpen onClose={onClose} labelledBy="upload-title" dialogClassName="w-full max-w-2xl bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none max-h-[90vh] overflow-y-auto" zIndex={1200}>
      <div className="rounded-2xl relative">
        <LoadingOverlay show={uploading} text="Enviando documento(s)..." />
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="upload-title" className="text-xl font-bold text-white flex items-center gap-2">
                <Upload size={20} />
                {perguntaId ? 'Upload para Pergunta' : 'Upload de Documentos Gerais'}
              </h2>
              {perguntaLabel && (
                <p className="text-white opacity-90 text-sm mt-1">Para: {perguntaLabel}</p>
              )}
            </div>
            <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {processo && (
            <div className="bg-cyan-50 dark:bg-[#0f2b34] rounded-xl p-4 border border-cyan-200 dark:border-[#155e75]">
              <h4 className="font-semibold text-cyan-800 dark:text-cyan-200 mb-1">{processo.nomeEmpresa}</h4>
              {processo.cliente && (
                <p className="text-sm text-cyan-600 dark:text-cyan-300">Cliente: {processo.cliente}</p>
              )}
              {perguntaLabel && (
                <p className="text-sm text-cyan-600 dark:text-cyan-300 mt-1"><strong>Pergunta:</strong> {perguntaLabel}</p>
              )}
            </div>
          )}

          {/* Visibility controls */}
          <div className="p-4 bg-gray-50 dark:bg-[var(--muted)] rounded-lg border border-gray-200 dark:border-[var(--border)]">
            <h4 className="font-semibold mb-2">Visibilidade do Anexo</h4>
            <div className="flex gap-2 mb-3 flex-wrap">
              {(['PUBLIC', 'ROLES', 'USERS', 'DEPARTAMENTOS'] as const).map(v => (
                <label key={v} className={`px-3 py-2 rounded-lg cursor-pointer text-sm ${visibility === v ? 'bg-cyan-600 text-white' : 'bg-white dark:bg-transparent border border-gray-200'}`}>
                  <input type="radio" name="visibility" value={v} className="hidden" checked={visibility === v} onChange={() => setVisibility(v)} />
                  {v === 'PUBLIC' ? 'Público' : v === 'ROLES' ? 'Por Funções' : v === 'USERS' ? 'Usuários' : 'Departamentos'}
                </label>
              ))}
            </div>

            {visibility === 'ROLES' && (
              <div className="flex gap-2 flex-wrap">
                {['ADMIN', 'GERENTE', 'USUARIO'].map(r => (
                  <label key={r} className={`px-3 py-2 rounded-lg cursor-pointer border ${selectedRoles.includes(r) ? 'bg-cyan-600 text-white' : 'bg-white dark:bg-transparent border-gray-200'}`}>
                    <input type="checkbox" className="hidden" checked={selectedRoles.includes(r)} onChange={() => setSelectedRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])} />
                    {r}
                  </label>
                ))}
              </div>
            )}

            {visibility === 'USERS' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Selecione quais usuários podem visualizar este anexo:</p>
                <div className="max-h-40 overflow-auto border rounded p-2">
                  {Array.isArray(usuarios) && usuarios.length > 0 ? (
                    usuarios.map((u: any) => (
                      <label key={u.id} className="flex items-center gap-2 p-1">
                        <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={() => setSelectedUserIds(prev => prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id])} />
                        <span className="text-sm">{u.nome} ({u.email})</span>
                      </label>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">Nenhum usuário disponível</div>
                  )}
                </div>
              </div>
            )}

            {visibility === 'DEPARTAMENTOS' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Selecione quais departamentos podem visualizar este anexo:</p>
                <div className="max-h-40 overflow-auto border rounded p-2">
                  {Array.isArray(departamentos) && departamentos.length > 0 ? (
                    departamentos.map((d: any) => (
                      <label key={d.id} className="flex items-center gap-2 p-1">
                        <input type="checkbox" checked={selectedDeptIds.includes(d.id)} onChange={() => setSelectedDeptIds(prev => prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id])} />
                        <span className="text-sm">{d.nome}</span>
                      </label>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">Nenhum departamento disponível</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Área de Upload */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${arrastando ? 'border-cyan-500 bg-cyan-50' : 'border-gray-300 hover:border-cyan-400 hover:bg-cyan-50'} cursor-pointer relative`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              onChange={(e) => handleArquivosSelecionados(e.target.files)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload size={48} className="mx-auto text-gray-400 dark:text-gray-300 mb-4" />
            <p className="text-gray-600 dark:text-gray-200 mb-2">Arraste e solte os arquivos aqui, ou clique para selecionar</p>
            <span className="inline-block bg-cyan-600 text-white px-4 py-2 rounded-lg">Selecionar Arquivos</span>
          </div>

          {/* Lista de selecionados */}
          {arquivos.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Arquivos Selecionados ({arquivos.length})
              </h3>
              <div className="space-y-2">
                {arquivos.map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-[var(--border)] rounded-lg hover:bg-gray-50 dark:hover:bg-[var(--muted)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <File size={20} className="text-gray-400 dark:text-gray-300" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm" title={a.nome}>{formatarNomeArquivo(a.nome)}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300">{formatarTamanhoParcela(Number(a.tamanho || 0))}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setArquivos(prev => prev.filter(x => x.id !== a.id))}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de Documentos já enviados (abaixo dos selecionados) */}
          {documentosFiltrados.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Documentos Enviados ({documentosFiltrados.length})
              </h3>
              <div className="space-y-2">
                {documentosFiltrados.map((doc: any) => (
                  <div key={doc.id} className="p-4 border border-gray-200 dark:border-[var(--border)] rounded-lg hover:bg-gray-50 dark:hover:bg-[var(--muted)] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <File size={20} className="text-gray-400 dark:text-gray-300" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate" title={doc.nome}>{formatarNomeArquivo(doc.nome)}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300">
                            {formatarTamanhoParcela(Number(doc.tamanho || 0))} • {formatarDataHora(doc.dataUpload)}
                            {doc.visibility && doc.visibility !== 'PUBLIC' && (
                              <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                                <Shield size={10} />
                                {doc.visibility === 'ROLES' ? 'Funções' : doc.visibility === 'USERS' ? 'Usuários' : doc.visibility === 'DEPARTAMENTOS' ? 'Departamentos' : doc.visibility}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => iniciarEdicaoPermissoes(doc)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors" title="Editar permissões">
                          <Edit size={16} />
                        </button>
                        <button type="button" onClick={() => handleDownload(doc)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-[#132235] rounded transition-colors">
                          <Download size={18} />
                        </button>
                        <button
                          onClick={() => handleRemover(doc.id)}
                          disabled={uploading}
                          className={`p-2 ${uploading ? 'opacity-50 cursor-not-allowed' : 'text-red-600 hover:bg-red-50 dark:hover:bg-[#3b1f26]'} rounded transition-colors`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Formulário inline de edição de permissões */}
                    {editandoPermissoes === doc.id && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[var(--border)] space-y-3">
                        <div className="flex gap-2 flex-wrap">
                          {(['PUBLIC', 'ROLES', 'USERS', 'DEPARTAMENTOS'] as const).map(v => (
                            <label key={v} className={`px-2 py-1 rounded text-xs cursor-pointer ${editVisibility === v ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 border border-gray-200'}`}>
                              <input type="radio" className="hidden" checked={editVisibility === v} onChange={() => setEditVisibility(v)} />
                              {v === 'PUBLIC' ? 'Público' : v === 'ROLES' ? 'Funções' : v === 'USERS' ? 'Usuários' : 'Departamentos'}
                            </label>
                          ))}
                        </div>
                        {editVisibility === 'ROLES' && (
                          <div className="flex gap-2 flex-wrap">
                            {['ADMIN', 'GERENTE', 'USUARIO'].map(r => (
                              <label key={r} className={`px-2 py-1 rounded text-xs cursor-pointer border ${editRoles.includes(r) ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-transparent border-gray-200'}`}>
                                <input type="checkbox" className="hidden" checked={editRoles.includes(r)} onChange={() => setEditRoles(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])} />
                                {r}
                              </label>
                            ))}
                          </div>
                        )}
                        {editVisibility === 'USERS' && (
                          <div className="max-h-28 overflow-auto border rounded p-2">
                            {Array.isArray(usuarios) && usuarios.map((u: any) => (
                              <label key={u.id} className="flex items-center gap-2 p-0.5 text-xs">
                                <input type="checkbox" checked={editUserIds.includes(u.id)} onChange={() => setEditUserIds(p => p.includes(u.id) ? p.filter(x => x !== u.id) : [...p, u.id])} />
                                {u.nome}
                              </label>
                            ))}
                          </div>
                        )}
                        {editVisibility === 'DEPARTAMENTOS' && (
                          <div className="max-h-28 overflow-auto border rounded p-2">
                            {Array.isArray(departamentos) && departamentos.map((d: any) => (
                              <label key={d.id} className="flex items-center gap-2 p-0.5 text-xs">
                                <input type="checkbox" checked={editDeptIds.includes(d.id)} onChange={() => setEditDeptIds(p => p.includes(d.id) ? p.filter(x => x !== d.id) : [...p, d.id])} />
                                {d.nome}
                              </label>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => handleEditarPermissoes(doc.id)} disabled={uploading} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-50">Salvar</button>
                          <button onClick={() => setEditandoPermissoes(null)} className="px-3 py-1.5 text-gray-600 text-xs border rounded-lg">Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-4 pt-6 border-t border-gray-200 dark:border-[var(--border)]">
            <button onClick={onClose} className="flex-1 px-6 py-3 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-[var(--border)] rounded-xl hover:bg-gray-100 dark:hover:bg-[var(--muted)]">Cancelar</button>
            <button onClick={enviar} disabled={arquivos.length === 0 || uploading} className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {uploading ? 'Enviando...' : `Enviar ${arquivos.length} Documento(s)`}
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}
