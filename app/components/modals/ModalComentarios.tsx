'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/app/utils/api';
import { X, MessageSquare, Edit, User, AtSign, Bell, Reply, CornerDownRight, Link2 } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import LoadingOverlay from '../LoadingOverlay';
import MentionInput from '../MentionInput';
import { Processo } from '@/app/types';
import { obterNotificacoesMencaoNaoLidasPorProcesso } from '@/app/utils/mentions';

interface ModalComentariosProps {
  processoId: number;
  processo?: Processo;
  onClose: () => void;
}
export default function ModalComentarios({
  processoId,
  processo,
  onClose,
}: ModalComentariosProps) {
  // (Removido: já está sendo desestruturado na chamada abaixo)

  // ...existing code...
    // ...existing code...

  const {
    setProcessos,
    adicionarComentarioProcesso,
    atualizarProcesso,
    departamentos,
    usuarioLogado,
    mostrarConfirmacao,
    notificacoes,
    marcarNotificacaoComoLida,
  } = useSistema();

  const [comentarioAtual, setComentarioAtual] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [textoEditado, setTextoEditado] = useState('');
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [respondendo, setRespondendo] = useState<number | null>(null);
  const [textoResposta, setTextoResposta] = useState('');
  const [comentariosLocal, setComentariosLocal] = useState<any[]>(() =>
    Array.isArray((processo as any)?.comentarios) ? ((processo as any).comentarios as any[]) : []
  );

  // Mantém o estado local em sincronia quando o prop `processo` mudar
  useEffect(() => {
    if (Array.isArray((processo as any)?.comentarios)) {
      setComentariosLocal((processo as any).comentarios as any[]);
    }
  }, [processo]);

  // Ao abrir o modal, busca os comentários do backend e atualiza o processo no contexto
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [comentarios, usuariosData] = await Promise.all([
          api.getComentarios(processoId),
          api.getUsuarios().catch(() => []),
        ]);
        
        if (!ativo) return;

        if (comentarios && Array.isArray(comentarios)) {
          setComentariosLocal(comentarios);
          setProcessos(prev => prev.map(p =>
            p.id === processoId ? { ...p, comentarios } : p
          ));
        }
        
        if (usuariosData && Array.isArray(usuariosData)) {
          setUsuarios(usuariosData);
        }
      } catch (err) {
        console.error('Erro ao buscar comentários:', err);
      }
    })();
    return () => { ativo = false; };
  }, [processoId, setProcessos]);

  // Se existem notificações de menção não lidas para este processo, ao abrir o modal
  // marcamos como lidas (o usuário efetivamente “viu” a menção ao entrar nos comentários).
  useEffect(() => {
    const pendentes = obterNotificacoesMencaoNaoLidasPorProcesso(notificacoes as any, processoId);
    if (!pendentes.length) return;

    // Evita flood de requests: marca uma a uma, mas sem bloquear o UI
    for (const n of pendentes) {
      const id = Number(n?.id);
      if (Number.isFinite(id)) {
        void marcarNotificacaoComoLida(id);
      }
    }
  }, [notificacoes, processoId, marcarNotificacaoComoLida]);
  const deptAtual = departamentos.find((d) => d.id === processo?.departamentoAtual);

  // Organizar comentários em threads (principais + respostas)
  const organizarComentariosEmThreads = () => {
    const list = Array.isArray(comentariosLocal) ? comentariosLocal : [];

    // Top-level: parentId null/undefined
    const principais = list
      .filter((c: any) => c?.parentId == null)
      .sort((a: any, b: any) => {
        const ta = new Date(a?.timestamp ?? a?.criadoEm ?? 0).getTime();
        const tb = new Date(b?.timestamp ?? b?.criadoEm ?? 0).getTime();
        return tb - ta;
      });

    return principais.map((principal: any) => {
      const respostas = list
        .filter((c: any) => c?.parentId === principal.id)
        .sort((a: any, b: any) => {
          const ta = new Date(a?.timestamp ?? a?.criadoEm ?? 0).getTime();
          const tb = new Date(b?.timestamp ?? b?.criadoEm ?? 0).getTime();
          return ta - tb;
        });
      return { ...principal, respostas };
    });
  };

  const comentariosComRespostas = organizarComentariosEmThreads();

  const detectarMencoes = (texto: string) => {
    const matches = texto.match(/@[A-Za-z0-9_À-ÖØ-öø-ÿ]+/g);
    return matches ? Array.from(new Set(matches.map((m) => m.trim()))) : [];
  };

  const handleEnviar = async () => {
    if (!comentarioAtual.trim() || enviando) return;
    setEnviando(true);
    try {
      const mencoes = detectarMencoes(comentarioAtual);
      await adicionarComentarioProcesso(processoId, comentarioAtual.trim(), mencoes);
      const comentariosAtualizados = await api.getComentarios(processoId);
      if (comentariosAtualizados && Array.isArray(comentariosAtualizados)) {
        setComentariosLocal(comentariosAtualizados);
        setProcessos(prev => prev.map(p =>
          p.id === processoId ? { ...p, comentarios: comentariosAtualizados } : p
        ));
      }
      setComentarioAtual('');
    } catch (err) {
      console.warn('Erro ao enviar comentário', err);
    } finally {
      setEnviando(false);
    }
  };

  const handleEnviarResposta = async (parentId: number) => {
    if (!textoResposta.trim() || enviando) return;
    setEnviando(true);
    try {
      const mencoes = detectarMencoes(textoResposta);
      const deptId = processo?.departamentoAtual || null;
      
      await api.salvarComentario({
        processoId,
        texto: textoResposta.trim(),
        departamentoId: deptId,
        mencoes,
        parentId,
      });
      
      // Recarregar comentários antes de limpar o estado
      const comentariosAtualizados = await api.getComentarios(processoId);
      
      if (comentariosAtualizados && Array.isArray(comentariosAtualizados)) {
        setComentariosLocal(comentariosAtualizados);
        setProcessos(prev => prev.map(p =>
          p.id === processoId ? { ...p, comentarios: comentariosAtualizados } : p
        ));
      }
      
      // Limpar estado apenas depois de atualizar
      setTextoResposta('');
      setRespondendo(null);
    } catch (err) {
      console.warn('Erro ao enviar resposta', err);
    } finally {
      setEnviando(false);
    }
  };

  const handleEditar = (comentario: any) => {
    setEditando(comentario.id);
    setTextoEditado(comentario.texto || '');
  };

  const handleSalvarEdicao = (comentarioId: number) => {
    if (!processo) return;
    (async () => {
      try {
        setEnviando(true);
        await api.atualizarComentario(comentarioId, textoEditado);
        // Recarrega o processo atualizado do backend e atualiza no contexto global
        const processoAtualizado = await api.getProcesso(processoId);
        setProcessos(prev => prev.map(p => p.id === processoId ? processoAtualizado : p));
      } catch (err) {
        console.error('Erro ao salvar edição do comentário:', err);
      } finally {
        setEnviando(false);
        setEditando(null);
        setTextoEditado('');
      }
    })();
  };

  const handleCancelarEdicao = () => {
    setEditando(null);
    setTextoEditado('');
  };

  const podeExcluir =
    usuarioLogado?.role === 'admin' ||
    usuarioLogado?.role === 'admin_departamento' ||
    usuarioLogado?.role === 'gerente';

  const handleExcluir = (comentarioId: number) => {
    if (!processo) return;
    void (async () => {
      const ok = await mostrarConfirmacao({
        titulo: 'Excluir Comentário',
        mensagem: 'Tem certeza que deseja excluir este comentário?\n\nEsta ação não poderá ser desfeita.',
        tipo: 'perigo',
        textoConfirmar: 'Sim, Excluir',
        textoCancelar: 'Cancelar',
      });
      if (!ok) return;

      try {
        await api.excluirComentario(comentarioId);
        // Busca o processo atualizado do backend e atualiza no contexto global
        const processoAtualizado = await api.getProcesso(processoId);
        setProcessos(prev => prev.map(p => p.id === processoId ? processoAtualizado : p));
      } catch (err) {
        console.error('Erro ao excluir comentário:', err);
      }
    })();
  };

  const renderTextoComMencoes = (texto: string) => {
    const partes = String(texto || '').split(/(@[A-Za-z0-9_À-ÖØ-öø-ÿ]+)/g);
    return partes.map((parte, idx) => {
      if (parte.startsWith('@')) {
        return (
          <span key={idx} className="bg-cyan-100 text-cyan-700 px-1 rounded font-medium">
            {parte}
          </span>
        );
      }
      return <React.Fragment key={idx}>{parte}</React.Fragment>;
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative">
        <LoadingOverlay show={enviando} text="Enviando comentário..." />
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 p-6 rounded-t-2xl flex-shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <MessageSquare size={24} />
                Comentários - {(() => {
                  const nomeEmpresa = processo?.nomeEmpresa;
                  if (nomeEmpresa) return nomeEmpresa;

                  const emp = (processo as any)?.empresa;
                  if (typeof emp === 'string') return emp;
                  if (emp && typeof emp === 'object') {
                    return emp.razao_social || emp.apelido || emp.codigo || `Processo #${processoId}`;
                  }

                  return `Processo #${processoId}`;
                })()}
              </h3>
              <p className="text-white opacity-90 text-sm mt-1">
                {comentariosLocal.length} comentários • Departamento: {deptAtual?.nome || '—'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {comentariosComRespostas.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">Nenhum comentário ainda</p>
              <p className="text-sm">Seja o primeiro a comentar neste processo</p>
            </div>
          ) : (
            comentariosComRespostas.map((comentario: any) => {
              const dept = departamentos.find((d) => d.id === comentario.departamentoId);
              const ts = comentario.timestamp ? new Date(comentario.timestamp as any) : null;
              const timestampLabel = ts && !Number.isNaN(ts.getTime()) ? ts.toLocaleString('pt-BR') : '';
              
              // Verificar se o usuário logado foi mencionado
              const usuarioMencionado = comentario.mencoes?.some((mencao: string) => {
                const nomeMencao = mencao.replace('@', '').replace(/_/g, ' ');
                return nomeMencao.toLowerCase() === usuarioLogado?.nome?.toLowerCase();
              });

              const isLinked = !!(comentario as any).isInterligado;
              const linkedName = (comentario as any).processoOrigemNome || '';

              return (
                <div 
                  key={comentario.id} 
                  className={`rounded-xl p-4 transition-all ${
                    isLinked
                      ? 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 border-l-4 border-purple-400 shadow-md hover:shadow-lg'
                      : usuarioMencionado
                        ? 'bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950 dark:to-blue-950 border-l-4 border-cyan-500 shadow-md hover:shadow-lg'
                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`w-10 h-10 rounded-full bg-gradient-to-br ${
                          dept?.cor || 'from-gray-400 to-gray-500'
                        } flex items-center justify-center text-white font-bold`}
                      >
                        {String(comentario.autor || 'V').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{comentario.autor}</div>
                          {usuarioMencionado && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-500 text-white text-xs rounded-full font-medium animate-pulse">
                              <Bell size={12} />
                              Você foi mencionado
                            </span>
                          )}
                          {isLinked && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full font-medium">
                              <Link2 size={12} />
                              {linkedName}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span>{dept?.nome || '—'}</span>
                          <span>•</span>
                          <span>{timestampLabel}</span>
                          {comentario.editado && (
                            <>
                              <span>•</span>
                              <span className="italic">Editado</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditar(comentario)}
                        className="p-2 text-cyan-600 hover:bg-cyan-100 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit size={14} />
                      </button>

                      {podeExcluir && (
                        <button
                          onClick={() => handleExcluir(comentario.id)}
                          className="text-red-600 hover:text-red-700 p-2"
                          title="Excluir comentário"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {editando === comentario.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={textoEditado}
                        onChange={(e) => setTextoEditado(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 resize-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSalvarEdicao(comentario.id)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={handleCancelarEdicao}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {renderTextoComMencoes(comentario.texto)}
                    </div>
                  )}

                  {comentario.mencoes && comentario.mencoes.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <User size={12} />
                        <span>Mencionou: {comentario.mencoes.join(', ')}</span>
                      </div>
                    </div>
                  )}

                  {/* Botão Responder */}
                  {editando !== comentario.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => {
                          setRespondendo(respondendo === comentario.id ? null : comentario.id);
                          setTextoResposta('');
                        }}
                        className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium flex items-center gap-1 transition-colors"
                      >
                        <Reply size={14} />
                        {respondendo === comentario.id ? 'Cancelar resposta' : 'Responder'}
                      </button>
                    </div>
                  )}

                  {/* Campo de Resposta */}
                  {respondendo === comentario.id && (
                    <div className="mt-3 ml-4 p-3 bg-white dark:bg-gray-900 rounded-lg border-l-2 border-purple-500">
                      <MentionInput
                        value={textoResposta}
                        onChange={setTextoResposta}
                        usuarios={usuarios}
                        placeholder={`Respondendo para ${comentario.autor}...`}
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            e.preventDefault();
                            handleEnviarResposta(comentario.id);
                          }
                        }}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleEnviarResposta(comentario.id)}
                          disabled={!textoResposta.trim()}
                          className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Enviar Resposta
                        </button>
                        <button
                          onClick={() => {
                            setRespondendo(null);
                            setTextoResposta('');
                          }}
                          className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Respostas */}
                  {comentario.respostas && comentario.respostas.length > 0 && (
                    <div className="mt-4 ml-6 space-y-3 border-l-2 border-purple-200 dark:border-purple-800 pl-4">
                      {comentario.respostas.map((resposta: any) => {
                        const deptResp = departamentos.find((d) => d.id === resposta.departamentoId);
                        const tsResp = resposta.timestamp ? new Date(resposta.timestamp as any) : null;
                        const timestampRespLabel = tsResp && !Number.isNaN(tsResp.getTime()) ? tsResp.toLocaleString('pt-BR') : '';

                        return (
                          <div
                            key={resposta.id}
                            className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3"
                          >
                            <div className="flex items-start gap-2 mb-2">
                              <CornerDownRight size={14} className="text-purple-500 mt-1 flex-shrink-0" />
                              <div
                                className={`w-8 h-8 rounded-full bg-gradient-to-br ${
                                  deptResp?.cor || 'from-gray-400 to-gray-500'
                                } flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
                              >
                                {String(resposta.autor || 'V').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                  {resposta.autor}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {deptResp?.nome || '—'} • {timestampRespLabel}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap ml-10">
                              {renderTextoComMencoes(resposta.texto)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-800 rounded-b-2xl flex-shrink-0">
          <div className="space-y-3">
            <MentionInput
              value={comentarioAtual}
              onChange={setComentarioAtual}
              usuarios={usuarios}
              placeholder="Digite seu comentário... Use @ para mencionar usuários"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  e.preventDefault();
                  handleEnviar();
                }
              }}
            />

            <div className="flex items-center justify-between">

              <button
                onClick={handleEnviar}
                disabled={!comentarioAtual.trim()}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-medium flex items-center gap-2 transition-all"
              >
                <MessageSquare size={16} />
                Enviar Comentário
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
