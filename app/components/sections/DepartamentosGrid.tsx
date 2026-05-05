// app/components/sections/DepartamentosGrid.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Building, User, Plus, MoreVertical, Edit, Trash2, Eye, FileText, Users, Calculator, FileCheck, Briefcase, Headphones, Scale, CheckCircle, Building2, Landmark, ShieldCheck, Truck, Package, Heart, Wallet, CreditCard, BarChart3, PieChart, Settings, Wrench, Globe, Mail, Phone, MessageSquare, Clipboard, FolderOpen, Archive, BookOpen, GraduationCap, Award, Target, Flag, Zap, Star, ChevronLeft, ChevronRight, ArrowLeftRight, Upload } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import { api } from '@/app/utils/api';
import { useDragDrop } from '@/app/hooks/useDragDrop';
import { temPermissao } from '@/app/utils/permissions';
import { Processo } from '@/app/types';
import ProcessoCard from './ProcessoCard';

// Mapeamento de nomes de Ã­cones para componentes
const iconMap: Record<string, any> = {
  FileText,
  Users,
  Calculator,
  FileCheck,
  Briefcase,
  Headphones,
  Scale,
  CheckCircle,
  Edit,
  Building, 
  Building2,
  Landmark,
  ShieldCheck,
  Truck,
  Package,
  Heart,
  Wallet,
  CreditCard,
  BarChart3,
  PieChart,
  Settings,
  Wrench,
  Globe,
  Mail,
  Phone,
  MessageSquare,
  Clipboard,
  FolderOpen,
  Archive,
  BookOpen,
  GraduationCap,
  Award,
  Target,
  Flag,
  Zap,
  Star,
};

const REPOSITORIO_DOCS_MARKER_PREFIX = '__repositorio_docs_departamento__:';

interface DepartamentosGridProps {
  onCriarDepartamento: () => void;
  onEditarDepartamento: (dept: any) => void;
  onExcluirDepartamento: (dept: any) => void;
  onProcessoClicado: (processo: any) => void;
  onGaleria: (dept: any) => void;
  favoritosIds?: Set<number>;
  onToggleFavorito?: (processoId: number) => void;
  onExcluirProcesso?: (processo: any) => void;
  onFinalizarProcesso?: (processoId: number) => Promise<void>;
}

