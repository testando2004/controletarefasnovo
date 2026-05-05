'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Plus, Building2, AlertCircle, LayoutDashboard, Calendar, BarChart3, ScrollText, Layers, Briefcase, HardDrive, FolderOpen } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import { api } from '@/app/utils/api';
import { Processo, Departamento } from '@/app/types';
import Header from '@/app/components/Header';
import DashboardStats from '@/app/components/DashboardStats';
import DepartamentosGrid from '@/app/components/sections/DepartamentosGrid';
import Filtros from '@/app/components/sections/Filtros';
import ListaProcessos from '@/app/components/sections/ListaProcessos';
import SecaoAlertas from '@/app/components/sections/SecaoAlertas';
import ProcessoDetalhado from '@/app/components/ProcessoDetalhado';
import Calendario from '@/app/components/Calendario';
import DashboardGraficos from '@/app/components/DashboardGraficos';
import ModalLogin from '@/app/components/modals/ModalLogin';
import ModalCriarDepartamento from '@/app/components/modals/ModalCriarDepartamento';
import ModalNovaEmpresa from '@/app/components/modals/ModalNovaEmpresa';
import ModalAtividade from '@/app/components/modals/ModalAtividade';
import ModalCadastrarEmpresa from '@/app/components/modals/ModalCadastrarEmpresa';
import ModalGerenciarUsuarios from '@/app/components/modals/ModalGerenciarUsuarios';
import ModalAnalytics from '@/app/components/modals/ModalAnalytics';
import ModalListarEmpresas from '@/app/components/modals/ModalListarEmpresas';
import ModalGerenciarTags from '@/app/components/modals/ModalGerenciarTags';
import ModalComentarios from '@/app/components/modals/ModalComentarios';
import ModalUploadDocumento from '@/app/components/modals/ModalUploadDocumento';
import ModalSelecionarTemplate from '@/app/components/modals/ModalSelecionarTemplate';
import ModalVisualizacao from '@/app/components/modals/ModalVisualizacao';
import GaleriaDocumentos from '@/app/components/modals/ModalGaleria';
import ModalSelecionarTags from '@/app/components/modals/ModalSelecionarTags';
import ModalQuestionarioProcesso from '@/app/components/modals/ModalQuestionarioProcesso';
import ModalConfirmacao from '@/app/components/modals/ModalConfirmacao';
import ModalAlerta from '@/app/components/modals/ModalAlerta';
import ModalEditarQuestionarioSolicitacao from '@/app/components/modals/ModalEditarQuestionarioSolicitacao';
import ModalPreviewDocumento from '@/app/components/modals/ModalPreviewDocumento';
import ModalLixeira from '@/app/components/modals/ModalLixeira';
import ModalMotivoExclusao from '@/app/components/modals/ModalMotivoExclusao';
import ModalInterligar from '@/app/components/modals/ModalInterligar';
import ModalImportarPlanilha from '@/app/components/modals/ModalImportarPlanilha';
import ModalPainelControle from '@/app/components/modals/ModalPainelControle';
import TelaManutencao from '@/app/components/TelaManutencao';
import { GHOST_USER_EMAIL, MASTER_USER_EMAIL } from '@/app/utils/constants';
import PainelLogs from '@/app/components/PainelLogs';
import BackupRestore, { executarAutoBackupSeNecessario, getBackupConfig, deveExecutarAutoBackup } from '@/app/components/BackupRestore';
import SecaoFavoritos from '@/app/components/sections/SecaoFavoritos';
import MeusProcessos from '@/app/components/sections/MeusProcessos';
import SecaoProjetos from '@/app/components/sections/SecaoProjetos';
import ModalProjeto from '@/app/components/modals/ModalProjeto';
import { useKeyboardShortcuts } from '@/app/hooks/useKeyboardShortcuts';

// Tipos de aba
type AbaAtiva = 'dashboard' | 'meus-processos' | 'calendario' | 'graficos' | 'logs' | 'departamentos' | 'backup' | 'projetos';

