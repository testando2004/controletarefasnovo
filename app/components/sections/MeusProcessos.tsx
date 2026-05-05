'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, ChevronRight, Inbox } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import { Processo } from '@/app/types';
import ProcessoCard from './ProcessoCard';

interface MeusProcessosProps {
  onProcessoClicado: (processo: Processo) => void;
  favoritosIds: Set<number>;
  onToggleFavorito: (processoId: number) => void;
  onExcluirProcesso: (processo: Processo) => void;
  onFinalizarProcesso: (id: number) => Promise<void>;
}

export default function MeusProcessos({
  onProcessoClicado,
  favoritosIds,
  onToggleFavorito,
  onExcluirProcesso,
  onFinalizarProcesso,
}: MeusProcessosProps) {
  const {
    processos,
    departamentos,
    usuarioLogado,
    tags,
    excluirProcesso,
    avancarParaProximoDepartamento,
    finalizarProcesso,
    mostrarConfirmacao,
    mostrarAlerta,
    adicionarNotificacao,
    showQuestionario,
    setShowQuestionario,
    showQuestionarioSolicitacao,
    setShowQuestionarioSolicitacao,
    showComentarios,
    setShowComentarios,
    showUploadDocumento,
    setShowUploadDocumento,
    showSelecionarTags,
    setShowSelecionarTags,
  } = useSistema();

  const [checklistCache, setChecklistCache] = useState<Map<number, Set<number>>>(new Map());

  const deptIdUsuario = useMemo(() => {
    if (!usuarioLogado) return null;
    const u = usuarioLogado as any;
    const parsed = Number(u.departamentoId ?? u.departamento_id);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [usuarioLogado]);

  const isAdmin =
    (usuarioLogado as any)?.role === 'admin' ||
    (usuarioLogado as any)?.role === 'admin_departamento';

  const meuDepartamento = useMemo(() => {
    if (!deptIdUsuario) return null;
    return departamentos.find((d: any) => d.id === deptIdUsuario) || null;
  }, [deptIdUsuario, departamentos]);

  const outrosDepartamentos = useMemo(() => {
    if (isAdmin) return departamentos;
    return departamentos.filter((d: any) => d.id !== deptIdUsuario);
  }, [departamentos, deptIdUsuario, isAdmin]);

  const processosParalelos = useMemo(
    () =>
      (processos || []).filter(
        (p: any) =>
          p.deptIndependente &&
          p.status === 'em_andamento' &&
          Array.isArray(p.fluxoDepartamentos) &&
          p.fluxoDepartamentos.length > 1
      ),
    [processos]
  );

  useEffect(() => {
    if (processosParalelos.length === 0) {
      setChecklistCache(new Map());
      return;
    }

    let cancelled = false;

    (async () => {
      const novoCache = new Map<number, Set<number>>();

      await Promise.all(
        processosParalelos.map(async (processo: any) => {
          try {
            const res = await fetch(`/api/processos/${processo.id}/checklist`, {
              credentials: 'include',
            });
            if (!res.ok) return;

            const data = await res.json();
            const concluidos = new Set<number>();
            (Array.isArray(data) ? data : []).forEach((item: any) => {
              if (item.concluido) concluidos.add(Number(item.departamentoId));
            });
            novoCache.set(Number(processo.id), concluidos);
          } catch {
            // silencioso
          }
        })
      );

      if (!cancelled) setChecklistCache(novoCache);
    })();

    return () => {
      cancelled = true;
    };
  }, [processosParalelos]);

  const getProcessosDoDept = (deptId: number) => {
    return (processos || []).filter((p: any) => {
      if (p.status !== 'em_andamento') return false;

      if (
        p.deptIndependente &&
        Array.isArray(p.fluxoDepartamentos) &&
        p.fluxoDepartamentos.length > 1
      ) {
        const estaNeste = p.fluxoDepartamentos.some((id: any) => Number(id) === Number(deptId));
        if (!estaNeste) return false;
        const concluidos = checklistCache.get(Number(p.id));
        if (concluidos?.has(Number(deptId))) return false;
        return true;
      }

      return p.departamentoAtual === deptId;
    });
  };

  const handleQuestionario = (processo: Processo, deptId: number) => {
    setShowQuestionario({ processoId: processo.id, departamento: deptId });
  };

  const handleDocumentos = (processo: Processo) => {
    setShowUploadDocumento(processo);
  };

  const handleComentarios = (processo: Processo) => {
    setShowComentarios(processo.id);
  };

  const handleTags = (processo: Processo) => {
    setShowSelecionarTags(processo);
  };

  const handleAvancarParalelo = async (processoId: number, deptId: number) => {
    const processo = processos.find((p: any) => p.id === processoId);
    if (!processo) return;

    const nomeDept = departamentos.find((d: any) => d.id === deptId)?.nome || `Dept #${deptId}`;
    const confirmado = await mostrarConfirmacao({
      titulo: 'Confirmar conclusão',
      mensagem: `Deseja realmente concluir o departamento "${nomeDept}" e prosseguir?`,
      tipo: 'aviso',
      textoConfirmar: 'Sim, concluir',
      textoCancelar: 'Cancelar',
    });
    if (!confirmado) return;

    const checklistConcluido = checklistCache.get(Number(processoId));
    const jaFez = checklistConcluido?.has(Number(deptId)) ?? false;

    if (jaFez) return;

    try {
      const fluxo = Array.isArray((processo as any).fluxoDepartamentos)
        ? (processo as any).fluxoDepartamentos.map(Number)
        : [];

      const res = await fetch(`/api/processos/${processoId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          departamentoId: Number(deptId),
          concluido: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao concluir departamento' }));
        const detalhes = Array.isArray(err?.detalhes) && err.detalhes.length > 0
          ? `\n\n${err.detalhes.join('\n')}`
          : '';
        await mostrarAlerta(
          String(err?.error || '').toLowerCase().includes('obrigat') ? 'Campos obrigatorios' : 'Erro',
          `${err.error || 'Erro ao concluir departamento'}${detalhes}`,
          String(err?.error || '').toLowerCase().includes('obrigat') ? 'aviso' : 'erro'
        );
        return;
      }

      setChecklistCache((prev) => {
        const next = new Map(prev);
        const concluidos = new Set(next.get(Number(processoId)) || []);
        concluidos.add(Number(deptId));
        next.set(Number(processoId), concluidos);
        return next;
      });

      adicionarNotificacao('Departamento concluido com sucesso', 'sucesso');

      const concluidosAtualizados = new Set(checklistConcluido || []);
      concluidosAtualizados.add(Number(deptId));
      const todosConcluiram =
        fluxo.length > 0 &&
        fluxo.every((departamentoFluxoId: number) => concluidosAtualizados.has(Number(departamentoFluxoId)));

      if (todosConcluiram) {
        if (onFinalizarProcesso) {
          await onFinalizarProcesso(processoId);
        } else {
          await finalizarProcesso(processoId);
        }
      }
    } catch {
      await mostrarAlerta('Erro', 'Nao foi possivel concluir o departamento.', 'erro');
    }
  };

  const getCorDept = (dept: any) => {
    return typeof dept.cor === 'string' ? dept.cor : 'from-blue-500 to-blue-600';
  };

  const renderDeptSection = (dept: any, isMeu: boolean) => {
    const processosNoDept = getProcessosDoDept(dept.id);
    const corFundo = getCorDept(dept);

    return (
      <div
        key={dept.id}
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden ${
          isMeu ? '' : ''
        }`}
      >
        <div className={`bg-gradient-to-br ${corFundo} p-5 sm:p-6 text-white relative`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white bg-opacity-20">
                <Briefcase size={20} />
              </div>
              <div>
                <h3 className={`font-bold text-white ${isMeu ? 'text-xl' : 'text-lg'}`}>
                  {dept.nome}
                </h3>
                <p className="text-sm text-white/80">
                  {processosNoDept.length} processo{processosNoDept.length !== 1 ? 's' : ''} pendente{processosNoDept.length !== 1 ? 's' : ''}
                  {isMeu && <span className="ml-2 bg-white/25 px-2 py-0.5 rounded-full text-xs font-semibold">Meu Departamento</span>}
                </p>
              </div>
            </div>
            <div className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-bold">
              {processosNoDept.length}
            </div>
          </div>
        </div>

        <div className={`p-4 sm:p-6 ${isMeu ? 'space-y-4' : 'space-y-3'}`}>
          {processosNoDept.length === 0 ? (
            <div className="text-center py-8">
              <Inbox size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-400 dark:text-gray-500 font-medium">Nenhum processo pendente</p>
              <p className="text-gray-300 dark:text-gray-600 text-sm">Todos os processos foram concluidos neste departamento</p>
            </div>
          ) : (
            processosNoDept.map((processo: any) => (
              <ProcessoCard
                key={processo.id}
                processo={processo}
                departamento={dept}
                onQuestionario={(p) => handleQuestionario(p, dept.id)}
                onDocumentos={handleDocumentos}
                onComentarios={handleComentarios}
                onTags={handleTags}
                onExcluir={async (id: number) => {
                  if (onExcluirProcesso) {
                    onExcluirProcesso(processo);
                  } else {
                    const ok = await mostrarConfirmacao({
                      titulo: 'Excluir Processo',
                      mensagem: 'Tem certeza que deseja excluir este processo?\n\nEssa acao nao podera ser desfeita.',
                      tipo: 'perigo',
                      textoConfirmar: 'Sim, Excluir',
                      textoCancelar: 'Cancelar',
                    });
                    if (ok) excluirProcesso(id);
                  }
                }}
                onAvancar={async (id: number) => {
                  if (processo.deptIndependente) {
                    await handleAvancarParalelo(id, dept.id);
                  } else {
                    await avancarParaProximoDepartamento(id);
                  }
                }}
                onFinalizar={(id: number) => {
                  if (onFinalizarProcesso) {
                    return onFinalizarProcesso(id);
                  }
                  finalizarProcesso(id);
                  return Promise.resolve();
                }}
                onVerDetalhes={onProcessoClicado}
                favoritosIds={favoritosIds}
                onToggleFavorito={onToggleFavorito}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl">
            <Briefcase className="text-white" size={24} />
          </div>
          Meus Processos
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {meuDepartamento
            ? `Foco nos processos do departamento ${meuDepartamento.nome}`
            : isAdmin
              ? 'Visao completa de todos os departamentos'
              : 'Processos pendentes para voce finalizar'}
        </p>
      </div>

      {meuDepartamento && (
        <div>
          {renderDeptSection(meuDepartamento, true)}
        </div>
      )}

      {outrosDepartamentos.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <ChevronRight size={20} className="text-gray-400" />
            {meuDepartamento ? 'Outros Departamentos' : 'Todos os Departamentos'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {outrosDepartamentos.map((dept: any) => renderDeptSection(dept, false))}
          </div>
        </div>
      )}

      {isAdmin && !meuDepartamento && departamentos.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-lg border border-gray-100 dark:border-gray-700">
          <Inbox size={64} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Nenhum departamento criado</h3>
          <p className="text-gray-500 dark:text-gray-400">Crie departamentos no Dashboard para comecar a gerenciar processos</p>
        </div>
      )}
    </div>
  );
}
