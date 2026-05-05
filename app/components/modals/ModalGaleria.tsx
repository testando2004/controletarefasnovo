'use client';

import React from 'react';
import { X, File, Download, Eye, Trash2, Edit, Shield } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import { Documento } from '@/app/types';
import { formatarTamanhoParcela, formatarDataHora, formatarNomeArquivo } from '@/app/utils/helpers';
import { api } from '@/app/utils/api';

interface GaleriaDocumentosProps {
  onClose: () => void;
  departamentoId?: number;
  processoId?: number;
  titulo?: string;
}

export default function GaleriaDocumentos({ onClose, departamentoId, processoId, titulo }: GaleriaDocumentosProps) {
  const { processos, departamentos, setProcessos, adicionarNotificacao, mostrarAlerta, setShowPreviewDocumento, usuarios } = useSistema();
  const { mostrarConfirmacao } = useSistema();

  const [docsCarregados, setDocsCarregados] = React.useState<Documento[]>([]);
  const [carregando, setCarregando] = React.useState(false);
  const [processingId, setProcessingId] = React.useState<number | null>(null);

  // Estado para edição inline de permissões
  const [editandoPermissoes, setEditandoPermissoes] = React.useState<number | null>(null);
  const [editVisibility, setEditVisibility] = React.useState<'PUBLIC' | 'ROLES' | 'USERS' | 'DEPARTAMENTOS'>('PUBLIC');
  const [editRoles, setEditRoles] = React.useState<string[]>([]);
  const [editUserIds, setEditUserIds] = React.useState<number[]>([]);
  const [editDeptIds, setEditDeptIds] = React.useState<number[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    // If opened for a specific processo, fetch its documents from backend.
    if (typeof processoId === 'number') {
      void (async () => {
        try {
          setCarregando(true);
          const list = await api.getDocumentos(processoId);
          if (cancelled) return;
          const filtrados = (Array.isArray(list) ? list : [])
            .filter((d: any) => (typeof departamentoId === 'number' ? Number(d.departamentoId) === Number(departamentoId) : true))
            .sort((a: any, b: any) => new Date(b.dataUpload as any).getTime() - new Date(a.dataUpload as any).getTime());
          setDocsCarregados(filtrados as any);
        } finally {
          if (!cancelled) setCarregando(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // If opened for a department (no processoId), try to load documents from all processes
    // that report having documents. This ensures recently uploaded files appear even when
    // the `processos` state is using a lite fetch that doesn't include all documentos.
    void (async () => {
      try {
        setCarregando(true);
        // Collect processoIds that may have documents
        // Check both _count.documentos (from Prisma include) and documentosCount (legacy)
        const possiveisProcessos: number[] = (processos || [])
          .filter((p: any) => {
            const count = Number((p as any)?._count?.documentos || (p as any)?.documentosCount || 0);
            if (count > 0) return true;
            // Also include processes whose embedded documentos array has entries
            if (Array.isArray(p.documentos) && p.documentos.length > 0) return true;
            // Include processes currently in this department (may have recently uploaded docs)
            if (typeof departamentoId === 'number' && Number(p.departamentoAtual) === departamentoId) return true;
            return false;
          })
          .map((p: any) => Number(p.id))
          .filter((id: number) => Number.isFinite(id));

        const acumulado: any[] = [];
        for (const pid of possiveisProcessos) {
          try {
            const list = await api.getDocumentos(pid);
            const arr = Array.isArray(list) ? list : [];
            for (const d of arr) {
              if (typeof departamentoId === 'number' && Number(d.departamentoId) !== Number(departamentoId)) continue;
              acumulado.push(d);
            }
          } catch (err) {
            // ignore per-process failures
          }
        }

        if (!cancelled) {
          const uniq = acumulado
            .filter(Boolean)
            .sort((a: any, b: any) => new Date(b.dataUpload as any).getTime() - new Date(a.dataUpload as any).getTime());
          setDocsCarregados(uniq as any);
        }
      } finally {
        if (!cancelled) setCarregando(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [processoId, departamentoId, processos]);

  const documentos: Documento[] = React.useMemo(() => {
    // Sempre usar os documentos carregados do backend (já filtrados por permissão)
    // Nunca usar o fallback de processos locais pois não tem filtro de visibilidade
    return docsCarregados;
  }, [docsCarregados]);

  const getIconeByTipo = (tipo: string) => {
    return <File size={24} className="text-gray-400" />;
  };

  const getNomeDepartamento = (id?: number) => {
    if (!id) return '—';
    return departamentos.find((d) => d.id === id)?.nome || '—';
  };

  const handleVer = (doc: Documento) => {
    // The ModalPreviewDocumento fetches a signed URL by document ID, so we
    // do NOT require doc.url to be populated (the backend stores it as '').
    setShowPreviewDocumento(doc);
  };

  const handleDownload = (doc: Documento) => {
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

  const iniciarEdicaoPermissoes = (doc: Documento) => {
    setEditandoPermissoes(doc.id);
    setEditVisibility((doc.visibility as any) || 'PUBLIC');
    setEditRoles(doc.allowedRoles || []);
    setEditUserIds(doc.allowedUserIds || []);
    setEditDeptIds(doc.allowedDepartamentos || []);
  };

  const handleSalvarPermissoes = async (docId: number) => {
    try {
      setProcessingId(docId);
      await api.atualizarDocumento(docId, {
        visibility: editVisibility,
        allowedRoles: editRoles,
        allowedUserIds: editUserIds,
        allowedDepartamentos: editDeptIds,
      });

      // Atualizar documento na lista local
      setDocsCarregados(prev =>
        prev.map(d =>
          d.id === docId
            ? { ...d, visibility: editVisibility, allowedRoles: editRoles, allowedUserIds: editUserIds, allowedDepartamentos: editDeptIds }
            : d
        )
      );

      // Atualizar estado global
      if (typeof processoId === 'number') {
        try {
          const processoAtualizado = await api.getProcesso(processoId);
          setProcessos((prev: any) => prev.map((p: any) => (p.id === processoId ? processoAtualizado : p)));
        } catch { /* silent */ }
      }

      setEditandoPermissoes(null);
      adicionarNotificacao('Permissoes atualizadas com sucesso', 'sucesso');
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar permissoes';
      await mostrarAlerta('Erro', msg, 'erro');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApagar = async (doc: Documento) => {
    try {
      const confirmado = await mostrarConfirmacao({
        titulo: 'Confirmar exclusão',
        mensagem: `Deseja realmente excluir o documento "${doc.nome}"? Esta ação não pode ser desfeita.`,
        tipo: 'perigo',
        textoConfirmar: 'Sim, excluir',
        textoCancelar: 'Cancelar',
      });
      if (!confirmado) return;
    } catch {
      return;
    }
    const id = Number(doc.id);
    const prevDocs = docsCarregados.slice();
    const prevProcessos = (processos || []).slice();
    try {
      setProcessingId(id);

      // Remoção otimista local imediata
      if (typeof processoId === 'number') {
        setDocsCarregados(prev => prev.filter((d: any) => Number(d.id) !== id));
        // Também atualiza o estado global para manter tudo em sincronia
        setProcessos(prev => prev.map((p: any) => {
          if (Number(p.id) !== Number(processoId)) return p;
          const newDocumentos = Array.isArray(p.documentos)
            ? p.documentos.filter((d: any) => Number(d.id) !== id)
            : p.documentos;
          return {
            ...p,
            documentos: newDocumentos,
            // Also decrement documentosCount so count badges update immediately
            documentosCount: Math.max(0, (Number(p.documentosCount) || 0) - 1),
            _count: p._count ? { ...p._count, documentos: Math.max(0, (Number(p._count.documentos) || 0) - 1) } : p._count,
          };
        }));
      } else {
        setProcessos(prev => prev.map((p: any) => {
          if (Number(p.id) !== Number(doc.processoId)) return p;
          const newDocumentos = Array.isArray(p.documentos)
            ? p.documentos.filter((d: any) => Number(d.id) !== id)
            : p.documentos;
          return {
            ...p,
            documentos: newDocumentos,
            documentosCount: Math.max(0, (Number(p.documentosCount) || 0) - 1),
            _count: p._count ? { ...p._count, documentos: Math.max(0, (Number(p._count.documentos) || 0) - 1) } : p._count,
          };
        }));
      }

      const res = await api.excluirDocumento(id);

      // API may return { alreadyDeleted: true } for 404, treat as success
      if (res && (res.alreadyDeleted === true || res.message || res.message === 'Documento excluído com sucesso')) {
        // nothing more to do
      }

      // Re-fetch the process from the server so that _count.documentos (and any
      // other derived data) is updated in the global state.  This ensures the
      // document count badge on the ProcessoCard refreshes after deletion.
      const targetProcessoId = typeof processoId === 'number' ? processoId : Number(doc.processoId);
      if (Number.isFinite(targetProcessoId)) {
        try {
          const processoAtualizado = await api.getProcesso(targetProcessoId);
          setProcessos((prev: any) => prev.map((p: any) => (Number(p.id) === targetProcessoId ? processoAtualizado : p)));
        } catch {
          // If re-fetch fails, the optimistic removal is still in place
        }
      }

      adicionarNotificacao('Documento excluído com sucesso', 'sucesso');
    } catch (err: any) {
      // Restaura estado anterior em caso de erro
      setDocsCarregados(prevDocs);
      setProcessos(prevProcessos);
      const msg = err instanceof Error ? err.message : 'Erro ao excluir documento';
      await mostrarAlerta('Erro', msg, 'erro');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl transform transition-all duration-300 max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 rounded-t-2xl sticky top-0 z-10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {titulo || 'Galeria de Documentos'}
            {!titulo && departamentoId ? ` — ${getNomeDepartamento(departamentoId)}` : ''}
          </h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-96px)]">
          {carregando ? (
            <div className="text-center py-12 text-gray-500">
              <File size={48} className="mx-auto mb-2 opacity-30" />
              <p>Carregando documentos…</p>
            </div>
          ) : documentos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <File size={48} className="mx-auto mb-2 opacity-30" />
              <p>Nenhum documento disponível</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documentos.map((doc) => (
                <div
                  key={doc.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all hover:bg-gray-50"
                >
                  <div className="flex justify-center mb-3">{getIconeByTipo(doc.tipo)}</div>
                  <p className="font-medium text-gray-900 text-sm text-center truncate" title={doc.nome}>
                    {formatarNomeArquivo(doc.nome)}
                  </p>
                  <p className="text-xs text-gray-600 text-center mt-1">
                    {formatarTamanhoParcela(Number(doc.tamanho || 0))} &bull; {doc.tipo}
                  </p>
                  <p className="text-xs text-gray-500 text-center mt-1">
                    {getNomeDepartamento(doc.departamentoId)} &bull; {formatarDataHora(doc.dataUpload)}
                  </p>
                  {/* Indicador de visibilidade */}
                  {doc.visibility && doc.visibility !== 'PUBLIC' && (
                    <p className="text-xs text-center mt-1">
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <Shield size={10} />
                        {doc.visibility === 'ROLES' ? 'Por Funcoes' : doc.visibility === 'USERS' ? 'Usuarios' : doc.visibility === 'DEPARTAMENTOS' ? 'Departamentos' : doc.visibility}
                      </span>
                    </p>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleVer(doc)}
                      className="flex-1 p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center justify-center gap-1"
                    >
                      <Eye size={14} />
                      <span className="text-xs">Ver</span>
                    </button>
                    <button
                      onClick={() => iniciarEdicaoPermissoes(doc)}
                      className="flex-1 p-2 text-indigo-600 hover:bg-indigo-50 rounded transition-colors flex items-center justify-center gap-1"
                      title="Editar permissoes"
                    >
                      <Edit size={14} />
                      <span className="text-xs">Permissoes</span>
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      className="flex-1 p-2 text-cyan-600 hover:bg-cyan-50 rounded transition-colors flex items-center justify-center gap-1"
                    >
                      <Download size={14} />
                      <span className="text-xs">Baixar</span>
                    </button>
                    <button
                      onClick={() => handleApagar(doc)}
                      disabled={processingId === doc.id}
                      aria-disabled={processingId === doc.id}
                      className={`flex-1 p-2 ${processingId === doc.id ? 'opacity-50 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'} rounded transition-colors flex items-center justify-center gap-1`}
                    >
                      <Trash2 size={14} />
                      <span className="text-xs">Apagar</span>
                    </button>
                  </div>

                  {/* Formulario inline de edicao de permissoes */}
                  {editandoPermissoes === doc.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                      <p className="text-xs font-semibold text-gray-700">Visibilidade do documento:</p>
                      <div className="flex gap-1 flex-wrap">
                        {(['PUBLIC', 'ROLES', 'USERS', 'DEPARTAMENTOS'] as const).map(v => (
                          <label key={v} className={`px-2 py-1 rounded text-[10px] cursor-pointer ${editVisibility === v ? 'bg-indigo-600 text-white' : 'bg-gray-100 border border-gray-200'}`}>
                            <input type="radio" className="hidden" checked={editVisibility === v} onChange={() => setEditVisibility(v)} />
                            {v === 'PUBLIC' ? 'Publico' : v === 'ROLES' ? 'Funcoes' : v === 'USERS' ? 'Usuarios' : 'Departamentos'}
                          </label>
                        ))}
                      </div>
                      {editVisibility === 'ROLES' && (
                        <div className="flex gap-1 flex-wrap">
                          {['ADMIN', 'GERENTE', 'USUARIO'].map(r => (
                            <label key={r} className={`px-2 py-1 rounded text-[10px] cursor-pointer border ${editRoles.includes(r) ? 'bg-indigo-600 text-white' : 'bg-white border-gray-200'}`}>
                              <input type="checkbox" className="hidden" checked={editRoles.includes(r)} onChange={() => setEditRoles(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])} />
                              {r}
                            </label>
                          ))}
                        </div>
                      )}
                      {editVisibility === 'USERS' && (
                        <div className="max-h-24 overflow-auto border rounded p-1">
                          {Array.isArray(usuarios) && usuarios.map((u: any) => (
                            <label key={u.id} className="flex items-center gap-1 p-0.5 text-[10px]">
                              <input type="checkbox" checked={editUserIds.includes(u.id)} onChange={() => setEditUserIds(p => p.includes(u.id) ? p.filter(x => x !== u.id) : [...p, u.id])} />
                              {u.nome}
                            </label>
                          ))}
                        </div>
                      )}
                      {editVisibility === 'DEPARTAMENTOS' && (
                        <div className="max-h-24 overflow-auto border rounded p-1">
                          {Array.isArray(departamentos) && departamentos.map((d: any) => (
                            <label key={d.id} className="flex items-center gap-1 p-0.5 text-[10px]">
                              <input type="checkbox" checked={editDeptIds.includes(d.id)} onChange={() => setEditDeptIds(p => p.includes(d.id) ? p.filter(x => x !== d.id) : [...p, d.id])} />
                              {d.nome}
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSalvarPermissoes(doc.id)}
                          disabled={processingId === doc.id}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-50"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditandoPermissoes(null)}
                          className="px-3 py-1.5 text-gray-600 text-xs border rounded-lg"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