export default function Home() {
  const {
    usuarioLogado,
    inicializandoUsuario,
    setUsuarioLogado,
    processos,
    setProcessos,
    empresas,
    departamentos,
    setDepartamentos,
    showCriarDepartamento,
    setShowCriarDepartamento,
    showNovaEmpresa,
    setShowNovaEmpresa,
    showGerenciarUsuarios,
    setShowGerenciarUsuarios,
    showAnalytics,
    setShowAnalytics,
    showListarEmpresas,
    setShowListarEmpresas,
    showGerenciarTags,
    setShowGerenciarTags,
    showSelecionarTags,
    setShowSelecionarTags,
    showQuestionario,
    setShowQuestionario,
    showQuestionarioSolicitacao,
    setShowQuestionarioSolicitacao,
    showComentarios,
    setShowComentarios,
    showUploadDocumento,
    setShowUploadDocumento,
    showSelecionarTemplate,
    setShowSelecionarTemplate,
    showConfirmacao,
    setShowConfirmacao,
    showAlerta,
    setShowAlerta,
    showCadastrarEmpresa,
    setShowCadastrarEmpresa,
    showGaleria,
    setShowGaleria,
    showPreviewDocumento,
    setShowPreviewDocumento,
    showLixeira,
    setShowLixeira,
    showPainelControle,
    setShowPainelControle,
    modoManutencao,
    setModoManutencao,
    excluirProcesso,
    avancarParaProximoDepartamento,
    voltarParaDepartamentoAnterior,
    finalizarProcesso,
    mostrarAlerta,
    mostrarConfirmacao,
    templates,
    criarProcesso,
  } = useSistema();

  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroTags, setFiltroTags] = useState<number[]>([]);
  const [filtroDepartamento, setFiltroDepartamento] = useState<number | null>(null);
  const [processoSelecionado, setProcessoSelecionado] = useState<Processo | null>(null);
  const [showVisualizacao, setShowVisualizacao] = useState<Processo | null>(null);
  const [showProcessoDetalhado, setShowProcessoDetalhado] = useState<Processo | null>(null);
  const showVisualizacaoId = showVisualizacao?.id ?? null;
  const [departamentoEmEdicao, setDepartamentoEmEdicao] = useState<Departamento | null>(null);
  
  // Estado de favoritos
  const [favoritosIds, setFavoritosIds] = useState<Set<number>>(new Set());
  // Ordem cronológica de fixação (primeiro fixado em primeiro, último no fim).
  // O Set acima não preserva ordem; este array é a fonte da ordem na SecaoFavoritos.
  const [favoritosOrdem, setFavoritosOrdem] = useState<number[]>([]);
  
  // Estado da aba ativa
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('dashboard');
  const [projetoAbertoId, setProjetoAbertoId] = useState<number | null>(null);

  // Estado do modal de atividade
  const [showAtividade, setShowAtividade] = useState(false);

  // Verificação periódica de modo manutenção (tempo real)
  const isSuperUser = useMemo(() => {
    if (!usuarioLogado) return false;
    return (usuarioLogado as any).isGhost === true ||
           usuarioLogado.email === GHOST_USER_EMAIL ||
           usuarioLogado.email === MASTER_USER_EMAIL;
  }, [usuarioLogado]);

  const isAdminLike = useMemo(() => {
    const role = String(usuarioLogado?.role || '').toLowerCase();
    return role === 'admin' || role === 'admin_departamento';
  }, [usuarioLogado?.role]);

  useEffect(() => {
    if (!usuarioLogado) return;
    // Checar manutenção a cada 10 segundos
    const checkManutencao = async () => {
      try {
        const res = await fetch('/api/admin/manutencao');
        if (res.ok) {
          const data = await res.json();
          setModoManutencao(data.ativo || false);
        }
      } catch { /* silent */ }
    };
    checkManutencao();
    const interval = setInterval(checkManutencao, 10000);
    return () => clearInterval(interval);
  }, [usuarioLogado, setModoManutencao]);

  // Abre automaticamente a solicitação se a URL tem ?processo=ID
  // (usado pelos links nos emails de notificação de departamento)
  useEffect(() => {
    if (!usuarioLogado) return;
    if (typeof window === 'undefined') return;
    if (!Array.isArray(processos) || processos.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const idStr = params.get('processo');
    if (!idStr) return;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return;
    const alvo = processos.find((p) => Number(p.id) === id);
    if (alvo) {
      setShowProcessoDetalhado(alvo);
      // Limpa o query param da URL pra não reabrir em refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('processo');
      window.history.replaceState({}, '', url.toString());
    }
  }, [usuarioLogado, processos]);

  // Estado do modal de importação CSV
  const [showImportarPlanilha, setShowImportarPlanilha] = useState(false);

  // Estado do modal de motivo de exclusão
  const [processoParaExcluir, setProcessoParaExcluir] = useState<Processo | null>(null);

  // Estado do modal de interligar (após finalizar)
  const [interligarInfo, setInterligarInfo] = useState<{ processoId: number; processoNome: string } | null>(null);

  // Estado do modal de edição de template/atividade
  const [templateParaEditar, setTemplateParaEditar] = useState<{ template: any; modo: 'normal' | 'copia' } | null>(null);

  // Helper: finalizar processo com interligação
  // Se já houver interligação definida no processo, cria a continuação automaticamente.
  // Suporta ramificação: se o próximo grupo é paralelo, cria TODAS as solicitações daquele grupo de uma vez.
  const handleFinalizarComInterligar = useCallback(async (processoId: number) => {
    try {
      const result = await finalizarProcesso(processoId);
      if (!result || !result.finalizado) return;

      const processoOrigem = processos.find((p) => p.id === result.processoId);
      const { normalizarCadeia, proximoPasso } = await import('@/app/utils/interligacaoChain');
      const cadeia = normalizarCadeia(result.interligacaoGrupos, result.interligacaoTemplateIds);
      const passo = proximoPasso(cadeia);

      if (passo.tipo === 'nada') {
        setInterligarInfo({ processoId: result.processoId, processoNome: result.processoNome });
        return;
      }

      const idsParaCriar: number[] = passo.tipo === 'um' ? [passo.templateId] : passo.templateIds;
      const ehParalelo = passo.modoAtualEraParalelo;
      const grupoRestante = passo.grupoRestante;

      // Helper para extrair fluxo/qpd de um template
      const extrairFluxoQpd = (tmpl: any) => {
        const fluxo = (() => {
          const v: any = tmpl?.fluxoDepartamentos ?? tmpl?.fluxo_departamentos;
          if (Array.isArray(v)) return v.map(Number);
          try { const p = JSON.parse(v as any); return Array.isArray(p) ? p.map(Number) : []; } catch { return []; }
        })();
        const qpd = (() => {
          const v: any = tmpl?.questionariosPorDepartamento ?? tmpl?.questionarios_por_departamento;
          if (v && typeof v === 'object' && !Array.isArray(v)) return v;
          try { const p = JSON.parse(v as any); return p && typeof p === 'object' ? p : {}; } catch { return {}; }
        })();
        return { fluxo, qpd };
      };

      const nomesCriados: string[] = [];
      for (const idTmpl of idsParaCriar) {
        const tmpl = (templates || []).find((t) => Number(t.id) === Number(idTmpl));
        if (!tmpl) {
          console.warn(`[interligar] template #${idTmpl} não encontrado — pulando`);
          continue;
        }
        const { fluxo, qpd } = extrairFluxoQpd(tmpl);
        if (!Array.isArray(fluxo) || fluxo.length === 0) {
          console.warn(`[interligar] template "${tmpl.nome}" sem fluxo — pulando`);
          continue;
        }

        // O "resto da cadeia" só é repassado para UMA das filhas — a primeira.
        // As demais (irmãs paralelas) nascem com a cadeia pré-configurada do próprio template, se houver.
        const primeiraDestaRodada = nomesCriados.length === 0;
        let grupoRestanteParaNova = primeiraDestaRodada ? grupoRestante : [];
        let paraleloFinal = Boolean(result.interligadoParalelo);

        // Se a cadeia já se esgotou, olha o template atual pra ver se ele tem cadeia padrão
        if (grupoRestanteParaNova.length === 0) {
          const gruposPadrao: any[] = Array.isArray((tmpl as any).interligacaoGrupos) ? (tmpl as any).interligacaoGrupos : [];
          const idsPadraoFila: number[] = Array.isArray((tmpl as any).interligacaoTemplateIds)
            ? ((tmpl as any).interligacaoTemplateIds as any[]).map(Number).filter((x: any) => Number.isFinite(x) && x > 0 && x !== tmpl.id)
            : [];
          if (gruposPadrao.length > 0) {
            grupoRestanteParaNova = gruposPadrao;
          } else if (idsPadraoFila.length > 0) {
            grupoRestanteParaNova = idsPadraoFila.map((id) => ({ modo: 'sequencial' as const, templateIds: [id] }));
            paraleloFinal = paraleloFinal || Boolean((tmpl as any).interligacaoParalelo);
          }
        }

        const filaPlana: number[] = [];
        for (const g of grupoRestanteParaNova) filaPlana.push(...g.templateIds);

        await criarProcesso({
          nome: tmpl.nome,
          nomeServico: tmpl.nome,
          nomeEmpresa: processoOrigem?.nomeEmpresa || processoOrigem?.nome || 'Empresa',
          empresa: processoOrigem?.nomeEmpresa || processoOrigem?.nome || 'Empresa',
          empresaId: (processoOrigem as any)?.empresaId,
          processoOrigemId: result.processoId,
          interligadoComId: result.processoId,
          interligadoNome: processoOrigem?.nomeServico || processoOrigem?.nome || `#${result.processoId}`,
          interligacaoTemplateIds: filaPlana,
          interligacaoGrupos: grupoRestanteParaNova,
          fluxoDepartamentos: fluxo,
          departamentoAtual: fluxo[0],
          departamentoAtualIndex: 0,
          questionariosPorDepartamento: qpd as any,
          personalizado: false,
          templateId: tmpl.id,
          criadoPor: usuarioLogado?.nome,
          descricao: `Solicitação interligada (continuação de #${result.processoId})`,
          // Herda o projetoId para manter a cadeia inteira no mesmo dossiê
          ...(result.projetoId ? { projetoId: result.projetoId } : {}),
          ...(paraleloFinal ? { interligadoParalelo: true, deptIndependente: true } : {}),
        } as any);

        nomesCriados.push(tmpl.nome);
      }

      if (nomesCriados.length === 0) {
        // Nenhum template válido na cadeia — cai no fluxo manual
        setInterligarInfo({ processoId: result.processoId, processoNome: result.processoNome });
        return;
      }

      const restoCount = (() => {
        let n = 0;
        for (const g of grupoRestante) n += g.templateIds.length;
        return n;
      })();

      const msg = ehParalelo
        ? `${nomesCriados.length} solicitações abertas em paralelo: ${nomesCriados.join(', ')}${restoCount > 0 ? ` (+${restoCount} em fila)` : ''}`
        : `Solicitação "${nomesCriados[0]}" criada${restoCount > 0 ? ` (+${restoCount} em fila)` : ''}`;
      void mostrarAlerta?.('Interligação automática', msg, 'sucesso');
    } catch (err) {
      // Erro já tratado dentro de finalizarProcesso; se veio daqui, mostra genérico
      console.error('[handleFinalizarComInterligar]', err);
    }
  }, [finalizarProcesso, processos, templates, criarProcesso, usuarioLogado?.nome, mostrarAlerta]);

  // ─── Atalhos de Teclado ⌨️ ────────────────────────────────────
  useKeyboardShortcuts({
    desabilitado: !usuarioLogado,

    // Ctrl+N → Abrir modal de novo processo
    onNovoProcesso: useCallback(() => {
      setShowNovaEmpresa(true);
    }, [setShowNovaEmpresa]),

    // Ctrl+F → Focar no campo de busca
    onBuscar: useCallback(() => {
      // Muda para aba dashboard se não estiver nela
      setAbaAtiva('dashboard');
      // Foca no input de busca (delay curto para garantir renderização)
      setTimeout(() => {
        const input = document.getElementById('busca-processos') as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
      }, 100);
    }, []),

    // Ctrl+S → Salvar / feedback visual (sem ação real global – previne save do navegador)
    onSalvar: useCallback(() => {
      // O Ctrl+S global apenas previne o comportamento padrão do navegador.
      // Em modais com formulários, o save é tratado individualmente.
    }, []),
  });

  // Mantém o modal de visualização completo em sincronia com o estado global.
  // Ex.: se apagar documento na galeria/upload, o modal deve refletir imediatamente.
  useEffect(() => {
    if (showVisualizacaoId == null) return;
    const atualizado = (processos || []).find((p) => Number(p?.id) === Number(showVisualizacaoId));
    if (!atualizado) return;

    const docsAtualizados = Array.isArray((atualizado as any)?.documentos) ? (atualizado as any).documentos : null;
    if (!docsAtualizados) return;

    const sameDocList = (a: any[], b: any[]) => {
      if (!Array.isArray(a) || !Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (Number(a[i]?.id) !== Number(b[i]?.id)) return false;
      }
      return true;
    };

    setShowVisualizacao((prev) => {
      if (!prev || Number(prev?.id) !== Number((atualizado as any)?.id)) return prev;
      const prevDocs = Array.isArray((prev as any)?.documentos) ? (prev as any).documentos : [];
      if (sameDocList(prevDocs, docsAtualizados)) return prev;
      return { ...(prev as any), documentos: docsAtualizados } as any;
    });
  }, [processos, showVisualizacaoId]);

  // Carregar favoritos quando o usuário está logado
  useEffect(() => {
    const carregarFavoritos = async () => {
      if (!usuarioLogado) {
        setFavoritosIds(new Set());
        setFavoritosOrdem([]);
        return;
      }
      try {
        const favs = await api.getFavoritos();
        // getFavoritos retorna os processos em ordem cronológica de fixação (ASC):
        // o primeiro que foi fixado vem em primeiro, último vai pro fim.
        const ids = favs.map((f: any) => f.id);
        setFavoritosIds(new Set(ids));
        setFavoritosOrdem(ids);
      } catch (error) {
        console.error('Erro ao carregar favoritos:', error);
      }
    };
    carregarFavoritos();
  }, [usuarioLogado]);

  // Auto-backup: executa ao abrir o app se o prazo já passou (apenas admin)
  useEffect(() => {
    if (!usuarioLogado) return;
    if (!isAdminLike) return;
    const config = getBackupConfig();
    if (!config.ativo || !deveExecutarAutoBackup(config)) return;
    // Pequeno delay para garantir que o app carregou completamente
    const timer = setTimeout(() => {
      executarAutoBackupSeNecessario();
    }, 3000);
    return () => clearTimeout(timer);
  }, [usuarioLogado, isAdminLike]);

  // Função para alternar favorito
  const handleToggleFavorito = async (processoId: number) => {
    try {
      const isFavorito = favoritosIds.has(processoId);
      await api.toggleFavorito(processoId, isFavorito);
      setFavoritosIds(prev => {
        const next = new Set(prev);
        if (isFavorito) {
          next.delete(processoId);
        } else {
          next.add(processoId);
        }
        return next;
      });
      // Mantém o array de ordem em sincronia: ao fixar, vai pro FIM (último fixado).
      // Ao desafixar, removemos da ordem.
      setFavoritosOrdem(prev => {
        if (isFavorito) return prev.filter(id => id !== processoId);
        if (prev.includes(processoId)) return prev;
        return [...prev, processoId];
      });
    } catch (error) {
      console.error('Erro ao alternar favorito:', error);
    }
  };

  const handleLogin = (usuario: any) => {
    setUsuarioLogado(usuario);
  };

  const handleCriarDepartamento = async (data: any) => {
    try {
      const isUpdate = Boolean(data?.id) && departamentos.some((d) => d.id === data.id);
      const departamentoExistente = isUpdate
        ? departamentos.find((d) => d.id === data.id)
        : undefined;

      const corNormalizada =
        typeof data?.cor === 'string'
          ? data.cor
          : typeof data?.cor?.gradient === 'string'
            ? data.cor.gradient
            : 'from-cyan-500 to-blue-600';

      // Normalizar ícone - sempre deve ser uma string com o nome
      let iconeNormalizado = 'FileText';
      if (typeof data?.icone === 'string') {
        iconeNormalizado = data.icone;
      } else if (data?.icone) {
        // Se for um componente React, tentar extrair o nome
        const iconeName = data.icone.name || data.icone.displayName || 'FileText';
        iconeNormalizado = iconeName;
      }

      // Validar campos obrigatórios
      if (!data.nome || !data.responsavel) {
        await mostrarAlerta('Erro', 'Nome e responsável são obrigatórios', 'erro');
        return;
      }

      const payload = {
        nome: String(data.nome || '').trim(),
        responsavel: String(data.responsavel || '').trim(),
        descricao: data.descricao ? String(data.descricao).trim() : null,
        cor: corNormalizada,
        icone: iconeNormalizado,
        // Importante: ao EDITAR, manter a ordem original caso o modal não envie `ordem`
        ordem:
          data.ordem !== undefined
            ? Number(data.ordem)
            : (departamentoExistente as any)?.ordem ?? departamentos.length,
        ativo: data.ativo !== undefined ? Boolean(data.ativo) : true,
      };

      if (isUpdate) {
        // Atualizar sem reordenar a lista no frontend
        const atualizado = await api.atualizarDepartamento(data.id, payload);
        setDepartamentos((prev) => {
          const idx = prev.findIndex((d) => d.id === data.id);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], ...(atualizado || {}), ...payload };
          return next;
        });
        api.registrarLog?.({
          acao: 'EDITAR', entidade: 'DEPARTAMENTO', entidadeId: data.id,
          entidadeNome: payload.nome,
          departamentoId: data.id,
          detalhes: `Departamento editado: "${payload.nome}"`,
        });
      } else {
        // Criar
        const criado = await api.salvarDepartamento(payload);
        setDepartamentos((prev) => [...prev, criado || payload]);
        api.registrarLog?.({
          acao: 'CRIAR', entidade: 'DEPARTAMENTO', entidadeId: criado?.id,
          entidadeNome: payload.nome,
          departamentoId: criado?.id,
          detalhes: `Departamento criado: "${payload.nome}"`,
        });
      }

      setDepartamentoEmEdicao(null);
      setShowCriarDepartamento(false);
    } catch (error: any) {
      await mostrarAlerta('Erro', error.message || 'Erro ao salvar departamento', 'erro');
    }
  };

  const handleEditarDepartamento = (dept: Departamento) => {
    setDepartamentoEmEdicao(dept);
    setShowCriarDepartamento(true);
  };

  const handleExcluirDepartamento = async (dept: Departamento) => {
    const ok = await mostrarConfirmacao({
      titulo: 'Excluir Departamento',
      mensagem: 'Tem certeza que deseja excluir este departamento?\n\nEssa ação não poderá ser desfeita.',
      tipo: 'perigo',
      textoConfirmar: 'Sim, Excluir',
      textoCancelar: 'Cancelar',
    });

    if (ok) {
      try {
        await api.excluirDepartamento(dept.id);
        // Recarregar departamentos
        const departamentosData = await api.getDepartamentos();
        setDepartamentos(departamentosData || []);
        api.registrarLog?.({
          acao: 'EXCLUIR', entidade: 'DEPARTAMENTO', entidadeId: dept.id,
          entidadeNome: dept.nome,
          departamentoId: dept.id,
          detalhes: `Departamento excluído: "${dept.nome}"`,
        });
      } catch (error: any) {
        await mostrarAlerta('Erro', error.message || 'Erro ao excluir departamento', 'erro');
      }
    }
  };

  const handleNovaEmpresa = (data: any) => {
    setProcessos([...processos, data]);
    setShowNovaEmpresa(false);
  };

  const abrirVisualizacaoCompleta = async (processo: Processo) => {
    setProcessoSelecionado(processo);
    try {
      const completo = await api.getProcesso(processo.id);
      setShowVisualizacao(completo);
    } catch {
      setShowVisualizacao(processo);
    }
  };

  const handleProcessoClicado = (processo: Processo) => {
    void abrirVisualizacaoCompleta(processo);
  };

  // Contagem alinhada com o modal: tem CNPJ => "Empresas"; sem CNPJ => "Empresas Novas"
  const empresasCadastradasCount = useMemo(() => {
    const list = Array.isArray(empresas) ? empresas : [];
    return list.filter((e: any) => {
      const cnpj = String(e?.cnpj ?? '').replace(/\D/g, '');
      return cnpj.length > 0;
    }).length;
  }, [empresas]);

  const empresasNovasCount = useMemo(() => {
    const list = Array.isArray(empresas) ? empresas : [];
    return list.filter((e: any) => {
      const cnpj = String(e?.cnpj ?? '').replace(/\D/g, '');
      return cnpj.length === 0;
    }).length;
  }, [empresas]);

  if (inicializandoUsuario) {
    return null; // Ainda estamos tentando restaurar sessão; evita mostrar modal de login momentaneamente
  }

  if (!usuarioLogado) {
    return <ModalLogin onLogin={handleLogin} />;
  }

  // Mostrar tela de manutenção para não-super users
  if (modoManutencao && !isSuperUser) {
    return <TelaManutencao />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] transition-colors">
      <Header
        onNovaEmpresa={() => setShowNovaEmpresa(true)}
        onAtividade={() => setShowAtividade(true)}
        onGerenciarUsuarios={() => setShowGerenciarUsuarios(true)}
        onAnalytics={() => setShowAnalytics(true)}
        onSelecionarTemplate={() => setShowSelecionarTemplate(true)}
        onLogout={() => { fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); setUsuarioLogado(null); }}
        onLogs={() => setAbaAtiva('logs')}
        onImportarPlanilha={() => setShowImportarPlanilha(true)}
      />

      {/* Navegação por Abas */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto overflow-x-auto px-3 sm:px-6">
          <nav className="flex min-w-max gap-1 py-1" aria-label="Tabs">
            <button
              onClick={() => setAbaAtiva('dashboard')}
              className={`
                shrink-0 whitespace-nowrap flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-all
                ${abaAtiva === 'dashboard'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
              `}
            >
              <LayoutDashboard size={18} />
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Início</span>
            </button>
            <button
              onClick={() => setAbaAtiva('meus-processos')}
              className={`
                shrink-0 whitespace-nowrap flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-all
                ${abaAtiva === 'meus-processos'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
              `}
            >
              <Briefcase size={18} />
              <span className="hidden sm:inline">Meus Processos</span>
              <span className="sm:hidden">Meus</span>
            </button>
            <button
              onClick={() => setAbaAtiva('projetos')}
              className={`
                shrink-0 whitespace-nowrap flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-all
                ${abaAtiva === 'projetos'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
              `}
            >
              <FolderOpen size={18} />
              <span>Projetos</span>
            </button>
            <button
              onClick={() => setAbaAtiva('calendario')}
              className={`
                shrink-0 whitespace-nowrap flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-all
                ${abaAtiva === 'calendario'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
              `}
            >
              <Calendar size={18} />
              <span>Calendário</span>
            </button>
            <button
              onClick={() => setAbaAtiva('graficos')}
              className={`
                shrink-0 whitespace-nowrap flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-all
                ${abaAtiva === 'graficos'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
              `}
            >
              <BarChart3 size={18} />
              <span className="hidden sm:inline">Gráficos</span>
              <span className="sm:hidden">Gráficos</span>
            </button>
            <button
              onClick={() => setAbaAtiva('departamentos')}
              className={`
                shrink-0 whitespace-nowrap flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-all
                ${abaAtiva === 'departamentos'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
              `}
            >
              <Layers size={18} />
              <span className="hidden sm:inline">Departamentos</span>
              <span className="sm:hidden">Deptos</span>
            </button>
            {/* Aba Logs - admins e superusuarios */}
            {(isAdminLike || isSuperUser) && (
              <button
                onClick={() => setAbaAtiva('logs')}
                className={`
                  shrink-0 whitespace-nowrap flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-all
                  ${abaAtiva === 'logs'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
                `}
              >
                <ScrollText size={18} />
                <span className="hidden sm:inline">Histórico de Logs</span>
                <span className="sm:hidden">Logs</span>
              </button>
            )}
            {/* Aba Backup - apenas admin/admin_departamento */}
            {isAdminLike && (
              <button
                onClick={() => setAbaAtiva('backup')}
                className={`
                  shrink-0 whitespace-nowrap flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-all
                  ${abaAtiva === 'backup'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
                `}
              >
                <HardDrive size={18} />
                <span className="hidden sm:inline">Backup</span>
                <span className="sm:hidden">Backup</span>
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Conteúdo da Aba */}
      {abaAtiva === 'dashboard' ? (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
          {/* Alertas */}
          <SecaoAlertas />

          {/* Dashboard Stats */}
          <DashboardStats />

        {/* Departamentos */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Fluxo dos Departamentos</h2>
              <p className="text-gray-600">
                {departamentos.length === 0
                  ? 'Crie seus departamentos para começar'
                  : 'Arraste os processos entre os departamentos'}
              </p>
            </div>
            <div className="flex flex-wrap lg:flex-nowrap gap-2 w-full lg:w-auto lg:justify-end">
              {/* Botão Cadastrar Empresa - apenas admin/admin_departamento */}
              {isAdminLike && (
                <button
                  onClick={() => setShowCadastrarEmpresa(true)}
                  className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Plus size={18} />
                  Cadastrar Empresa
                </button>
              )}
              {/* Botões de empresas - todos podem ver */}
              <button
                onClick={() => setShowListarEmpresas('cadastradas')}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-2">
                  <Building2 size={18} />
                  Empresas ({empresasCadastradasCount})
                </span>
              </button>
              <button
                onClick={() => setShowListarEmpresas('nao-cadastradas')}
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-2">
                  <AlertCircle size={18} />
                  Empresas Novas ({empresasNovasCount})
                </span>
              </button>
              {/* Botão Criar Departamento - apenas admin/admin_departamento */}
              {isAdminLike && (
                <button
                  onClick={() => setShowCriarDepartamento(true)}
                  className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus size={18} />
                    Criar Departamento
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
            <DepartamentosGrid
              onCriarDepartamento={() => setShowCriarDepartamento(true)}
              onEditarDepartamento={handleEditarDepartamento}
              onExcluirDepartamento={handleExcluirDepartamento}
              onProcessoClicado={handleProcessoClicado}
              onGaleria={(dept) => setShowGaleria(dept)}
              favoritosIds={favoritosIds}
              onToggleFavorito={handleToggleFavorito}
              onExcluirProcesso={(processo) => setProcessoParaExcluir(processo)}
              onFinalizarProcesso={handleFinalizarComInterligar}
            />
          </div>
        </div>

        {/* Seção de Favoritos */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 mt-6">
          <SecaoFavoritos
            onProcessoClicado={handleProcessoClicado}
            favoritosIds={favoritosIds}
            favoritosOrdem={favoritosOrdem}
            onToggleFavorito={handleToggleFavorito}
          />
        </div>

        {/* Filtros */}
        <Filtros
          onBuscaChange={setFiltroBusca}
          onStatusChange={setFiltroStatus}
          onTagsChange={setFiltroTags}
          onDepartamentoChange={setFiltroDepartamento}
        />

        {/* Lista de Processos */}
        <ListaProcessos
          onProcessoClicado={handleProcessoClicado}
          filtroStatus={filtroStatus}
          filtroBusca={filtroBusca}
          filtroTags={filtroTags}
          filtroDepartamento={filtroDepartamento}
          departamentos={departamentos}
          onComentarios={(processo) => setShowComentarios(processo.id)}
          onQuestionario={(processo, options) =>
            setShowQuestionario({
              processoId: processo.id,
              departamento: processo.departamentoAtual,
              somenteLeitura: Boolean(options?.somenteLeitura) || processo.status === 'finalizado',
            })
          }
          onDocumentos={(processo, options) => {
            if (options?.abrirGaleria) {
              const docs = (processo.documentos || []).length || Number((processo as any)?._count?.documentos || 0);
              if (docs > 0) {
                const nomeEmpresa = (() => {
                  const nome = (processo as any).nomeEmpresa;
                  if (typeof nome === 'string' && nome.trim()) return nome;

                  const empresa = (processo as any).empresa;
                  if (typeof empresa === 'string' && empresa.trim()) return empresa;
                  if (empresa && typeof empresa === 'object') {
                    return (empresa as any).razao_social || (empresa as any).apelido || (empresa as any).codigo || 'Processo';
                  }

                  return 'Processo';
                })();

                setShowGaleria({ processoId: processo.id, titulo: `Documentos - ${nomeEmpresa}` });
              } else {
                void mostrarAlerta('Sem Documentos', 'Este processo não possui documentos anexados.', 'aviso');
              }
              return;
            }
            setShowUploadDocumento(processo);
          }}
          onTags={(processo) => setShowSelecionarTags(processo)}
          onGerenciarTags={() => setShowGerenciarTags(true)}
          onAvancar={(processo) => avancarParaProximoDepartamento(processo.id)}
          onVoltar={(processo) => voltarParaDepartamentoAnterior(processo.id)}
          onFinalizar={(processo) => handleFinalizarComInterligar(processo.id)}
          onExcluir={(processo) => {
            setProcessoParaExcluir(processo);
          }}
          favoritosIds={favoritosIds}
          onToggleFavorito={handleToggleFavorito}
        />
        </div>
      ) : abaAtiva === 'meus-processos' ? (
        /* Aba Meus Processos */
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
          <MeusProcessos
            onProcessoClicado={handleProcessoClicado}
            favoritosIds={favoritosIds}
            onToggleFavorito={handleToggleFavorito}
            onExcluirProcesso={(processo) => setProcessoParaExcluir(processo)}
            onFinalizarProcesso={handleFinalizarComInterligar}
          />
        </div>
      ) : abaAtiva === 'projetos' ? (
        /* Aba Projetos (dossiês) */
        <SecaoProjetos onAbrirProjeto={(id) => setProjetoAbertoId(id)} />
      ) : abaAtiva === 'calendario' ? (
        /* Aba Calendário */
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
          <div className="h-[calc(100vh-180px)]">
            <Calendario />
          </div>
        </div>
      ) : abaAtiva === 'logs' ? (
        /* Aba Logs - Histórico Completo */
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
          <PainelLogs />
        </div>
      ) : abaAtiva === 'departamentos' ? (
        /* Aba Departamentos - Visão por Departamento */
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Layers size={24} className="text-indigo-500" />
            Visão por Departamento
          </h2>
          {departamentos.map((dept: any) => {
            const deptProcessos = (processos || []).filter((p: any) =>
              p.departamentoAtual === dept.id && p.status !== 'finalizado'
            );
            const deptFinalizados = (processos || []).filter((p: any) =>
              (p.fluxoDepartamentos || []).includes(dept.id) && p.status === 'finalizado'
            );
            return (
              <div key={dept.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{dept.nome}</h3>
                    <p className="text-sm text-white/80">{deptProcessos.length} em andamento · {deptFinalizados.length} finalizados</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm text-white font-medium">
                      {deptProcessos.length + deptFinalizados.length} total
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  {deptProcessos.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">Nenhum processo em andamento neste departamento</p>
                  ) : (
                    <div className="space-y-2">
                      {deptProcessos.slice(0, 10).map((p: any) => (
                        <div
                          key={p.id}
                          onClick={() => abrirVisualizacaoCompleta(p)}
                          className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-gray-100 dark:border-gray-700"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                {p.nomeEmpresa || p.nome}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                p.prioridade === 'alta' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                p.prioridade === 'media' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              }`}>
                                {p.prioridade}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">{p.nomeServico || 'Sem serviço'}</span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {p.criadoEm ? new Date(p.criadoEm).toLocaleDateString('pt-BR') : ''}
                          </span>
                        </div>
                      ))}
                      {deptProcessos.length > 10 && (
                        <p className="text-xs text-center text-gray-400">+ {deptProcessos.length - 10} processos</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : abaAtiva === 'backup' ? (
        /* Aba Backup */
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
          <BackupRestore />
        </div>
      ) : (
        /* Aba Gráficos */
        <DashboardGraficos />
      )}

      {/* MODALS */}
      {showCriarDepartamento && (
        <ModalCriarDepartamento
          onClose={() => setShowCriarDepartamento(false)}
          onSave={handleCriarDepartamento}
          departamento={departamentoEmEdicao as any}
        />
      )}

      {showNovaEmpresa && (
        <ModalNovaEmpresa
          onClose={() => setShowNovaEmpresa(false)}
        />
      )}

      {showAtividade && (
        <ModalAtividade
          onClose={() => setShowAtividade(false)}
        />
      )}

      {templateParaEditar && (
        <ModalAtividade
          onClose={() => setTemplateParaEditar(null)}
          templateToEdit={templateParaEditar.template}
          modoEdicao={templateParaEditar.modo}
        />
      )}

      {showImportarPlanilha && (
        <ModalImportarPlanilha
          onClose={() => setShowImportarPlanilha(false)}
        />
      )}

      {processoParaExcluir && (
        <ModalMotivoExclusao
          processoNome={processoParaExcluir.nomeEmpresa || processoParaExcluir.nome || `Processo #${processoParaExcluir.id}`}
          onClose={() => setProcessoParaExcluir(null)}
          onConfirmar={async (motivo) => {
            await excluirProcesso(processoParaExcluir.id, motivo);
            setProcessoParaExcluir(null);
          }}
        />
      )}

      {interligarInfo && (
        <ModalInterligar
          processoNome={interligarInfo.processoNome}
          processoId={interligarInfo.processoId}
          templates={(templates || []).map(t => ({ id: t.id, nome: t.nome, descricao: t.descricao }))}
          onClose={() => setInterligarInfo(null)}
          onPular={() => setInterligarInfo(null)}
          onCancelar={async () => {
            // Undo finalization: revert process back to em_andamento
            try {
              await api.atualizarProcesso(interligarInfo.processoId, {
                status: 'EM_ANDAMENTO',
                dataFinalizacao: null,
                progresso: undefined, // leave progress as-is or API handles it
              });
              // Refresh local state
              const processoAtualizado = await api.getProcesso(interligarInfo.processoId);
              setProcessos((prev: any[]) => prev.map((p: any) => p.id === interligarInfo.processoId ? processoAtualizado : p));
              void mostrarAlerta?.('Finalização cancelada', `O processo #${interligarInfo.processoId} voltou para "Em andamento".`, 'info');
            } catch (err: any) {
              void mostrarAlerta?.('Erro', err.message || 'Erro ao desfazer finalização', 'erro');
            }
            setInterligarInfo(null);
          }}
          onConfirmar={async (templateIds, deptIndependente, chainToId) => {
            const fila = Array.isArray(templateIds) ? templateIds.map(Number).filter((id) => Number.isFinite(id) && id > 0) : [];
            const [templateId, ...restanteFila] = fila;
            const template = (templates || []).find(t => t.id === templateId);
            if (!template) return 0;
            const processoOrigem = processos.find(p => p.id === chainToId) || processos.find(p => p.id === interligarInfo.processoId);
            try {
              const fluxo = (() => {
                const v: any = (template as any).fluxoDepartamentos ?? (template as any).fluxo_departamentos;
                if (Array.isArray(v)) return v.map(Number);
                try { const p = JSON.parse(v as any); return Array.isArray(p) ? p.map(Number) : []; } catch { return []; }
              })();
              const qpd = (() => {
                const v: any = (template as any).questionariosPorDepartamento ?? (template as any).questionarios_por_departamento;
                if (v && typeof v === 'object' && !Array.isArray(v)) return v;
                try { const p = JSON.parse(v as any); return p && typeof p === 'object' ? p : {}; } catch { return {}; }
              })();
              const projetoIdHerda = Number((processoOrigem as any)?.projetoId);
              const novoProcesso = await criarProcesso({
                nome: template.nome,
                nomeServico: template.nome,
                nomeEmpresa: processoOrigem?.nomeEmpresa || processoOrigem?.nome || 'Empresa',
                empresa: processoOrigem?.nomeEmpresa || processoOrigem?.nome || 'Empresa',
                empresaId: (processoOrigem as any)?.empresaId,
                processoOrigemId: chainToId,
                interligadoComId: chainToId,
                interligadoNome: processoOrigem?.nomeServico || processoOrigem?.nome || `#${chainToId}`,
                interligacaoTemplateIds: restanteFila,
                fluxoDepartamentos: fluxo,
                departamentoAtual: fluxo[0],
                departamentoAtualIndex: 0,
                questionariosPorDepartamento: qpd as any,
                personalizado: false,
                templateId: template.id,
                criadoPor: usuarioLogado?.nome,
                descricao: `Solicitação interligada (continuação de #${chainToId})`,
                ...(Number.isFinite(projetoIdHerda) && projetoIdHerda > 0 ? { projetoId: projetoIdHerda } : {}),
                ...(deptIndependente ? { interligadoParalelo: true, deptIndependente: true } : {}),
              } as any);
              void mostrarAlerta?.(
                'Interligacao realizada',
                restanteFila.length > 0
                  ? `A solicitacao "${template.nome}" foi criada como continuacao de #${chainToId} e ${restanteFila.length} atividade(s) ficaram salvas na fila.`
                  : `A solicitacao "${template.nome}" foi criada como continuacao de #${chainToId}.`,
                'sucesso'
              );
              return novoProcesso?.id || 0;
            } catch (err: any) {
              void mostrarAlerta?.('Erro', err.message || 'Erro ao criar solicitação interligada', 'erro');
              throw err;
            }
          }}
        />
      )}

      {showCadastrarEmpresa && (
        <ModalCadastrarEmpresa onClose={() => setShowCadastrarEmpresa(false)} />
      )}

      {showGerenciarUsuarios && (
        <ModalGerenciarUsuarios onClose={() => setShowGerenciarUsuarios(false)} />
      )}

      {showAnalytics && <ModalAnalytics onClose={() => setShowAnalytics(false)} />}

      {showListarEmpresas && (
        <ModalListarEmpresas
          onClose={() => setShowListarEmpresas(null)}
          tipo={(typeof showListarEmpresas === 'string' ? showListarEmpresas : showListarEmpresas.tipo) as any}
          empresaIdInicial={
            typeof showListarEmpresas === 'object' && showListarEmpresas
              ? showListarEmpresas.empresaId
              : undefined
          }
        />
      )}

      {showQuestionarioSolicitacao && (
        <ModalEditarQuestionarioSolicitacao
          processoId={showQuestionarioSolicitacao.processoId}
          departamentoId={showQuestionarioSolicitacao.departamentoId}
          onClose={() => setShowQuestionarioSolicitacao(null)}
        />
      )}

      {showGerenciarTags && (
        <ModalGerenciarTags onClose={() => setShowGerenciarTags(false)} />
      )}

      {showComentarios && (
        <ModalComentarios
          processoId={showComentarios}
          processo={processos.find((p) => p.id === showComentarios)}
          onClose={() => setShowComentarios(null)}
        />
      )}

      {showUploadDocumento && (
        <ModalUploadDocumento
          processo={(() => {
            if (typeof showUploadDocumento !== 'object' || !showUploadDocumento) return undefined;
            const processoId = Number((showUploadDocumento as any)?.id);
            if (Number.isFinite(processoId) && processoId > 0) {
              return processos.find((p) => p.id === processoId) || (showUploadDocumento as any);
            }
            return showUploadDocumento as any;
          })()}
          perguntaId={
            typeof showUploadDocumento === 'object' && showUploadDocumento?.perguntaId
              ? showUploadDocumento.perguntaId
              : null
          }
          perguntaLabel={
            typeof showUploadDocumento === 'object' && showUploadDocumento?.perguntaLabel
              ? showUploadDocumento.perguntaLabel
              : null
          }
          departamentoId={
            typeof showUploadDocumento === 'object' && showUploadDocumento?.departamentoId !== undefined
              ? showUploadDocumento.departamentoId
              : null
          }
          onClose={() => setShowUploadDocumento(null)}
        />
      )}

      {showGaleria && (
        <GaleriaDocumentos
          onClose={() => setShowGaleria(null)}
          departamentoId={typeof showGaleria === 'object' ? showGaleria?.id : undefined}
          processoId={typeof showGaleria === 'object' ? showGaleria?.processoId : undefined}
          titulo={typeof showGaleria === 'object' ? showGaleria?.titulo : undefined}
        />
      )}

      {showQuestionario && (
        <ModalQuestionarioProcesso
          processoId={showQuestionario.processoId}
          departamentoId={showQuestionario.departamento}
          somenteLeitura={showQuestionario.somenteLeitura || false}
          allowEditFinalizado={showQuestionario.allowEditFinalizado || false}
          onClose={() => setShowQuestionario(null)}
        />
      )}

      {showSelecionarTags && (
        <ModalSelecionarTags processo={showSelecionarTags} onClose={() => setShowSelecionarTags(null)} />
      )}

      {showSelecionarTemplate && (
        <ModalSelecionarTemplate
          onClose={() => setShowSelecionarTemplate(false)}
          onEditTemplate={(template, modo) => {
            setShowSelecionarTemplate(false);
            setTemplateParaEditar({ template, modo });
          }}
        />
      )}

      {projetoAbertoId && (
        <ModalProjeto
          projetoId={projetoAbertoId}
          onClose={() => setProjetoAbertoId(null)}
          onAbrirProcesso={(processoId) => {
            const proc = processos.find((p: any) => p.id === processoId);
            if (proc) {
              setProjetoAbertoId(null);
              void abrirVisualizacaoCompleta(proc);
            }
          }}
        />
      )}

      {showVisualizacao && (
        <ModalVisualizacao
          processo={showVisualizacao}
          onClose={() => setShowVisualizacao(null)}
        />
      )}



      {/* Modal Processo Detalhado */}
      {showProcessoDetalhado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <ProcessoDetalhado
            processo={showProcessoDetalhado}
            departamentos={departamentos}
            onClose={() => setShowProcessoDetalhado(null)}
            onVerCompleto={() => {
              void abrirVisualizacaoCompleta(showProcessoDetalhado);
            }}
            onComentarios={() => {
              setShowComentarios(showProcessoDetalhado.id);
            }}
            onQuestionario={() => {
              setShowQuestionario({
                processoId: showProcessoDetalhado.id,
                departamento: showProcessoDetalhado.departamentoAtual,
              });
            }}
            onDocumentos={() => {
              if (showProcessoDetalhado.status === 'finalizado') {
                const nomeEmpresa = (() => {
                  const nome = (showProcessoDetalhado as any).nomeEmpresa;
                  if (typeof nome === 'string' && nome.trim()) return nome;
                  const empresa = (showProcessoDetalhado as any).empresa;
                  if (typeof empresa === 'string' && empresa.trim()) return empresa;
                  if (empresa && typeof empresa === 'object') {
                    return (empresa as any).razao_social || (empresa as any).apelido || (empresa as any).codigo || 'Processo';
                  }
                  return 'Processo';
                })();
                setShowGaleria({ processoId: showProcessoDetalhado.id, titulo: `Documentos - ${nomeEmpresa}` });
              } else {
                setShowUploadDocumento(showProcessoDetalhado);
              }
            }}
            onAvancar={() => {
              avancarParaProximoDepartamento(showProcessoDetalhado.id);
              setShowProcessoDetalhado(null);
            }}
              onVoltar={() => {
                voltarParaDepartamentoAnterior(showProcessoDetalhado.id);
                setShowProcessoDetalhado(null);
              }}
            onFinalizar={() => {
              handleFinalizarComInterligar(showProcessoDetalhado.id);
              setShowProcessoDetalhado(null);
            }}
          />
        </div>
      )}

      {showConfirmacao && (
        <ModalConfirmacao
          titulo={showConfirmacao.titulo}
          mensagem={showConfirmacao.mensagem}
          tipo={showConfirmacao.tipo}
          textoConfirmar={showConfirmacao.textoConfirmar}
          textoCancelar={showConfirmacao.textoCancelar}
          onConfirm={() => {
            showConfirmacao.onConfirm?.();
            setShowConfirmacao(null);
          }}
          onCancel={() => {
            showConfirmacao.onCancel?.();
            setShowConfirmacao(null);
          }}
        />
      )}

      {showAlerta && (
        <ModalAlerta
          titulo={showAlerta.titulo}
          mensagem={showAlerta.mensagem}
          tipo={showAlerta.tipo}
          onClose={() => {
            showAlerta.onClose?.();
            setShowAlerta(null);
          }}
        />
      )}
      {showPreviewDocumento && (
        <ModalPreviewDocumento
          documento={showPreviewDocumento}
          onClose={() => setShowPreviewDocumento(null)}
        />
      )}

      {showLixeira && (
        <ModalLixeira
          isOpen={showLixeira}
          onClose={() => setShowLixeira(false)}
        />
      )}

      {/* Painel de Controle (ghost only) */}
      {showPainelControle && (
        <ModalPainelControle onClose={() => setShowPainelControle(false)} />
      )}
    </div>
  );
}