export default function DepartamentosGrid({
  onCriarDepartamento,
  onEditarDepartamento,
  onExcluirDepartamento,
  onProcessoClicado,
  onGaleria,
  favoritosIds,
  onToggleFavorito,
  onExcluirProcesso,
  onFinalizarProcesso,
}: DepartamentosGridProps) {
  const {
    departamentos,
    setDepartamentos,
    setProcessos,
    processos,
    usuarioLogado,
    setShowQuestionario,
    setShowUploadDocumento,
    setShowComentarios,
    setShowSelecionarTags,
    excluirProcesso,
    avancarParaProximoDepartamento,
    finalizarProcesso,
    mostrarConfirmacao,
    mostrarAlerta,
    adicionarNotificacao,
  } = useSistema();

  const { handleDragStart, handleDragOver, handleDrop, handleDragEnd, dragState } = useDragDrop();
  const [dragOverDept, setDragOverDept] = useState<number | null>(null);
  const [menuDeptAberto, setMenuDeptAberto] = useState<number | null>(null);
  const [movendo, setMovendo] = useState(false);
  const [modoReordenar, setModoReordenar] = useState(false);

  // Checklist cache para processos deptIndependente
  // Mapa: processoId -> Set<deptId> (departamentos jÃ¡ concluÃ­dos)
  const [checklistCache, setChecklistCache] = useState<Map<number, Set<number>>>(new Map());

  // Buscar checklist para processos com deptIndependente
  const processosParalelos = (processos || []).filter(
    (p: any) => p.deptIndependente && p.status === 'em_andamento' && Array.isArray(p.fluxoDepartamentos) && p.fluxoDepartamentos.length > 1
  );

  useEffect(() => {
    if (processosParalelos.length === 0) return;
    let cancelled = false;
    (async () => {
      const novoCache = new Map<number, Set<number>>();
      await Promise.all(
        processosParalelos.map(async (p: any) => {
          try {
            const res = await fetch(`/api/processos/${p.id}/checklist`, { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            const concluidos = new Set<number>();
            (Array.isArray(data) ? data : []).forEach((item: any) => {
              if (item.concluido) concluidos.add(Number(item.departamentoId));
            });
            novoCache.set(p.id, concluidos);
          } catch { /* silencioso */ }
        })
      );
      if (!cancelled) setChecklistCache(novoCache);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processosParalelos.map(p => p.id).join(',')]);

  const isAdmin = usuarioLogado?.role === 'admin' || usuarioLogado?.role === 'admin_departamento';
  const isUsuarioNormal = usuarioLogado?.role === 'usuario';
  const podeEditarDepartamento = temPermissao(usuarioLogado, 'editar_departamento');
  const podeExcluirDepartamento = temPermissao(usuarioLogado, 'excluir_departamento');

  const departamentoUsuarioRaw =
    (usuarioLogado as any)?.departamentoId ?? (usuarioLogado as any)?.departamento_id;
  const departamentoUsuarioParsed = Number(departamentoUsuarioRaw);
  const departamentoUsuario =
    Number.isFinite(departamentoUsuarioParsed) && departamentoUsuarioParsed > 0
      ? departamentoUsuarioParsed
      : undefined;

  const handleQuestionario = (processo: any, deptIdOverride?: number) => {
    // Para processos paralelos (deptIndependente), usar o dept da coluna onde o card estÃ¡,
    // nÃ£o o departamentoAtual (que pode ser o 1Âº dept do fluxo)
    const deptId = deptIdOverride ?? processo.departamentoAtual;
    setShowQuestionario({
      processoId: processo.id,
      departamento: deptId,
    });
  };

  const handleDocumentos = (processo: any) => {
    setShowUploadDocumento(processo);
  };

  const podeAdicionarDocumentoNoDept = (deptId: number) => {
    if (!usuarioLogado) return false;
    // Usuario normal so pode anexar no proprio departamento.
    if (String(usuarioLogado.role).toLowerCase() === 'usuario') {
      return typeof departamentoUsuario === 'number' && Number(departamentoUsuario) === Number(deptId);
    }
    return true;
  };

  const getRepositorioDocsMarker = (deptId: number) => `${REPOSITORIO_DOCS_MARKER_PREFIX}${deptId}`;

  const isProcessoRepositorioDocs = (processo: any, deptId: number) =>
    String((processo as any)?.notasCriador || '').trim() === getRepositorioDocsMarker(deptId);

  const handleAdicionarDocumentoDepartamento = async (dept: any, _processosDept: any[]) => {
    const deptId = Number(dept?.id);
    if (!Number.isFinite(deptId) || deptId <= 0) {
      await mostrarAlerta?.('Erro', 'Departamento invalido para envio de documento.', 'erro');
      return;
    }

    let processoAlvo = processos.find((p: any) => isProcessoRepositorioDocs(p, deptId)) || null;

    if (!processoAlvo) {
      try {
        const marcador = getRepositorioDocsMarker(deptId);
        const nomeDept = typeof dept?.nome === 'string' && dept.nome.trim() ? dept.nome.trim() : `Departamento ${deptId}`;

        processoAlvo = await api.salvarProcesso({
          nome: `Repositorio de Documentos - ${nomeDept}`,
          nomeServico: 'Repositorio de Documentos',
          nomeEmpresa: `Documentos ${nomeDept}`,
          cliente: 'Sistema',
          status: 'FINALIZADO',
          prioridade: 'BAIXA',
          departamentoAtual: deptId,
          departamentoAtualIndex: 0,
          fluxoDepartamentos: [deptId],
          notasCriador: marcador,
          descricao: 'Processo tecnico para anexos de departamento sem cards ativos.',
        });

        const novoProcesso = processoAlvo;
        setProcessos((prev: any[]) => {
          if (!novoProcesso || prev.some((p: any) => Number(p.id) === Number(novoProcesso.id))) return prev;
          return [novoProcesso as any, ...prev];
        });
      } catch (err: any) {
        await mostrarAlerta?.(
          'Erro',
          err?.message || 'Nao foi possivel preparar o envio de documento para este departamento.',
          'erro'
        );
        return;
      }
    }

    setShowUploadDocumento({
      id: Number((processoAlvo as any).id),
      departamentoId: deptId,
      nomeEmpresa: (processoAlvo as any).nomeEmpresa,
      nomeServico: (processoAlvo as any).nomeServico,
    });
  };

  // Handler para "AvanÃ§ar" em processos paralelos (deptIndependente)
  // Marca o departamento como concluÃ­do no checklist, removendo o card da coluna
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

    const fluxo = (processo.fluxoDepartamentos || []).map(Number);
    const idxDept = fluxo.indexOf(Number(deptId));

    // Espelha a lógica do backend (app/api/processos/[id]/checklist/route.ts):
    // se houver dependências customizadas configuradas, usa a regra de dependências;
    // caso contrário, cai na regra sequencial padrão.
    const dependenciasDept: Record<string, any> =
      (processo as any)?.dependenciasDept && typeof (processo as any).dependenciasDept === 'object'
        ? (processo as any).dependenciasDept
        : {};
    const temDependenciasCustomizadas = Object.keys(dependenciasDept).length > 0;

    if (temDependenciasCustomizadas) {
      // Calcula a chave da etapa atual (deptId ou deptId:ocorrencia) — igual ao backend.
      let ocorrencia = 0;
      for (let i = 0; i <= idxDept; i++) if (fluxo[i] === Number(deptId)) ocorrencia++;
      const chaveAtual = ocorrencia <= 1 ? String(deptId) : `${deptId}:${ocorrencia}`;

      const deps = Array.isArray(dependenciasDept[chaveAtual])
        ? dependenciasDept[chaveAtual]
        : Array.isArray(dependenciasDept[String(deptId)])
          ? dependenciasDept[String(deptId)]
          : [];

      if (deps.length > 0) {
        const concluidos = checklistCache.get(processoId);
        for (const depChave of deps) {
          const depDeptId = Number(String(depChave).split(':')[0]);
          if (!Number.isFinite(depDeptId)) continue;
          if (!concluidos || !concluidos.has(depDeptId)) {
            const nomeDep = departamentos.find((d: any) => d.id === depDeptId)?.nome || `Dept #${depDeptId}`;
            void mostrarAlerta?.('Dependência pendente', `"${nomeDep}" precisa dar check primeiro.`, 'aviso');
            return;
          }
        }
      }
      // Se não há deps listadas para esta etapa → livre (sem pré-check).
    } else if (idxDept > 0) {
      // Sem dependências customizadas: regra sequencial padrão.
      const deptAnterior = fluxo[idxDept - 1];
      const concluidos = checklistCache.get(processoId);
      if (!concluidos || !concluidos.has(deptAnterior)) {
        const nomeAnterior = departamentos.find((d: any) => d.id === deptAnterior)?.nome || `Dept #${deptAnterior}`;
        void mostrarAlerta?.('Ordem sequencial', `O departamento "${nomeAnterior}" precisa concluir primeiro antes que este possa avançar.`, 'aviso');
        return;
      }
    }

    // ============================================
    // VALIDAÃ‡ÃƒO DE PERGUNTAS OBRIGATÃ“RIAS DO DEPT
    // ============================================
    if (!isAdmin) {
      try {
        // Buscar processo atualizado para ter respostas e questionÃ¡rios frescos
      const processoAtualizado = await api.getProcesso(processoId).catch(() => null);
      const pDados = processoAtualizado ?? processo;

      const questionariosDoDept =
        (pDados.questionariosPorDepartamento && (pDados.questionariosPorDepartamento[String(deptId)] ?? pDados.questionariosPorDepartamento[deptId])) || [];

      const respostasSalvas = ((pDados.respostasHistorico as any)?.[deptId]?.respostas) || {};
      const docs = Array.isArray(pDados.documentos) ? pDados.documentos : [];

      const avaliarCondicaoLocal = (pergunta: any, respostasAtuais: Record<string, any>) => {
        if (!pergunta || !pergunta.condicao) return true;
        const { perguntaId, operador, valor } = pergunta.condicao;
        const respostaCond = respostasAtuais[String(perguntaId)];
        if (respostaCond === undefined || respostaCond === null || respostaCond === '') return false;
        const r = String(respostaCond).trim().toLowerCase();
        const v = String(valor).trim().toLowerCase();
        switch (operador) {
          case 'igual': return r === v;
          case 'diferente': return r !== v;
          case 'contem': return r.includes(v);
          default: return true;
        }
      };

      const faltando = (Array.isArray(questionariosDoDept) ? questionariosDoDept : [])
        .filter((p: any) => p && p.obrigatorio)
        .filter((p: any) => {
          if (!avaliarCondicaoLocal(p, respostasSalvas)) return false;
          if (p.tipo === 'file') {
            const anexosVisiveis = docs.filter((d: any) => {
              const dPerg = Number(d?.perguntaId ?? d?.pergunta_id);
              if (dPerg !== Number(p.id)) return false;
              const dDeptRaw = d?.departamentoId ?? d?.departamento_id;
              const dDept = Number(dDeptRaw);
              if (!Number.isFinite(dDept)) return true;
              return dDept === Number(deptId);
            });
            if (anexosVisiveis.length > 0) return false;
            const counts: Record<string, number> = (pDados as any)?.documentosCounts ?? {};
            const keySpecific = `${Number(p.id)}:${Number(deptId)}`;
            const keyAny = `${Number(p.id)}:0`;
            const total = Number(counts[keySpecific] ?? counts[keyAny] ?? 0);
            return total === 0;
          }
          const r = respostasSalvas[String(p.id)];
          if (r === null || r === undefined) return true;
          if (typeof r === 'string' && !r.trim()) return true;
          return false;
        });

      if (faltando.length > 0) {
        const nomes = faltando.map((p: any) => p.label).join(', ');
        const nomeDept = departamentos.find((d: any) => d.id === deptId)?.nome || `Dept #${deptId}`;
        void mostrarAlerta?.('Campos obrigatórios', `Preencha os campos obrigatórios do departamento "${nomeDept}" antes de concluir:\n\n${nomes}`, 'aviso');
        return;
      }
      } catch (err) {
        console.warn('Validação de questionário paralelo falhou:', err);
      }
    }

    try {
      // Marcar o departamento como concluÃ­do via API de checklist
      const res = await fetch(`/api/processos/${processoId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ departamentoId: deptId, concluido: true }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao concluir' }));
        const detalhes = Array.isArray(err?.detalhes) && err.detalhes.length > 0
          ? `\n\n${err.detalhes.join('\n')}`
          : '';
        const titulo = String(err?.error || '').toLowerCase().includes('obrigat')
          ? 'Campos obrigatórios'
          : 'Erro';
        void mostrarAlerta?.(titulo, `${err.error || 'Erro ao concluir departamento'}${detalhes}`, titulo === 'Erro' ? 'erro' : 'aviso');
        return;
      }

      // Atualizar cache local imediatamente (UI otimista)
      setChecklistCache(prev => {
        const next = new Map(prev);
        const set = new Set(prev.get(processoId) || []);
        set.add(Number(deptId));
        next.set(processoId, set);
        return next;
      });

      const nomeDepto = departamentos.find((d: any) => d.id === deptId)?.nome || `Dept #${deptId}`;
      adicionarNotificacao(`Departamento "${nomeDepto}" concluiu sua parte`, 'sucesso');

      // Se todos os depts do fluxo concluÃ­ram, finalizar o processo
      const concluidosAtualizado = new Set(checklistCache.get(processoId) || []);
      concluidosAtualizado.add(Number(deptId));
      const todosConcluiram = fluxo.every((id: number) => concluidosAtualizado.has(id));
      if (todosConcluiram) {
        adicionarNotificacao('Todos os departamentos concluíram! Processo finalizado.', 'sucesso');
        // Usar onFinalizarProcesso (que trata interligaÃ§Ã£o) se disponÃ­vel
        if (onFinalizarProcesso) {
          await onFinalizarProcesso(processoId);
        } else {
          await finalizarProcesso(processoId);
        }
      }
    } catch (err: any) {
      void mostrarAlerta?.('Erro', err.message || 'Erro ao avançar', 'erro');
    }
  };

  const handleComentarios = (processo: any) => {
    setShowComentarios(processo.id);
  };

  const handleTags = (processo: any) => {
    setShowSelecionarTags(processo);
  };

  const moverDepartamento = async (deptId: number, direcao: 'esquerda' | 'direita') => {
    if (movendo) return;
    setMovendo(true);
    try {
      // Montar lista ordenada atual (mesma lÃ³gica do sort do render)
      const ordenados = [...departamentos].sort((a, b) => {
        const oA = typeof (a as any).ordem === 'number' ? (a as any).ordem : 9999;
        const oB = typeof (b as any).ordem === 'number' ? (b as any).ordem : 9999;
        if (oA !== oB) return oA - oB;
        return a.id - b.id;
      });

      const idx = ordenados.findIndex((d) => d.id === deptId);
      if (idx === -1) return;

      const swapIdx = direcao === 'esquerda' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= ordenados.length) return;

  
      const ordensNormalizadas: Record<number, number> = {};
      ordenados.forEach((d, i) => {
        ordensNormalizadas[d.id] = i;
      });

      // Trocar as posiÃ§Ãµes
      const novaOrdemMovido = ordensNormalizadas[ordenados[swapIdx].id]; // pega posiÃ§Ã£o do outro
      const novaOrdemOutro = ordensNormalizadas[ordenados[idx].id];     // pega posiÃ§Ã£o do movido

      // Atualizar localmente para feedback imediato
      setDepartamentos((prev) =>
        prev.map((d) => {
          if (d.id === ordenados[idx].id) return { ...d, ordem: novaOrdemMovido } as any;
          if (d.id === ordenados[swapIdx].id) return { ...d, ordem: novaOrdemOutro } as any;
          // Normalizar todos os outros tambÃ©m para evitar conflitos futuros
          if (ordensNormalizadas[d.id] !== undefined) return { ...d, ordem: ordensNormalizadas[d.id] } as any;
          return d;
        })
      );

      // Persistir TODOS os departamentos com ordens normalizadas + swap
      const updates = ordenados.map((d, i) => {
        let novaOrdem = i;
        if (d.id === ordenados[idx].id) novaOrdem = novaOrdemMovido;
        else if (d.id === ordenados[swapIdx].id) novaOrdem = novaOrdemOutro;
        return api.atualizarDepartamento(d.id, { ordem: novaOrdem });
      });
      await Promise.all(updates);
    } catch (err) {
      console.error('Erro ao mover departamento:', err);
      // Recarregar para corrigir estado
      const dados = await api.getDepartamentos();
      setDepartamentos(dados || []);
    } finally {
      setMovendo(false);
    }
  };

  if (departamentos.length === 0) {
    return (
      <div className="col-span-full text-center py-12">
        <Building size={64} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          Nenhum departamento criado
        </h3>
        <p className="text-gray-600 mb-6">
          Crie seu primeiro departamento para começar a gerenciar processos
        </p>
        <button
          onClick={onCriarDepartamento}
          className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-xl font-medium inline-flex items-center gap-2"
        >
          <Plus size={20} />
          Criar Primeiro Departamento
        </button>
      </div>
    );
  }

  const getOrdemValue = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const asNumber = Number(trimmed);
      if (Number.isFinite(asNumber)) return asNumber;
    }
    return undefined;
  };

  // Ordenar departamentos pelo campo ordem (ou id como fallback)
  const departamentosOrdenados = [...departamentos].sort((a, b) => {
    const ordemA = getOrdemValue((a as any)?.ordem);
    const ordemB = getOrdemValue((b as any)?.ordem);

    if (typeof ordemA === 'number' && typeof ordemB === 'number') {
      const diff = ordemA - ordemB;
      if (diff !== 0) return diff;
      // Tie-break determinÃ­stico: evita â€œtrocar de lugarâ€ quando a ordem empata
      return a.id - b.id;
    }
    if (typeof ordemA === 'number') return -1;
    if (typeof ordemB === 'number') return 1;
    return a.id - b.id;
  });

  return (
    <>
      {/* BotÃ£o de reordenar departamentos (apenas admin) */}
      {isAdmin && departamentosOrdenados.length > 1 && (
        <div className="col-span-full mb-2 flex w-full justify-start sm:justify-end">
          <button
            type="button"
            onClick={() => setModoReordenar((prev) => !prev)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              modoReordenar
                ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ArrowLeftRight size={16} />
            {modoReordenar ? 'Concluir Reordenação' : 'Reordenar Departamentos'}
          </button>
        </div>
      )}

      {departamentosOrdenados.map((dept, posicao) => {
        const processosNoDept = processos.filter((p) => {
          if (p.status !== 'em_andamento') return false;

          // Fluxo paralelo (deptIndependente): usa APENAS a lÃ³gica de checklist
          // Processo aparece em TODOS os depts do fluxo, EXCETO nos que jÃ¡ concluÃ­ram
          if (
            p.deptIndependente &&
            Array.isArray(p.fluxoDepartamentos) &&
            p.fluxoDepartamentos.length > 1
          ) {
            const estaNeste = p.fluxoDepartamentos.some((id: any) => Number(id) === Number(dept.id));
            if (!estaNeste) return false;
            const concluidos = checklistCache.get(p.id);
            if (concluidos && concluidos.has(Number(dept.id))) return false; // jÃ¡ deu check â†’ some
            return true;
          }

          // Fluxo normal: processo estÃ¡ no departamento atual
          if (p.departamentoAtual === dept.id) return true;

          return false;
        });

        // Usar cor configurada no departamento; fallback azul
        const corFundo = typeof dept.cor === 'string' ? dept.cor : 'from-blue-500 to-blue-600';
        const corTexto = 'text-white';
        const isFirst = posicao === 0;
        const isLast = posicao === departamentosOrdenados.length - 1;
        const podeAdicionarDocumentoMenu = podeAdicionarDocumentoNoDept(Number(dept.id));
        const mostrarMenuDepartamento =
          Boolean(podeAdicionarDocumentoMenu) ||
          Boolean(podeEditarDepartamento) ||
          Boolean(podeExcluirDepartamento);

        return (
          <div key={dept.id} className="relative w-full min-w-0">
            {/* Setas de reordenaÃ§Ã£o */}
            {modoReordenar && isAdmin && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <button
                  type="button"
                  disabled={isFirst || movendo}
                  onClick={() => moverDepartamento(dept.id, 'esquerda')}
                  className={`p-1.5 rounded-lg transition-all ${
                    isFirst || movendo
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                  title="Mover para esquerda"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-xs font-semibold text-gray-400 select-none">
                  {posicao + 1}º
                </span>
                <button
                  type="button"
                  disabled={isLast || movendo}
                  onClick={() => moverDepartamento(dept.id, 'direita')}
                  className={`p-1.5 rounded-lg transition-all ${
                    isLast || movendo
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                  title="Mover para direita"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}

            <div className={`bg-white rounded-2xl shadow-lg border-2 transition-all duration-300 min-h-[460px] sm:min-h-[600px] ${
              modoReordenar ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-100 hover:border-gray-200'
            }`}>
              {/* Header do Departamento */}
              <div
                className={`relative overflow-visible rounded-t-2xl bg-gradient-to-br ${corFundo} p-4 ${corTexto} sm:p-6`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-white bg-opacity-20`}>
                        {(() => {
                          let IconeComponent: any = Building; // fallback
                          
                          if (typeof dept.icone === 'string') {
                            // Se for string, busca no mapeamento
                            IconeComponent = iconMap[dept.icone] || Building;
                          } else if (typeof dept.icone === 'function') {
                            // Se for funÃ§Ã£o/componente, usa diretamente
                            IconeComponent = dept.icone;
                          }
                          
                          return <IconeComponent size={20} className={corTexto} />;
                        })()}
                      </div>
                      <h3
                        className="font-bold text-lg break-words line-clamp-2 cursor-help flex-1"
                        title={dept.nome}
                      >
                        {dept.nome}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 text-sm opacity-95">
                      <User size={14} />
                      <span className="break-words line-clamp-1" title={dept.responsavel}>
                        {dept.responsavel || 'Sem responsável'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {mostrarMenuDepartamento && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMenuDeptAberto((prev) => (prev === dept.id ? null : dept.id))}
                          className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-all"
                          title="Menu"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {menuDeptAberto === dept.id && (
                          <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                            {podeAdicionarDocumentoMenu && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuDeptAberto(null);
                                  void handleAdicionarDocumentoDepartamento(dept, processosNoDept);
                                }}
                                className="w-full px-3 py-2 text-sm text-cyan-700 hover:bg-cyan-50 flex items-center gap-2"
                              >
                                <Upload size={16} className="text-cyan-600" />
                                Enviar documento
                              </button>
                            )}
                            {podeEditarDepartamento && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuDeptAberto(null);
                                  onEditarDepartamento(dept);
                                }}
                                className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Edit size={16} className="text-gray-500" />
                                Editar
                              </button>
                            )}
                            {podeExcluirDepartamento && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuDeptAberto(null);
                                  onExcluirDepartamento(dept);
                                }}
                                className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 size={16} className="text-red-500" />
                                Excluir
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => onGaleria(dept)}
                      className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-all"
                      title="Galeria de Documentos"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Corpo do Departamento com Processos */}
              <div 
                className={`min-h-[320px] rounded-xl bg-white p-4 transition-all duration-200 sm:min-h-[400px] sm:p-6 ${
                  dragOverDept === dept.id && dragState.draggedItem
                    ? 'bg-blue-50 border-2 border-blue-300'
                    : ''
                }`}
                onDragOver={(e) => {
                  handleDragOver(
                    e,
                    dragState.draggedItem,
                    dept.id
                  );
                  setDragOverDept(dept.id);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragOverDept(null);
                }}
                onDrop={(e) => {
                  handleDrop(e, dept.id, async (processoId: number) => {
                    await avancarParaProximoDepartamento(processoId);
                  });
                  setDragOverDept(null);
                }}
              >
                <div className="space-y-4">
                  {processosNoDept.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <div className={`w-16 h-16 rounded-lg mx-auto mb-3 bg-gradient-to-br ${corFundo} flex items-center justify-center`}>
                        {(() => {
                          let IconeComponent = Building; // fallback
                          
                          if (typeof dept.icone === 'string') {
                            IconeComponent = iconMap[dept.icone] || Building;
                          } else if (typeof dept.icone === 'function') {
                            IconeComponent = dept.icone as any;
                          }
                          
                          return <IconeComponent size={24} className="text-white opacity-30" />;
                        })()}
                      </div>
                      <p className="text-base text-gray-500 font-medium">Nenhum processo</p>
                    </div>
                  ) : (
                    processosNoDept.map((processo) => {
                      // Verificar se pode arrastar este processo
                      const podeArrastar = temPermissao(usuarioLogado, 'mover_processo', { 
                        departamentoOrigemId: dept.id,
                        departamentoAtual: dept.id
                      });

                      const isDeptDoUsuario =
                        typeof departamentoUsuario === 'number' &&
                        typeof processo?.departamentoAtual === 'number' &&
                        processo.departamentoAtual === departamentoUsuario;

                      const className = isUsuarioNormal
                        ? `cursor-pointer transition-all ${isDeptDoUsuario ? '' : 'opacity-50'}`
                        : `${podeArrastar ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-75'} transition-all ${
                            dragState.draggedItem?.id === processo.id ? 'opacity-50' : ''
                          }`;

                      const title = isUsuarioNormal
                        ? (isDeptDoUsuario ? 'Clique para ver detalhes' : 'Somente leitura (outro departamento)')
                        : (podeArrastar ? 'Arraste para mover' : 'Apenas gerentes podem mover processos');
                      
                      return (
                      <div
                        key={processo.id}
                        draggable={podeArrastar}
                        onDragStart={(e) => handleDragStart(e, processo, dept.id)}
                        onDragEnd={handleDragEnd}
                        className={className}
                        title={title}
                      >
                        <ProcessoCard
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
                                mensagem: 'Tem certeza que deseja excluir este processo?\n\nEssa ação não poderá ser desfeita.',
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
                      </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}



