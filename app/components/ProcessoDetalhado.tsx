'use client';

import React, { useState, useEffect } from 'react';
import {
  X, MessageSquare, FileText, Eye, CheckCircle, Clock, Calendar,
  User, AlertCircle, Tag, ArrowRight, Trash2, MoreVertical,
  Upload, Download, Edit, Flag, Zap, Activity, ArrowLeft, Layers
} from 'lucide-react';
import { Processo } from '@/app/types';
import HistoricoTimeline from './HistoricoTimeline';
import ChecklistFluxo from './ChecklistFluxo';
import { buscarHistorico } from '@/app/utils/auditoria';
import { verificarMencoesNaoLidasPorNotificacoes } from '@/app/utils/mentions';
import { useSistema } from '@/app/context/SistemaContext';

interface ProcessoDetalhadoProps {
  processo: Processo;
  departamentos?: any[];
  onClose: () => void;
  onVerCompleto?: () => void;
  onComentarios?: () => void;
  onQuestionario?: () => void;
  onDocumentos?: () => void;
  onAvancar?: () => void;
  onFinalizar?: () => void;
  onVoltar?: () => void;
}

export default function ProcessoDetalhado({
  processo,
  departamentos,
  onClose,
  onVerCompleto,
  onComentarios,
  onQuestionario,
  onDocumentos,
  onAvancar,
  onVoltar,
  onFinalizar,
}: ProcessoDetalhadoProps) {
  const { usuarioLogado, notificacoes } = useSistema();
  const [activeTab, setActiveTab] = useState('detalhes');
  const [historicoCompleto, setHistoricoCompleto] = useState<any[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [checklistData, setChecklistData] = useState<any[]>([]);

  // Carregar checklist para mostrar depts concluídos
  useEffect(() => {
    if (processo.deptIndependente && Array.isArray(processo.fluxoDepartamentos) && processo.fluxoDepartamentos.length > 1) {
      fetch(`/api/processos/${processo.id}/checklist`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : [])
        .then(data => setChecklistData(Array.isArray(data) ? data : []))
        .catch(() => setChecklistData([]));
    }
  }, [processo.id, processo.deptIndependente, processo.fluxoDepartamentos]);

  // Carregar histórico completo quando a aba for selecionada
  useEffect(() => {
    if (activeTab === 'historico' && historicoCompleto.length === 0) {
      setCarregandoHistorico(true);
      buscarHistorico(processo.id)
        .then((dados) => setHistoricoCompleto(dados))
        .catch((err) => console.error('Erro ao carregar histórico:', err))
        .finally(() => setCarregandoHistorico(false));
    }
  }, [activeTab, processo.id, historicoCompleto.length]);

  const historico = ((processo as any)?.historico || (processo as any)?.historicoEvento || []) as any[];
  const ultimasAtividades = Array.isArray(historico) ? historico.slice(0, 3) : [];
  const comentariosCount =
    typeof (processo as any)?.comentariosCount === 'number'
      ? (processo as any).comentariosCount
      : Array.isArray((processo as any)?.comentarios)
        ? (processo as any).comentarios.length
        : 0;
  const documentosCount =
    typeof (processo as any)?.documentosCount === 'number'
      ? (processo as any).documentosCount
      : Array.isArray((processo as any)?.documentos)
        ? (processo as any).documentos.length
        : typeof (processo as any)?._count?.documentos === 'number'
          ? (processo as any)._count.documentos
          : 0;
  const tagsMetadata = Array.isArray((processo as any)?.tagsMetadata) ? (processo as any).tagsMetadata : [];

  const nomeEmpresa = React.useMemo(() => {
    const nome = (processo as any).nomeEmpresa;
    if (typeof nome === 'string' && nome.trim()) return nome;

    const empresa = (processo as any).empresa;
    if (typeof empresa === 'string' && empresa.trim()) return empresa;
    if (empresa && typeof empresa === 'object') {
      const razao = (empresa as any).razao_social;
      const apelido = (empresa as any).apelido;
      const codigo = (empresa as any).codigo;
      if (typeof razao === 'string' && razao.trim()) return razao;
      if (typeof apelido === 'string' && apelido.trim()) return apelido;
      if (typeof codigo === 'string' && codigo.trim()) return codigo;
    }

    return 'Empresa não informada';
  }, [processo]);

  const formatarData = (data?: Date | string | null) => {
    if (!data) return 'N/A';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const inicio = (processo.dataInicio || processo.criadoEm) as any;
  const prazo = (processo.dataEntrega || (inicio ? (() => {
    const d = new Date(inicio);
    if (Number.isNaN(d.getTime())) return undefined;
    d.setDate(d.getDate() + 15);
    return d;
  })() : undefined)) as any;

  const statusCor = processo.status === 'finalizado' 
    ? 'bg-green-100 text-green-800' 
    : processo.status === 'pausado' 
    ? 'bg-red-100 text-red-800'
    : 'bg-blue-100 text-blue-800';

  const prioridadeCor = processo.prioridade === 'alta'
    ? 'bg-red-100 text-red-800'
    : processo.prioridade === 'media'
    ? 'bg-amber-100 text-amber-800'
    : 'bg-green-100 text-green-800';

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-8 text-white relative">
        {onVoltar && (Number(processo.departamentoAtualIndex ?? 0) > 0) && (
          <button
            onClick={onVoltar}
            className="absolute top-4 right-20 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-white rounded-lg font-semibold transition flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
        )}

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
        >
          <X size={24} />
        </button>

        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              {processo.nomeServico || processo.nome || 'Processo sem nome'}
            </h2>
            <p className="text-blue-100 flex items-center gap-2">
              <User size={16} />
              {nomeEmpresa}
            </p>
          </div>
        </div>

        {/* Tags Status */}
        <div className="flex items-center gap-3 flex-wrap mt-6">
          <span className={`px-4 py-2 rounded-full font-semibold text-sm ${statusCor} dark:bg-[var(--muted)] dark:text-[var(--fg)]`}>
            {processo.status === 'finalizado' ? '✓' : '⏱'} {processo.status}
          </span>
          <span className={`px-4 py-2 rounded-full font-semibold text-sm ${prioridadeCor} dark:bg-[var(--muted)] dark:text-[var(--fg)]`}>
            {processo.prioridade === 'alta' && '🔴'}
            {processo.prioridade === 'media' && '🟡'}
            {processo.prioridade === 'baixa' && '🟢'}
            {processo.prioridade?.toUpperCase()}
          </span>
          {tagsMetadata.length > 0
            ? tagsMetadata.map((tag: any) => (
                <span
                  key={tag.id}
                  className={`px-4 py-2 rounded-full font-semibold text-sm ${tag.cor || 'bg-purple-200'} ${tag.texto || 'text-purple-800'} dark:bg-[var(--muted)] dark:text-[var(--fg)]`}
                >
                  {tag.nome}
                </span>
              ))
            : (processo.tags || []).map((tagId) => (
                <span key={tagId} className="px-4 py-2 rounded-full font-semibold text-sm bg-purple-200 text-purple-800 dark:bg-[var(--muted)] dark:text-[var(--fg)]">
                  Tag #{tagId}
                </span>
              ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-8 space-y-8">
        {/* Abas */}
        <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('detalhes')}
            className={`pb-3 px-4 font-semibold transition border-b-2 ${
              activeTab === 'detalhes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📋 Detalhes
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className={`pb-3 px-4 font-semibold transition border-b-2 ${
              activeTab === 'historico'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🕒 Histórico Completo
          </button>
        </div>

        {/* Conteúdo das Abas */}
        {activeTab === 'detalhes' && (
          <>
            {/* Informações Principais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border-l-4 border-blue-500 pl-4">
                <p className="text-sm text-gray-600 mb-1">Cliente</p>
                <p className="font-bold text-gray-800">{nomeEmpresa}</p>
              </div>
              <div className="border-l-4 border-green-500 pl-4">
                <p className="text-sm text-gray-600 mb-1">Inicio</p>
                <p className="font-bold text-gray-800">{formatarData(inicio)}</p>
              </div>
              <div className="border-l-4 border-orange-500 pl-4">
                <p className="text-sm text-gray-600 mb-1">Prazo</p>
                <p className="font-bold text-gray-800">{formatarData(prazo)}</p>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center gap-3 flex-wrap bg-gray-50 dark:bg-[var(--muted)] p-6 rounded-xl">
              <button
                onClick={onVerCompleto}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition flex items-center gap-2"
              >
                <Eye size={18} />
                Ver Completo
              </button>
              <button
                onClick={onComentarios}
                className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold transition flex items-center gap-2 relative"
              >
                <MessageSquare size={18} />
                Comentários ({comentariosCount})
                {verificarMencoesNaoLidasPorNotificacoes(notificacoes as any, processo.id) && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                )}
              </button>
              <button
                onClick={onQuestionario}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition flex items-center gap-2"
              >
                <FileText size={18} />
                Ver Questionário
              </button>
              <button
                onClick={onDocumentos}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition flex items-center gap-2"
              >
                <Upload size={18} />
                Documentos ({documentosCount})
              </button>
              <button className="px-4 py-2 text-gray-600 hover:text-gray-800">
                <X size={20} />
              </button>
            </div>

            {/* Checklist por Departamento */}
            {processo.fluxoDepartamentos && Array.isArray(processo.fluxoDepartamentos) && processo.fluxoDepartamentos.length > 1 && (
              <div className="bg-gray-50 dark:bg-[var(--muted)] p-6 rounded-xl">
                <ChecklistFluxo
                  processoId={processo.id}
                  fluxoDepartamentos={processo.fluxoDepartamentos as number[]}
                  departamentos={departamentos || []}
                  departamentoAtual={processo.departamentoAtual}
                  deptIndependente={processo.deptIndependente}
                  dependenciasDept={(processo as any).dependenciasDept}
                  readOnly={processo.status === 'finalizado'}
                />
              </div>
            )}

            {/* Histórico de departamentos que deram check (paralelo) */}
            {processo.deptIndependente && checklistData.length > 0 && (() => {
              const fluxo: number[] = Array.isArray(processo.fluxoDepartamentos) ? processo.fluxoDepartamentos as number[] : [];
              const concluidos = checklistData
                .filter((c: any) => c.concluido)
                .sort((a: any, b: any) => fluxo.indexOf(a.departamentoId) - fluxo.indexOf(b.departamentoId));
              if (concluidos.length === 0) return null;
              return (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-5 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers size={18} className="text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                      Departamentos que deram Check ({concluidos.length}/{fluxo.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {concluidos.map((c: any) => {
                      const deptNome = (departamentos || []).find((d: any) => d.id === c.departamentoId)?.nome || `Dept #${c.departamentoId}`;
                      const ordem = fluxo.indexOf(c.departamentoId) + 1;
                      return (
                        <div key={c.departamentoId} className="flex items-center gap-3 bg-white dark:bg-gray-800 px-4 py-2.5 rounded-lg border border-emerald-100 dark:border-emerald-800">
                          <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {ordem}
                          </span>
                          <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{deptNome}</span>
                            {c.concluidoEm && (
                              <span className="text-xs text-gray-500 ml-2">
                                concluído {new Date(c.concluidoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {concluidos.length < fluxo.length && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-3">
                      ⏳ Aguardando {fluxo.length - concluidos.length} departamento(s) restante(s) para concluir.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Interligação */}
            {processo.interligadoComId && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
                  <span className="text-lg">🔗</span>
                  <span>Interligada com: <strong>{processo.interligadoNome || `#${processo.interligadoComId}`}</strong></span>
                </div>
              </div>
            )}

            {/* Últimas Atividades */}
            <div className="bg-gray-50 dark:bg-[var(--muted)] p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={20} className="text-orange-500" />
                <h3 className="font-bold text-gray-800 dark:text-[var(--fg)]">Últimas Atividades</h3>
              </div>
              <div className="space-y-4">
                {ultimasAtividades.length === 0 ? (
                  <div className="text-sm text-gray-500">Sem atividades registradas ainda.</div>
                ) : (
                  ultimasAtividades.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3">
                      {item.tipo === 'finalizacao' ? (
                        <CheckCircle size={18} className="text-green-500 mt-1 flex-shrink-0" />
                      ) : item.tipo === 'movimentacao' ? (
                        <ArrowRight size={18} className="text-blue-500 mt-1 flex-shrink-0" />
                      ) : item.tipo === 'documento' ? (
                        <FileText size={18} className="text-cyan-600 mt-1 flex-shrink-0" />
                      ) : item.tipo === 'comentario' ? (
                        <MessageSquare size={18} className="text-gray-600 mt-1 flex-shrink-0" />
                      ) : (
                        <Activity size={18} className="text-orange-500 mt-1 flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-[var(--fg)]">{item.acao}</p>
                        <p className="text-sm text-gray-500">
                          {(item.responsavel || '—') + (item.data ? ` • ${new Date(item.data).toLocaleString('pt-BR')}` : '')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'historico' && (
          <div className="bg-gray-50 dark:bg-[var(--muted)] p-6 rounded-xl max-h-[500px] overflow-y-auto">
            <div className="flex items-center gap-2 mb-6">
              <Activity size={24} className="text-blue-500" />
              <h3 className="font-bold text-gray-800 dark:text-[var(--fg)] text-xl">
                Histórico Completo de Auditoria
              </h3>
            </div>
            {carregandoHistorico ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-gray-500 mt-4">Carregando histórico...</p>
              </div>
            ) : (
              <HistoricoTimeline historico={historicoCompleto} />
            )}
          </div>
        )}

        {/* Botões de Ação Finais */}
        {processo.status !== 'finalizado' && (
          <div className="flex gap-3">
            {onVoltar && (Number(processo.departamentoAtualIndex ?? 0) > 0) && (
              <button
                onClick={onVoltar}
                className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-bold transition"
              >
                Voltar ao Departamento Anterior
              </button>
            )}
            <button
              onClick={onAvancar}
              className="flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition"
            >
              Avançar para Próximo
            </button>
            <button
              onClick={onFinalizar}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition"
            >
              Finalizar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
