'use client';

import React from 'react';
import { X, Save, Upload, FileText, Eye, Download, MessageSquare, CheckCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import LoadingOverlay from '../LoadingOverlay';
import { Questionario } from '@/app/types';
import { formatarDataHora, formatarTamanhoParcela, formatarNomeArquivo } from '@/app/utils/helpers';
import { maskCPF, maskCNPJ, maskCEP, maskMoney, maskTelefone } from '@/app/utils/masks';

interface ModalQuestionarioProcessoProps {
  processoId: number;
  departamentoId: number;
  somenteLeitura?: boolean;
  allowEditFinalizado?: boolean;
  onClose: () => void;
}

export default function ModalQuestionarioProcesso({
  processoId,
  departamentoId,
  somenteLeitura = false,
  allowEditFinalizado = false,
  onClose,
}: ModalQuestionarioProcessoProps) {
  const {
    processos,
    setProcessos,
    departamentos,
    empresas,
    usuarioLogado,
    atualizarProcesso,
    setShowUploadDocumento,
    adicionarNotificacao,
    mostrarAlerta,
    mostrarConfirmacao,
    setShowListarEmpresas,
    setShowQuestionarioSolicitacao,
    setShowPreviewDocumento,
  } = useSistema();

  const processo = processos.find((p) => p.id === processoId);
  const departamento = departamentos.find((d) => d.id === departamentoId);

  const getDepartamentoIcone = (icone: any) => {
    if (typeof icone === 'function') return icone;
    if (typeof icone === 'string' && icone) {
      return (LucideIcons as any)[icone] || null;
    }
    return null;
  };



  const [carregandoProcesso, setCarregandoProcesso] = React.useState(false);
  const [salvandoRespostas, setSalvandoRespostas] = React.useState(false);

  const modalContainerRef = React.useRef<HTMLDivElement | null>(null);

  // DEBUG: log dos parâmetros e questionário (apenas em dev)
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('DEBUG ModalQuestionarioProcesso - params', { processoId, departamentoId });
      console.debug('DEBUG ModalQuestionarioProcesso - processo summary', {
        id: processo?.id,
        nomeEmpresa: processo?.nomeEmpresa,
        status: processo?.status,
        questionariosKeys: processo ? Object.keys((processo as any).questionariosPorDepartamento || {}) : undefined,
        questionariosLength: Array.isArray((processo as any)?.questionarios) ? (processo as any).questionarios.length : 0,
        comentariosLength: Array.isArray((processo as any)?.comentarios) ? (processo as any).comentarios.length : 0,
        documentosLength: Array.isArray((processo as any)?.documentos) ? (processo as any).documentos.length : 0,
      });
    }
  } catch {
    // noop
  }
  // Calcula a etapa correta do departamento no fluxo (mesmo dept pode aparecer múltiplas vezes).
  // Se estivermos olhando para o dept atual do processo, usa departamentoAtualIndex;
  // senão, usa a primeira aparição desse dept no fluxo.
  const etapaDoDeptExibido = React.useMemo(() => {
    const fluxo: number[] = Array.isArray(processo?.fluxoDepartamentos) ? (processo!.fluxoDepartamentos as any[]).map(Number).filter((x) => Number.isFinite(x)) : [];
    if (fluxo.length === 0) return 1;
    const deptAtual = Number(processo?.departamentoAtual);
    const idxAtual = Number(processo?.departamentoAtualIndex ?? 0);
    // Se estamos no dept atual do processo, calcula a etapa a partir do índice atual
    if (Number.isFinite(deptAtual) && deptAtual === Number(departamentoId)) {
      let c = 0;
      for (let i = 0; i <= idxAtual && i < fluxo.length; i++) {
        if (fluxo[i] === Number(departamentoId)) c++;
      }
      return c || 1;
    }
    // Caso contrário, usa a primeira aparição
    return 1;
  }, [processo, departamentoId]);

  const chaveDeptAtual = etapaDoDeptExibido === 1
    ? String(departamentoId)
    : `${Number(departamentoId)}:${etapaDoDeptExibido}`;

  // Priorizar questionariosPorDepartamento corretamente (suportando chave composta p/ etapas múltiplas)
  let questionarioAtual: Questionario[] = [];
  if (processo?.questionariosPorDepartamento && (processo.questionariosPorDepartamento as any)[chaveDeptAtual]) {
    questionarioAtual = (processo.questionariosPorDepartamento as any)[chaveDeptAtual];
  } else if (processo?.questionariosPorDepartamento && processo.questionariosPorDepartamento[String(departamentoId)]) {
    questionarioAtual = processo.questionariosPorDepartamento[String(departamentoId)];
  } else if (processo?.questionariosPorDepartamento && processo.questionariosPorDepartamento[departamentoId]) {
    questionarioAtual = processo.questionariosPorDepartamento[departamentoId];
  } else if ((processo as any)?.questionarioSolicitacao) {
    questionarioAtual = (processo as any).questionarioSolicitacao;
  } else if ((processo as any)?.questionario) {
    questionarioAtual = (processo as any).questionario;
  } else if ((processo as any)?.questionarios) {
    questionarioAtual = (processo as any).questionarios;
  }
  console.log('DEBUG questionarioAtual', questionarioAtual, { chaveDeptAtual, etapaDoDeptExibido });

  // IDs de campos controladores de grupos repetíveis (para ocultá-los da lista principal)
  const camposControladores = new Set(
    questionarioAtual
      .filter(p => p.tipo === 'grupo_repetivel' && p.modoRepeticao === 'numero' && p.controladoPor)
      .map(p => p.controladoPor!)
  );

  // Exibir loading enquanto carrega o processo detalhado e não há questionário
  const showLoading = carregandoProcesso && questionarioAtual.length === 0;
  console.log('DEBUG questionarioAtual', questionarioAtual);

  React.useEffect(() => {
    let cancelled = false;

    // Sempre busca dados frescos ao abrir o modal para garantir que documentos
    // sejam filtrados corretamente por permissão/visibilidade (evita cache desatualizado).
    if (!processoId || !departamentoId) return;

    void (async () => {
      try {
        setCarregandoProcesso(true);
        const { api } = await import('@/app/utils/api');
        const atualizado = await api.getProcesso(processoId);
        if (process.env.NODE_ENV !== 'production') {
          try {
            console.debug('DEBUG ModalQuestionarioProcesso - fetched processo', {
              id: atualizado?.id,
              questionariosLength: Array.isArray((atualizado as any)?.questionarios) ? (atualizado as any).questionarios.length : 0,
              questionariosPorDepartamentoKeys: atualizado ? Object.keys((atualizado as any).questionariosPorDepartamento || {}) : [],
              respostasHistoricoKeys: atualizado ? Object.keys((atualizado as any).respostasHistorico || {}) : [],
            });
          } catch {
            // ignore
          }
        }
        if (cancelled) return;

        setProcessos((prev: any) => {
          const list = Array.isArray(prev) ? prev : [];
          const idx = list.findIndex((p: any) => p?.id === processoId);
          if (idx >= 0) {
            return list.map((p: any) => (p?.id === processoId ? atualizado : p));
          }
          return [...list, atualizado];
        });
      } catch (e) {
        // Se falhar, o modal ainda renderiza o estado atual.
        console.warn('Falha ao carregar processo completo:', e);
      } finally {
        if (!cancelled) setCarregandoProcesso(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processoId, departamentoId]);

  const respostasSalvas =
    ((processo?.respostasHistorico as any)?.[departamentoId]?.respostas as Record<string, any>) || {};
  const clonarRespostas = (valor: Record<string, any>) => {
    try {
      return JSON.parse(JSON.stringify(valor || {}));
    } catch {
      return { ...(valor || {}) };
    }
  };
  const serializarRespostas = (valor: Record<string, any>) => {
    try {
      return JSON.stringify(valor || {});
    } catch {
      return '{}';
    }
  };
  const respostasSalvasSerializadas = serializarRespostas(respostasSalvas);

  const [respostas, setRespostas] = React.useState<Record<string, any>>(respostasSalvas);
  const respostasBackupRef = React.useRef<Record<string, any>>(respostasSalvas);
  const respostasRef = React.useRef<Record<string, any>>(respostasSalvas);

  React.useEffect(() => {
    respostasRef.current = respostas;
  }, [respostas]);

  React.useEffect(() => {
    const respostasServidor = clonarRespostas(respostasSalvas);
    const backupAtual = serializarRespostas(respostasBackupRef.current);
    const respostasAtuais = serializarRespostas(respostasRef.current);
    const houveEdicaoLocal = respostasAtuais !== backupAtual;

    // Hidrata as respostas quando o processo completo chega depois da abertura,
    // mas preserva qualquer edição que o usuário já tenha iniciado no modal.
    if (houveEdicaoLocal && respostasAtuais !== respostasSalvasSerializadas) {
      return;
    }

    setRespostas(respostasServidor);
    respostasBackupRef.current = respostasServidor;
    respostasRef.current = respostasServidor;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processoId, departamentoId, respostasSalvasSerializadas]);

  const keyOf = (pergunta: Questionario) => String(pergunta.id);
  const safeValue = (val: any) => (val === undefined || val === null ? '' : val);

  const temMudancasNaoSalvas = () => {
    try {
      return JSON.stringify(respostas || {}) !== JSON.stringify(respostasBackupRef.current || {});
    } catch {
      return false;
    }
  };

  const handleRespostaChange = (perguntaId: number, valor: any) => {
    setRespostas((prev) => {
      const next = {
        ...prev,
        [String(perguntaId)]: valor,
      };

      // When a controlling question changes, clear responses for any
      // conditional questions that are no longer visible.
      // This cascades: clearing a dependent question may hide further
      // questions that depend on it, so we loop until stable.
      let changed = true;
      while (changed) {
        changed = false;
        for (const p of questionarioAtual) {
          if (!p.condicao) continue;
          const k = String(p.id);
          // Only act if this question currently has a response stored
          if (next[k] === undefined || next[k] === null || next[k] === '') continue;
          // If the condition is no longer met, clear the response
          if (!avaliarCondicao(p, next)) {
            next[k] = '';
            changed = true;
          }
        }
      }

      return next;
    });
  };

  const docsAnexadosPergunta = (perguntaId: number) => {
    const docs = processo?.documentos || [];
    // IDs de sub-perguntas podem ser floats (Date.now() + Math.random()), enquanto o banco
    // armazena o valor truncado (Math.trunc). Comparamos ambos truncados para garantir match.
    const perguntaIdTrunc = Math.trunc(Number(perguntaId));
    const filtered = docs.filter((d: any) => {
      const dPerg = Math.trunc(Number(d?.perguntaId ?? d?.pergunta_id));
      if (!Number.isFinite(dPerg) || dPerg === 0) return false;
      if (dPerg !== perguntaIdTrunc) return false;

      const dDeptRaw = d?.departamentoId ?? d?.departamento_id;
      const dDept = Number(dDeptRaw);
      // Alguns registros antigos podem não ter departamentoId; ainda assim pertence ao processo/pergunta
      if (!Number.isFinite(dDept)) return true;
      return dDept === Number(departamentoId);
    });
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.debug('docsAnexadosPergunta - filtro', { processoId: processo?.id, perguntaId, totalDocs: (processo?.documentos || []).length, filteredCount: filtered.length, filteredIds: filtered.map((x: any) => x.id), sample: filtered.slice(0, 5) });
      } catch {}
    }
    return filtered;
  };

  const docsAnexadosPerguntaNoDepartamento = (deptId: number, perguntaId: number) => {
    const docs = processo?.documentos || [];
    const perguntaIdTrunc = Math.trunc(Number(perguntaId));
    const filtered = docs.filter((d: any) => {
      const dPerg = Math.trunc(Number(d?.perguntaId ?? d?.pergunta_id));
      if (dPerg !== perguntaIdTrunc) return false;

      const dDeptRaw = d?.departamentoId ?? d?.departamento_id;
      const dDept = Number(dDeptRaw);
      // Alguns registros antigos podem não ter departamentoId; ainda assim pertence ao processo/pergunta
      if (!Number.isFinite(dDept)) return true;
      return dDept === Number(deptId);
    });
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.debug('docsAnexadosPerguntaNoDepartamento - filtro', { processoId: processo?.id, deptId, perguntaId, filteredCount: filtered.length, filteredIds: filtered.map((x: any) => x.id) });
      } catch {}
    }
    return filtered;
  };

  const avaliarCondicao = (pergunta: Questionario, respostasAtuais: Record<string, any>) => {
    // grupo_repetivel nunca deve ser filtrado por condicao - tem seu proprio mecanismo (controladoPor)
    if (pergunta.tipo === 'grupo_repetivel') return true;
    if (!pergunta.condicao) return true;
    const { perguntaId, operador, valor } = pergunta.condicao;
    const respostaCondicional = respostasAtuais[String(perguntaId)];
    if (respostaCondicional === undefined || respostaCondicional === null || respostaCondicional === '') {
      return false;
    }
    const r = String(respostaCondicional).trim().toLowerCase();
    const v = String(valor).trim().toLowerCase();
    switch (operador) {
      case 'igual':
        return r === v;
      case 'diferente':
        return r !== v;
      case 'contem':
        return r.includes(v);
      default:
        return true;
    }
  };

  const validarObrigatorios = (): { faltando: string[] } => {
    const obrigatorias = (questionarioAtual || []).filter((p) => p.obrigatorio && p.tipo !== 'titulo');

    const faltandoPerguntas = obrigatorias.filter((p) => {
      if (!avaliarCondicao(p, respostas)) return false;
      if (p.tipo === 'file') {
        // Se existem anexos visíveis, considera respondido
        if (docsAnexadosPergunta(p.id).length > 0) return false;
        // Caso contrário, verificar contagens retornadas pelo backend (ex.: anexos restritos)
        const counts: Record<string, number> = (processo as any)?.documentosCounts ?? {};
        const keySpecific = `${p.id}:${departamentoId}`;
        const keyAny = `${p.id}:0`;
        const total = Number(counts[keySpecific] ?? counts[keyAny] ?? 0);
        return total === 0;
      }
      const r = respostas[keyOf(p)];
      if (r === null || r === undefined) return true;
      if (typeof r === 'string' && !r.trim()) return true;
      if (p.tipo === 'checkbox') {
        let arr: any[] = [];
        if (Array.isArray(r)) arr = r;
        else if (typeof r === 'string') {
          try { const parsed = JSON.parse(r); if (Array.isArray(parsed)) arr = parsed; } catch {}
        }
        if (arr.filter((v) => v !== null && v !== undefined && String(v).trim() !== '').length === 0) return true;
      }
      return false;
    });

    // Valida sub-perguntas obrigatórias dentro de grupo_repetivel, respeitando condicionais
    const avaliarCondicaoSub = (sub: any, grupo: Record<string, any>): boolean => {
      if (!sub?.condicao || !sub.condicao.perguntaId) return true;
      const valorDepStr = String(grupo[String(sub.condicao.perguntaId)] ?? '').trim();
      const valorEsperado = String(sub.condicao.valor ?? '').trim();
      switch (sub.condicao.operador) {
        case 'igual':
          return valorDepStr === valorEsperado;
        case 'diferente':
          return valorDepStr !== valorEsperado && valorDepStr !== '';
        case 'contem':
          return valorDepStr.toLowerCase().includes(valorEsperado.toLowerCase()) && valorDepStr !== '';
        default:
          return true;
      }
    };

    const gruposRepetiveis = (questionarioAtual || []).filter((p) => p.tipo === 'grupo_repetivel');
    const faltandoSub: string[] = [];
    for (const gr of gruposRepetiveis) {
      if (!avaliarCondicao(gr, respostas)) continue;
      const subs = (gr.subPerguntas || []).filter((s: any) => s.obrigatorio);
      if (subs.length === 0) continue;
      const gruposAtual: Record<string, any>[] = Array.isArray(respostas[keyOf(gr)]) ? respostas[keyOf(gr)] : [];
      if (gruposAtual.length === 0) continue;
      gruposAtual.forEach((grupo, gIdx) => {
        subs.forEach((sub: any) => {
          if (!avaliarCondicaoSub(sub, grupo)) return;
          if (sub.tipo === 'file') {
            if (docsAnexadosPergunta(sub.id).length > 0) return;
            faltandoSub.push(`${gr.label} [grupo ${gIdx + 1}] → ${sub.label}`);
            return;
          }
          const val = grupo[String(sub.id)];
          if (val === null || val === undefined || (typeof val === 'string' && !val.trim())) {
            faltandoSub.push(`${gr.label} [grupo ${gIdx + 1}] → ${sub.label}`);
            return;
          }
          if (sub.tipo === 'checkbox') {
            let arr: any[] = [];
            if (Array.isArray(val)) arr = val;
            else if (typeof val === 'string') {
              try { const parsed = JSON.parse(val); if (Array.isArray(parsed)) arr = parsed; } catch {}
            }
            if (arr.filter((v) => v !== null && v !== undefined && String(v).trim() !== '').length === 0) {
              faltandoSub.push(`${gr.label} [grupo ${gIdx + 1}] → ${sub.label}`);
            }
          }
        });
      });
    }

    return {
      faltando: [...faltandoPerguntas.map((p) => p.label), ...faltandoSub],
    };
  };

  const removerDocumento = (documentoId: number) => {
    if (!processo) return;
    void (async () => {
      const ok = await mostrarConfirmacao({
        titulo: 'Excluir Documento',
        mensagem: 'Tem certeza que deseja excluir este documento?\n\nEsta ação não poderá ser desfeita.',
        tipo: 'perigo',
        textoConfirmar: 'Sim, Excluir',
        textoCancelar: 'Cancelar',
      });

      if (!ok) return;

      try {
        const { api } = await import('@/app/utils/api');
        await api.excluirDocumento(documentoId);

        // Recarrega o processo atualizado do servidor e atualiza o estado global
        try {
          const processoAtualizado = await api.getProcesso(processoId);
          setProcessos((prev: any) => (Array.isArray(prev) ? prev.map((p: any) => (p?.id === processoId ? processoAtualizado : p)) : prev));
        } catch (err) {
          // Se falhar ao recarregar, atualizamos localmente como fallback
          atualizarProcesso(processoId, {
            documentos: (processo.documentos || []).filter((d: any) => d.id !== documentoId),
          } as any);
        }

        adicionarNotificacao('Documento excluído com sucesso', 'sucesso');
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : 'Erro ao excluir documento';
        await mostrarAlerta('Erro', msg, 'erro');
      }
    })();
  };

  const baixarDocumento = (doc: any) => {
    try {
      const a = document.createElement('a');
      a.href = doc.url;
      a.download = doc.nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      adicionarNotificacao('Erro ao baixar arquivo', 'erro');
    }
  };

  const visualizarDocumento = (doc: any) => {
    try {
      setShowPreviewDocumento(doc);
    } catch {
      // noop
    }
  };

  const handleSalvar = async () => {
    if (!processo || !departamento) return;
    if (somenteLeitura || (processo.status === 'finalizado' && !allowEditFinalizado)) return;

    const { faltando } = validarObrigatorios();
    if (faltando.length > 0) {
      const MAX_LISTA = 5;
      const lista = faltando.slice(0, MAX_LISTA).map((n) => `• ${n}`).join('\n');
      const extra = faltando.length > MAX_LISTA ? `\n• ...e mais ${faltando.length - MAX_LISTA}` : '';
      const confirmou = await mostrarConfirmacao({
        titulo: 'Campos obrigatórios pendentes',
        mensagem: `Faltam ${faltando.length} campo(s) obrigatório(s) sem resposta:\n\n${lista}${extra}\n\nDeseja salvar mesmo assim como progresso parcial?`,
        tipo: 'aviso',
        textoConfirmar: 'Salvar Mesmo Assim',
        textoCancelar: 'Continuar Preenchendo',
      });
      if (!confirmou) return;
    }

    try {
      setSalvandoRespostas(true);
      if (process.env.NODE_ENV !== 'production') {
        try { console.debug('ModalQuestionarioProcesso - handleSalvar - iniciando', { processoId, departamentoId, respostasCount: Object.keys(respostas || {}).length, respostasSample: Object.fromEntries(Object.entries(respostas || {}).slice(0,10)) }); } catch {}
      }
      // Salvar respostas usando a API de questionários
      const { api } = await import('@/app/utils/api');
      await api.salvarRespostasQuestionario(processoId, departamentoId, respostas);

      // Clean up documents for conditional questions that are no longer visible
      const perguntasOcultas = (questionarioAtual || []).filter(p =>
        p.condicao && p.tipo === 'file' && !avaliarCondicao(p, respostas)
      );

      for (const pergOculta of perguntasOcultas) {
        const docsParaRemover = docsAnexadosPergunta(pergOculta.id);
        for (const doc of docsParaRemover) {
          try {
            await api.excluirDocumento(doc.id);
          } catch {
            // Silent - best effort cleanup
          }
        }
      }

      // Recarregar o processo atualizado
      const processoAtualizado = await api.getProcesso(processoId);
      if (process.env.NODE_ENV !== 'production') {
        try { console.debug('ModalQuestionarioProcesso - handleSalvar - processoAtualizado', { id: processoAtualizado?.id, documentosLen: Array.isArray(processoAtualizado?.documentos) ? processoAtualizado.documentos.length : 0, documentosSample: (processoAtualizado?.documentos || []).slice(0,5).map((d:any)=>({ id: d.id, perguntaId: d.perguntaId ?? d.pergunta_id, departamentoId: d.departamentoId ?? d.departamento_id })) }); } catch {}
      }
      if (processoAtualizado && setProcessos) {
        setProcessos((prev: any) => prev.map((p: any) => p.id === processoId ? processoAtualizado : p));
      }

      respostasBackupRef.current = JSON.parse(JSON.stringify(respostas || {}));
      adicionarNotificacao('✅ Respostas salvas com sucesso!', 'sucesso');
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar respostas:', error);
      adicionarNotificacao(error.message || 'Erro ao salvar respostas', 'erro');
    } finally {
      setSalvandoRespostas(false);
    }
  };

  const handleFecharModal = () => {
    void (async () => {
      if (!somenteLeitura && (processo?.status !== 'finalizado' || allowEditFinalizado) && temMudancasNaoSalvas()) {
        const confirmouSalvar = await mostrarConfirmacao({
          titulo: 'Alterações não salvas',
          mensagem: 'Você tem alterações não salvas. Deseja salvar antes de fechar?',
          tipo: 'aviso',
          textoConfirmar: 'Salvar',
          textoCancelar: 'Descartar',
        });

        if (confirmouSalvar) {
          handleSalvar();
          return;
        }
        setRespostas({ ...(respostasBackupRef.current || {}) });
      }

      onClose();
    })();
  };

  const renderCampo = (pergunta: Questionario) => {
    const bloqueado = (() => {
      if (somenteLeitura) return true;
      if (processo?.status !== 'finalizado') return false;
      const role = String(usuarioLogado?.role || '').toUpperCase();
      const isSameDept = Number(usuarioLogado?.departamentoId) === Number(departamentoId);
      if (allowEditFinalizado) return false;
      if (role === 'ADMIN' || role === 'GERENTE' || isSameDept) return false;
      return true;
    })();
    const k = keyOf(pergunta);
    const valor = respostas[k];
    const isEmpty = valor === undefined || valor === null || valor === '';

    // DEBUG: log do tipo da pergunta
    console.log('[renderCampo] pergunta:', {
      id: pergunta.id,
      label: pergunta.label,
      tipo: pergunta.tipo,
      tipoOf: typeof pergunta.tipo,
      opcoes: pergunta.opcoes,
      subPerguntas: pergunta.subPerguntas?.length,
      modoRepeticao: pergunta.modoRepeticao,
      controladoPor: pergunta.controladoPor,
      valorAtual: valor,
    });

    switch (pergunta.tipo) {
      case 'titulo':
        // Titulo nao tem campo de resposta — é apenas cabecalho de secao
        return null;
      case 'text':
        return bloqueado ? (
          <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
            {isEmpty ? '—' : String(valor)}
          </div>
        ) : (
          <input
            type="text"
            value={safeValue(valor)}
            onChange={(e) => handleRespostaChange(pergunta.id, e.target.value.slice(0, 200))}
            maxLength={200}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
            required={pergunta.obrigatorio}
            placeholder="Digite sua resposta (máx. 200 caracteres)"
          />
        );

      case 'textarea':
        return bloqueado ? (
          <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 whitespace-pre-wrap">
            {isEmpty ? '—' : String(valor).trim()}
          </div>
        ) : (
          <textarea
            value={safeValue(valor)}
            onChange={(e) => handleRespostaChange(pergunta.id, e.target.value.slice(0, 500))}
            maxLength={500}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 resize-vertical"
            required={pergunta.obrigatorio}
            placeholder="Digite sua resposta (máx. 500 caracteres)"
          />
        );

      case 'number': {
        return bloqueado ? (
          <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
            {isEmpty ? '—' : String(valor)}
          </div>
        ) : (
          <input
            type="number"
            value={safeValue(valor)}
            onChange={(e) => {
              console.log('[renderCampo] number change:', { perguntaId: pergunta.id, label: pergunta.label, novoValor: e.target.value });
              handleRespostaChange(pergunta.id, e.target.value);
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
            required={pergunta.obrigatorio}
            placeholder="Digite um número"
          />
        );
      }

      case 'date':
        return bloqueado ? (
          <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
            {isEmpty ? '—' : new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'UTC' } as any)}
          </div>
        ) : (
          <input
            type="date"
            value={safeValue(valor)}
            onChange={(e) => handleRespostaChange(pergunta.id, e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
            required={pergunta.obrigatorio}
          />
        );

      case 'email':
        return bloqueado ? (
          <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
            {isEmpty ? '—' : String(valor)}
          </div>
        ) : (
          <input
            type="email"
            value={safeValue(valor)}
            onChange={(e) => handleRespostaChange(pergunta.id, e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
            required={pergunta.obrigatorio}
            placeholder="exemplo@email.com"
          />
        );

      case 'phone': {
        const phoneDigits = String(valor || '').replace(/\D/g, '');
        const phoneIncompleto = phoneDigits.length > 0 && phoneDigits.length < 10;
        return bloqueado ? (
          <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
            {isEmpty ? '—' : String(valor)}
          </div>
        ) : (
          <div>
            <input
              type="tel"
              inputMode="numeric"
              value={safeValue(valor)}
              onChange={(e) => handleRespostaChange(pergunta.id, maskTelefone(e.target.value))}
              maxLength={15}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-cyan-500 ${phoneIncompleto ? 'border-red-400' : 'border-gray-300'}`}
              required={pergunta.obrigatorio}
              placeholder="(00) 00000-0000"
            />
            {phoneIncompleto && (
              <p className="text-xs text-red-500 mt-1">Telefone incompleto — faltam {10 - phoneDigits.length} dígito(s)</p>
            )}
          </div>
        );
      }

      case 'file': {
        const docsAnexados = docsAnexadosPergunta(pergunta.id);
        if (process.env.NODE_ENV !== 'production') {
          try { console.debug('ModalQuestionarioProcesso - campo file - docsAnexados', { perguntaId: pergunta.id, count: docsAnexados.length, ids: docsAnexados.map((d:any)=>d.id) }); } catch {}
        }
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                <FileText size={16} className="text-blue-500" />
                Documentos Anexados ({docsAnexados.length})
              </h5>

              {docsAnexados.length === 0 ? (
                <div className="bg-blue-50 border border-blue-100 dark:bg-blue-500/10 dark:border-[var(--border)] rounded-xl p-5 text-center">
                  <FileText size={26} className="mx-auto text-blue-300 mb-2" />
                  <p className="text-sm text-blue-700 dark:text-[var(--fg)]">Nenhum documento anexado ainda</p>
                  {!bloqueado && (
                    <p className="text-xs text-blue-500 dark:text-gray-400 mt-1">
                      Clique em &quot;Anexar Arquivo&quot; para enviar documentos
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {docsAnexados.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="relative bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-[var(--border)] rounded-xl p-3 hover:shadow-md transition-all pr-20"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText size={20} className="text-blue-600" />
                          </div>

                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div
                              className="text-sm font-semibold text-gray-900 dark:text-[var(--fg)] truncate max-w-[calc(100%-96px)]"
                              title={doc.nome}
                            >
                              {formatarNomeArquivo(doc.nome)}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-blue-500 mt-1">
                              <span>{formatarTamanhoParcela(Number(doc.tamanho || 0))}</span>
                              <span>{formatarDataHora(doc.dataUpload)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => visualizarDocumento(doc)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1"
                            title="Visualizar documento"
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => baixarDocumento(doc)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                            title="Baixar documento"
                          >
                            <Download size={16} />
                          </button>

                          {!bloqueado && (
                            <button
                              type="button"
                              onClick={() => removerDocumento(doc.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1"
                              title="Excluir documento"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!bloqueado && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowUploadDocumento({
                    id: processoId,
                    perguntaId: pergunta.id,
                    perguntaLabel: pergunta.label,
                    departamentoId,
                  });
                }}
                className="w-full px-4 py-3 border-2 border-dashed border-blue-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                <Upload size={18} />
                <span>{docsAnexados.length > 0 ? 'Adicionar Mais Arquivos' : 'Anexar Arquivo'}</span>
              </button>
            )}

            <input type="hidden" name={`pergunta_${pergunta.id}`} value={safeValue(respostas[k])} />
          </div>
        );
      }

      case 'boolean':
        return bloqueado ? (
          <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
            {isEmpty ? '—' : String(valor)}
          </div>
        ) : (
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={String(pergunta.id)}
                value="Sim"
                checked={respostas[k] === 'Sim'}
                onChange={(e) => handleRespostaChange(pergunta.id, e.target.value)}
                className="w-5 h-5 text-cyan-600"
                required={pergunta.obrigatorio}
              />
              <span className="text-gray-700">Sim</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={String(pergunta.id)}
                value="Não"
                checked={respostas[k] === 'Não'}
                onChange={(e) => handleRespostaChange(pergunta.id, e.target.value)}
                className="w-5 h-5 text-cyan-600"
                required={pergunta.obrigatorio}
              />
              <span className="text-gray-700">Não</span>
            </label>
          </div>
        );

      case 'select':
        return bloqueado ? (
          <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
            {isEmpty ? '—' : String(valor)}
          </div>
        ) : (
          <select
            value={safeValue(valor)}
            onChange={(e) => handleRespostaChange(pergunta.id, e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
            required={pergunta.obrigatorio}
          >
            <option value="">Selecione...</option>
            {(pergunta.opcoes || []).filter((o) => String(o).trim()).map((op, idx) => (
              <option key={idx} value={op}>
                {op}
              </option>
            ))}
          </select>
        );

      case 'checkbox': {
        const opcoes = (pergunta.opcoes || []).map((o) => String(o ?? '').trim()).filter((o) => o.length > 0);

        // Para evitar o bug de marcar várias opções iguais (ou “marcar uma e marcar outra junto”),
        // salvamos a seleção como tokens estáveis: "idx|label".
        const tokenFor = (idx: number, label: string) => `${idx}|${label}`;
        const stripToken = (t: string) => {
          const m = String(t).match(/^\d+\|(.*)$/);
          return m ? m[1] : String(t);
        };

        const parseSelecionados = (raw: any): { tokens: Set<string>; labels: Set<string>; indices: Set<number> } => {
          const tokens = new Set<string>();
          const labels = new Set<string>();
          const indices = new Set<number>();
          try {
            const parsed = typeof raw === 'string' && raw ? JSON.parse(raw) : raw;
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (typeof item === 'number' && Number.isFinite(item)) {
                  indices.add(item);
                  continue;
                }
                const s = String(item ?? '');
                if (!s) continue;
                if (/^\d+\|/.test(s)) tokens.add(s);
                else labels.add(s);
              }
            } else if (typeof raw === 'string' && raw.trim()) {
              // legado: string simples
              labels.add(raw.trim());
            }
          } catch {
            // legado: string simples não-JSON
            if (typeof raw === 'string' && raw.trim()) labels.add(raw.trim());
          }
          return { tokens, labels, indices };
        };

        const selecionados = parseSelecionados(valor);

        const isChecked = (idx: number, label: string) => {
          if (selecionados.indices.has(idx)) return true;
          if (selecionados.tokens.has(tokenFor(idx, label))) return true;
          return selecionados.labels.has(label);
        };

        const formatSelecionados = () => {
          const out: string[] = [];
          if (selecionados.tokens.size > 0) {
            for (let i = 0; i < opcoes.length; i++) {
              const lab = opcoes[i];
              if (selecionados.tokens.has(tokenFor(i, lab))) out.push(lab);
            }
            return out.join(', ');
          }
          if (selecionados.indices.size > 0) {
            const idxs = Array.from(selecionados.indices).sort((a, b) => a - b);
            for (const i of idxs) {
              if (i >= 0 && i < opcoes.length) out.push(opcoes[i]);
            }
            return out.join(', ');
          }
          // legado
          for (const lab of opcoes) {
            if (selecionados.labels.has(lab)) out.push(lab);
          }
          return out.join(', ');
        };

        const toggleOpcao = (idx: number) => {
          setRespostas((prev) => {
            const rawAtual = prev[String(pergunta.id)];
            const atualParsed = parseSelecionados(rawAtual);

            // Normaliza estado atual sempre para tokens
            const tokenSet = new Set<string>();
            if (atualParsed.tokens.size > 0) {
              for (const t of atualParsed.tokens) tokenSet.add(t);
            } else if (atualParsed.indices.size > 0) {
              for (const i of atualParsed.indices) {
                if (i >= 0 && i < opcoes.length) tokenSet.add(tokenFor(i, opcoes[i]));
              }
            } else if (atualParsed.labels.size > 0) {
              for (let i = 0; i < opcoes.length; i++) {
                if (atualParsed.labels.has(opcoes[i])) tokenSet.add(tokenFor(i, opcoes[i]));
              }
            }

            const label = opcoes[idx];
            if (!label) return prev;
            const tok = tokenFor(idx, label);
            if (tokenSet.has(tok)) tokenSet.delete(tok);
            else tokenSet.add(tok);

            return {
              ...prev,
              [String(pergunta.id)]: JSON.stringify(Array.from(tokenSet)),
            };
          });
        };

        return bloqueado ? (
          <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
            {formatSelecionados() ? formatSelecionados() : '—'}
          </div>
        ) : (
          <div className="space-y-2">
            {opcoes.map((opcao, idx) => {
              const id = `chk_${pergunta.id}_${idx}`;
              return (
              <div key={`${idx}-${opcao}`} className="flex items-center gap-3">
                <input
                  id={id}
                  type="checkbox"
                  checked={isChecked(idx, opcao)}
                  onChange={() => toggleOpcao(idx)}
                  className="w-5 h-5 text-cyan-600 border-gray-300 rounded focus:ring-2 focus:ring-cyan-500"
                />
                <label htmlFor={id} className="text-gray-700 hover:text-gray-900 cursor-pointer select-none">
                  {stripToken(opcao)}
                </label>
              </div>
            );})}
            {opcoes.length === 0 && (
              <div className="text-sm text-gray-500 italic">Nenhuma opção configurada</div>
            )}
          </div>
        );
      }

      case 'cpf': {
        const cpfDigits = String(valor || '').replace(/\D/g, '');
        const cpfIncompleto = cpfDigits.length > 0 && cpfDigits.length < 11;
        return bloqueado ? (
          <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
            {isEmpty ? '—' : String(valor)}
          </div>
        ) : (
          <div>
            <input
              type="text"
              inputMode="numeric"
              value={safeValue(valor)}
              onChange={(e) => handleRespostaChange(pergunta.id, maskCPF(e.target.value))}
              maxLength={14}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-cyan-500 ${cpfIncompleto ? 'border-red-400' : 'border-gray-300'}`}
              required={pergunta.obrigatorio}
              placeholder="000.000.000-00"
            />
            {cpfIncompleto && (
              <p className="text-xs text-red-500 mt-1">CPF incompleto — faltam {11 - cpfDigits.length} dígito(s)</p>
            )}
          </div>
        );
      }

      case 'cnpj': {
        const cnpjDigits = String(valor || '').replace(/\D/g, '');
        const cnpjIncompleto = cnpjDigits.length > 0 && cnpjDigits.length < 14;
        return bloqueado ? (
          <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
            {isEmpty ? '—' : String(valor)}
          </div>
        ) : (
          <div>
            <input
              type="text"
              inputMode="numeric"
              value={safeValue(valor)}
              onChange={(e) => handleRespostaChange(pergunta.id, maskCNPJ(e.target.value))}
              maxLength={18}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-cyan-500 ${cnpjIncompleto ? 'border-red-400' : 'border-gray-300'}`}
              required={pergunta.obrigatorio}
              placeholder="00.000.000/0000-00"
            />
            {cnpjIncompleto && (
              <p className="text-xs text-red-500 mt-1">CNPJ incompleto — faltam {14 - cnpjDigits.length} dígito(s)</p>
            )}
          </div>
        );
      }

      case 'cep': {
        const cepDigits = String(valor || '').replace(/\D/g, '');
        const cepIncompleto = cepDigits.length > 0 && cepDigits.length < 8;
        return bloqueado ? (
          <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
            {isEmpty ? '—' : String(valor)}
          </div>
        ) : (
          <div>
            <input
              type="text"
              inputMode="numeric"
              value={safeValue(valor)}
              onChange={(e) => handleRespostaChange(pergunta.id, maskCEP(e.target.value))}
              maxLength={9}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-cyan-500 ${cepIncompleto ? 'border-red-400' : 'border-gray-300'}`}
              required={pergunta.obrigatorio}
              placeholder="00000-000"
            />
            {cepIncompleto && (
              <p className="text-xs text-red-500 mt-1">CEP incompleto — faltam {8 - cepDigits.length} dígito(s)</p>
            )}
          </div>
        );
      }

      case 'money':
        return bloqueado ? (
          <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
            {isEmpty ? '—' : String(valor)}
          </div>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            value={safeValue(valor)}
            onChange={(e) => handleRespostaChange(pergunta.id, maskMoney(e.target.value))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
            required={pergunta.obrigatorio}
            placeholder="R$ 0,00"
          />
        );

      case 'grupo_repetivel': {
        // Normalizar tipo das sub-perguntas (podem vir uppercase do DB)
        const subPerguntasRaw = pergunta.subPerguntas || [];
        const subPerguntas = subPerguntasRaw.map((sp: any) => ({
          ...sp,
          tipo: typeof sp.tipo === 'string' ? sp.tipo.toLowerCase() : (sp.tipo || 'text'),
        }));
        const gruposAtual: Record<string, any>[] = Array.isArray(valor) ? valor : [];

        // Determine how many groups to render
        let numGrupos = gruposAtual.length || 1;
        const modoRepeticao = pergunta.modoRepeticao || 'manual';
        const controladoPorId = pergunta.controladoPor;

        if (modoRepeticao === 'numero' && controladoPorId) {
          const valorControlador = respostas[String(controladoPorId)];
          const parsed = parseInt(String(valorControlador ?? ''), 10);
          if (Number.isFinite(parsed) && parsed > 0) {
            numGrupos = parsed;
          } else {
            numGrupos = 0;
          }
        }

        // Encontrar label da pergunta controladora para exibir dica
        const perguntaControladora = controladoPorId
          ? questionarioAtual.find((p) => p.id === controladoPorId)
          : null;

        console.log('[renderCampo] grupo_repetivel detalhes:', {
          perguntaId: pergunta.id,
          label: pergunta.label,
          modoRepeticao,
          controladoPor: controladoPorId,
          perguntaControladoraLabel: perguntaControladora?.label,
          subPerguntasCount: subPerguntas.length,
          subPerguntas: subPerguntas.map((s: any) => ({ id: s.id, label: s.label, tipo: s.tipo })),
          gruposAtualCount: gruposAtual.length,
          numGrupos,
          valorControlador: controladoPorId ? respostas[String(controladoPorId)] : 'N/A',
          todasRespostasKeys: Object.keys(respostas),
        });

        // Ensure gruposAtual has the right number of entries
        const gruposRender: Record<string, any>[] = [];
        for (let i = 0; i < numGrupos; i++) {
          gruposRender.push(gruposAtual[i] || {});
        }

        const atualizarGrupo = (index: number, subPerguntaId: number, subValor: any) => {
          const novoGrupos = [...gruposRender];
          novoGrupos[index] = { ...novoGrupos[index], [String(subPerguntaId)]: subValor };
          handleRespostaChange(pergunta.id, novoGrupos);
        };

        const adicionarGrupo = () => {
          handleRespostaChange(pergunta.id, [...gruposRender, {}]);
        };

        const removerGrupo = (index: number) => {
          const novoGrupos = gruposRender.filter((_, i) => i !== index);
          handleRespostaChange(pergunta.id, novoGrupos.length > 0 ? novoGrupos : [{}]);
        };

        if (bloqueado) {
          return (
            <div className="space-y-4">
              {gruposRender.length === 0 ? (
                <div className="w-full px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-900/70 text-gray-700 dark:text-slate-200">—</div>
              ) : gruposRender.map((grupo, gIdx) => (
                <div key={gIdx} className="border border-gray-200 dark:border-cyan-500/30 rounded-xl p-4 bg-gray-50 dark:bg-slate-900/70">
                  <h5 className="text-sm font-semibold text-gray-600 dark:text-cyan-200 mb-3 flex items-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-200 text-xs font-bold">{gIdx + 1}</span>
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {subPerguntas.map((sub) => (
                      <div key={sub.id}>
                        <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">{sub.label}</label>
                        {sub.tipo === 'file' ? (
                          (() => {
                            const subDocs = docsAnexadosPergunta(sub.id);
                            return subDocs.length === 0 ? (
                              <div className="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950/70 text-gray-500 dark:text-slate-400 text-sm">—</div>
                            ) : (
                              <div className="space-y-1">
                                {subDocs.map((doc: any) => (
                                  <div key={doc.id} className="relative flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm pr-20">
                                    <FileText size={14} className="text-blue-500 flex-shrink-0" />
                                    <span className="flex-1 truncate text-gray-800 min-w-0" title={doc.nome}>{formatarNomeArquivo(doc.nome)}</span>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                      <button type="button" onClick={() => visualizarDocumento(doc)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Visualizar">
                                        <Eye size={14} />
                                      </button>
                                      <button type="button" onClick={() => baixarDocumento(doc)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Baixar">
                                        <Download size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()
                        ) : (
                          <div className="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950/70 text-gray-700 dark:text-slate-200 text-sm">
                            {grupo[String(sub.id)] || '—'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        // Helper para renderizar um campo de sub-pergunta
        const renderSubCampo = (sub: any, grupo: Record<string, any>, gIdx: number) => {
          const subTipo = (typeof sub.tipo === 'string' ? sub.tipo.toLowerCase() : 'text');
          const subValor = grupo[String(sub.id)] || '';
          const baseSubCampoClass = 'w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm bg-white dark:bg-slate-950/85 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500';
          switch (subTipo) {
            case 'select':
              return (
                <select value={subValor} onChange={(e) => atualizarGrupo(gIdx, sub.id, e.target.value)} className={baseSubCampoClass}>
                  <option value="">Selecione...</option>
                  {(sub.opcoes || []).map((op: string, oIdx: number) => (<option key={oIdx} value={op}>{op}</option>))}
                </select>
              );
            case 'date':
              return <input type="date" value={subValor} onChange={(e) => atualizarGrupo(gIdx, sub.id, e.target.value)} className={baseSubCampoClass} />;
            case 'number':
              return <input type="number" value={subValor} onChange={(e) => atualizarGrupo(gIdx, sub.id, e.target.value)} className={baseSubCampoClass} placeholder="Digite um numero" />;
            case 'cpf':
              return <input type="text" value={subValor} onChange={(e) => atualizarGrupo(gIdx, sub.id, maskCPF(e.target.value))} maxLength={14} className={baseSubCampoClass} placeholder="000.000.000-00" />;
            case 'cnpj':
              return <input type="text" value={subValor} onChange={(e) => atualizarGrupo(gIdx, sub.id, maskCNPJ(e.target.value))} maxLength={18} className={baseSubCampoClass} placeholder="00.000.000/0000-00" />;
            case 'cep':
              return <input type="text" value={subValor} onChange={(e) => atualizarGrupo(gIdx, sub.id, maskCEP(e.target.value))} maxLength={9} className={baseSubCampoClass} placeholder="00000-000" />;
            case 'money':
              return <input type="text" value={subValor} onChange={(e) => atualizarGrupo(gIdx, sub.id, maskMoney(e.target.value))} className={baseSubCampoClass} placeholder="R$ 0,00" />;
            case 'boolean':
              return (
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700 dark:text-slate-200">
                    <input type="radio" name={`grupo_${pergunta.id}_${gIdx}_${sub.id}`} value="Sim" checked={subValor === 'Sim'} onChange={(e) => atualizarGrupo(gIdx, sub.id, e.target.value)} className="w-4 h-4 text-cyan-600 border-gray-300 dark:border-slate-600 dark:bg-slate-900" />
                    Sim
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700 dark:text-slate-200">
                    <input type="radio" name={`grupo_${pergunta.id}_${gIdx}_${sub.id}`} value="Nao" checked={subValor === 'Nao'} onChange={(e) => atualizarGrupo(gIdx, sub.id, e.target.value)} className="w-4 h-4 text-cyan-600 border-gray-300 dark:border-slate-600 dark:bg-slate-900" />
                    Nao
                  </label>
                </div>
              );
            case 'textarea':
              return <textarea value={subValor} onChange={(e) => atualizarGrupo(gIdx, sub.id, e.target.value.slice(0, 500))} maxLength={500} rows={3} className={`${baseSubCampoClass} resize-vertical`} placeholder="Digite sua resposta..." />;
            case 'phone':
              return <input type="tel" value={subValor} onChange={(e) => atualizarGrupo(gIdx, sub.id, maskTelefone(e.target.value))} maxLength={15} className={baseSubCampoClass} placeholder="(00) 00000-0000" />;
            case 'email':
              return <input type="email" value={subValor} onChange={(e) => atualizarGrupo(gIdx, sub.id, e.target.value)} className={baseSubCampoClass} placeholder="exemplo@email.com" />;
            case 'file': {
              const subDocs = docsAnexadosPergunta(sub.id);
              return (
                <div className="space-y-2">
                  {subDocs.length > 0 && (
                    <div className="space-y-1">
                      {subDocs.map((doc: any) => (
                        <div key={doc.id} className="relative flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm pr-24">
                          <FileText size={14} className="text-blue-500 flex-shrink-0" />
                          <span className="flex-1 truncate text-gray-800 min-w-0" title={doc.nome}>{formatarNomeArquivo(doc.nome)}</span>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                            <button
                              type="button"
                              onClick={() => visualizarDocumento(doc)}
                              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Visualizar documento"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => baixarDocumento(doc)}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Baixar documento"
                            >
                              <Download size={14} />
                            </button>
                            {!bloqueado && (
                              <button
                                type="button"
                                onClick={() => removerDocumento(doc.id)}
                                className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                title="Excluir documento"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!bloqueado && (
                    <button
                      type="button"
                      onClick={() => setShowUploadDocumento({ id: processoId, perguntaId: sub.id, perguntaLabel: sub.label, departamentoId })}
                      className="w-full px-3 py-2 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-blue-600 text-sm font-medium"
                    >
                      <Upload size={15} />
                      {subDocs.length > 0 ? 'Adicionar Mais Arquivos' : 'Anexar Arquivo'}
                    </button>
                  )}
                </div>
              );
            }
            default:
              return <input type="text" value={subValor} onChange={(e) => atualizarGrupo(gIdx, sub.id, e.target.value.slice(0, 200))} maxLength={200} className={baseSubCampoClass} placeholder="Digite sua resposta..." />;
          }
        };

        return (
          <div className="space-y-4">
            {modoRepeticao === 'numero' && controladoPorId && (
              <div className="flex items-center gap-3 px-4 py-3 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-xl">
                <label className="text-sm font-medium text-cyan-700 dark:text-cyan-200">Quantidade:</label>
                <input
                  type="number"
                  min={0}
                  value={numGrupos || ''}
                  onChange={(e) => handleRespostaChange(controladoPorId, e.target.value)}
                  className="w-20 px-3 py-2 border border-cyan-300 dark:border-cyan-500/40 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm bg-white dark:bg-slate-950/85 text-gray-800 dark:text-slate-100 text-center"
                  placeholder="0"
                />
              </div>
            )}

            {/* Mensagem quando tem grupos mas nenhuma sub-pergunta */}
            {numGrupos > 0 && subPerguntas.length === 0 && (
              <div className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl bg-gray-50 dark:bg-slate-900/70 text-gray-500 dark:text-slate-300 text-sm text-center">
                Este grupo nao possui sub-perguntas configuradas. Edite o questionario para adicionar sub-perguntas.
              </div>
            )}

            {gruposRender.map((grupo, gIdx) => (
              <div key={gIdx} className="border-2 border-cyan-200 dark:border-cyan-500/35 rounded-xl p-4 bg-cyan-50/30 dark:bg-slate-900/80">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-semibold text-cyan-700 dark:text-cyan-200 flex items-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-cyan-600 dark:bg-cyan-500/25 text-white dark:text-cyan-100 text-xs font-bold">{gIdx + 1}</span>
                  </h5>
                  {modoRepeticao === 'manual' && gruposRender.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerGrupo(gIdx)}
                      className="p-1.5 text-red-500 dark:text-rose-300 hover:bg-red-50 dark:hover:bg-rose-500/15 rounded-lg transition-colors"
                      title="Remover grupo"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {subPerguntas.map((sub: any) => {
                    // Avalia condicional da sub-pergunta contra as OUTRAS sub-perguntas DENTRO DO MESMO GRUPO/ÍNDICE
                    if (sub.condicao && sub.condicao.perguntaId) {
                      const valorDep = grupo[String(sub.condicao.perguntaId)];
                      const valorDepStr = String(valorDep ?? '').trim();
                      const valorEsperado = String(sub.condicao.valor ?? '').trim();
                      let mostrar = false;
                      if (sub.condicao.operador === 'igual') {
                        mostrar = valorDepStr === valorEsperado;
                      } else if (sub.condicao.operador === 'diferente') {
                        mostrar = valorDepStr !== valorEsperado && valorDepStr !== '';
                      } else if (sub.condicao.operador === 'contem') {
                        mostrar = valorDepStr.toLowerCase().includes(valorEsperado.toLowerCase()) && valorDepStr !== '';
                      }
                      if (!mostrar) return null;
                    }
                    return (
                      <div key={sub.id}>
                        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                          {sub.label}
                          {sub.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {renderSubCampo(sub, grupo, gIdx)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {modoRepeticao === 'manual' && (
              <button
                type="button"
                onClick={adicionarGrupo}
                className="w-full px-4 py-3 border-2 border-dashed border-cyan-300 dark:border-cyan-500/40 rounded-xl hover:border-cyan-500 dark:hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-all flex items-center justify-center gap-2 text-cyan-600 dark:text-cyan-300 hover:text-cyan-700 dark:hover:text-cyan-200 font-medium"
              >
                <Plus size={18} />
                Adicionar Grupo
              </button>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (!processo || !departamento) {
    return null;
  }

  const respostasAnteriores: Array<{ deptId: number; etapa: number; chave: string; dados: any }> = [];
  try {
    const fluxoIds: number[] = Array.isArray((processo as any)?.fluxoDepartamentos)
      ? ((processo as any).fluxoDepartamentos as any[]).map((x: any) => Number(x)).filter((x: any) => Number.isFinite(x))
      : [];

    // Quando o mesmo dept aparece mais de uma vez no fluxo, precisamos achar a
    // ocorrência exata da etapa atual (ex.: 2ª aparição do Financeiro), não
    // a primeira via findIndex. Também queremos preservar duplicatas das etapas
    // anteriores no fluxo (Financeiro 1ª etapa deve aparecer antes do Cadastro,
    // mesmo quando estamos olhando o Financeiro 2ª etapa).
    let idxNoFluxo = -1;
    {
      let count = 0;
      for (let i = 0; i < fluxoIds.length; i++) {
        if (fluxoIds[i] === Number(departamentoId)) {
          count += 1;
          if (count === Number(etapaDoDeptExibido) || (count === 1 && !etapaDoDeptExibido)) {
            idxNoFluxo = i;
            break;
          }
        }
      }
    }

    type Ocorrencia = { deptId: number; etapa: number };
    let ocorrencias: Ocorrencia[] = [];

    if (idxNoFluxo >= 0) {
      // Ocorrências anteriores no fluxo (preservando duplicatas, com etapa correta).
      const contagem = new Map<number, number>();
      for (let i = 0; i < idxNoFluxo; i++) {
        const id = fluxoIds[i];
        const etapa = (contagem.get(id) || 0) + 1;
        contagem.set(id, etapa);
        ocorrencias.push({ deptId: id, etapa });
      }
    } else {
      // Sem informação clara de fluxo: derive apenas dos departamentos anteriores
      // usando a ordem presente em `departamentos` (fallback seguro, sem etapa).
      const allHistoric = Object.keys(processo.respostasHistorico || {})
        .map((k) => {
          const partes = String(k).split(':');
          return { deptId: Number(partes[0]), etapa: Number(partes[1] || 1) };
        })
        .filter((x) => Number.isFinite(x.deptId) && x.deptId !== Number(departamentoId));

      const idxByDeptList = departamentos.findIndex((d) => Number(d?.id) === Number(departamentoId));
      if (idxByDeptList >= 0) {
        const earlierDeptIds = new Set(departamentos.slice(0, idxByDeptList).map((d) => Number(d.id)));
        ocorrencias = allHistoric.filter((x) => earlierDeptIds.has(x.deptId));
      }
    }

    ocorrencias.forEach(({ deptId: deptIdNum, etapa }) => {
      if (deptIdNum === Number(departamentoId) && etapa === Number(etapaDoDeptExibido)) return;

      const chave = etapa === 1 ? String(deptIdNum) : `${deptIdNum}:${etapa}`;
      const qpd: any = (processo as any)?.questionariosPorDepartamento || {};
      const respHist: any = processo.respostasHistorico || {};

      // Lookup por chave composta, com fallback p/ formato antigo (apenas deptId)
      // pra manter compatibilidade caso o backend ainda não tenha sido atualizado.
      const dados = respHist[chave] ?? (etapa === 1 ? respHist[String(deptIdNum)] : null) ?? {};

      const questionarioDepto: Questionario[] =
        (Array.isArray(dados?.questionario) ? dados.questionario : null) ||
        (Array.isArray(qpd[chave])
          ? qpd[chave]
          : (etapa === 1 && Array.isArray(qpd[String(deptIdNum)]) ? qpd[String(deptIdNum)] : []));

      const respostasDepto: Record<string, any> = (dados?.respostas as any) || {};

      const hasRespostas = Object.values(respostasDepto).some(
        (v: any) => v !== undefined && v !== null && String(v).trim() !== ''
      );

      const hasAnexos = questionarioDepto.some((p: any) => {
        if (p?.tipo !== 'file') return false;
        return docsAnexadosPerguntaNoDepartamento(deptIdNum, Number(p.id)).length > 0;
      });

      const hasAlgumDocNoDept = (processo?.documentos || []).some((d: any) => {
        const dDept = Number(d?.departamentoId ?? d?.departamento_id);
        return Number.isFinite(dDept) && dDept === deptIdNum;
      });

      // Exibe dept anterior se houver respostas OU anexos (mesmo que o questionário não tenha sido salvo)
      if (hasRespostas || hasAnexos || hasAlgumDocNoDept) {
        respostasAnteriores.push({
          deptId: deptIdNum,
          etapa,
          chave,
          dados: {
            ...dados,
            questionario: questionarioDepto,
            respostas: respostasDepto,
          },
        });
      }
    });
  } catch {
    // noop
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
      {Object.keys(respostas || {}).length > 0 && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-[9999]">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} />
          </div>
        </div>
      )}

      <div
        ref={modalContainerRef}
        className="bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative"
      >
        <LoadingOverlay show={salvandoRespostas} text="Salvando respostas..." />
        <div className={`bg-gradient-to-r ${departamento.cor} p-6 rounded-t-2xl`}>
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                {(() => {
                  const Icone = getDepartamentoIcone(departamento.icone);
                  return Icone ? (
                    <Icone className="w-6 h-6 text-white" />
                  ) : (
                    <MessageSquare className="w-6 h-6 text-white" />
                  );
                })()}
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-white truncate">Questionário - {departamento.nome}</h3>
                <p className="text-white opacity-90 text-sm mt-1 truncate">{processo?.nomeEmpresa}</p>
              </div>
            </div>

            <button
              onClick={handleFecharModal}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors flex-shrink-0"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            handleSalvar();
          }}
          className="p-6"
        >
          {respostasAnteriores.length > 0 && (
            <div className="mb-8 space-y-6">
              <h4 className="font-semibold text-gray-800 dark:text-[var(--fg)] mb-4 flex items-center gap-2 text-lg">
                <Eye size={18} className="text-blue-500" />
                {somenteLeitura
                  ? 'Respostas do Questionário'
                  : 'Respostas de Departamentos Anteriores'}{' '}
                (somente leitura)
              </h4>

              {respostasAnteriores.map(({ deptId, etapa, chave, dados }) => {
                const deptAnt = departamentos.find((d) => d.id === Number(deptId));
                if (!deptAnt) return null;
                // Badge "Nª etapa" só quando o dept aparece mais de uma vez no fluxo
                const totalNoFluxo = (Array.isArray((processo as any)?.fluxoDepartamentos)
                  ? ((processo as any).fluxoDepartamentos as any[])
                  : []
                ).filter((id: any) => Number(id) === Number(deptId)).length;
                const mostrarEtapaBadge = totalNoFluxo > 1;

                const questionarioDepto: Questionario[] = (dados?.questionario as any) || [];
                const respostasDepto: Record<string, any> = (dados?.respostas as any) || {};

                const docsDept = (processo?.documentos || []).filter((d: any) => {
                  const dDept = Number(d?.departamentoId ?? d?.departamento_id);
                  return Number.isFinite(dDept) && dDept === Number(deptId);
                });

                // Se não temos a estrutura do questionário (pode acontecer se não foi salvo),
                // ainda assim mostramos os documentos anexados ao departamento.
                if (questionarioDepto.length === 0) {
                  if (!docsDept.length) return null;

                  return (
                    <div
                      key={chave}
                      className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-[var(--muted)] dark:to-[var(--card)] rounded-xl p-6 border-2 border-blue-200 dark:border-[var(--border)] shadow-sm"
                    >
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-blue-200 dark:border-[var(--border)]">
                        <div
                          className={`w-12 h-12 rounded-lg bg-gradient-to-br ${deptAnt.cor} flex items-center justify-center`}
                        >
                          {(() => {
                            const Icone = getDepartamentoIcone(deptAnt.icone);
                            return Icone ? (
                              <Icone size={20} className="text-white" />
                            ) : (
                              <MessageSquare size={20} className="text-white" />
                            );
                          })()}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-bold text-gray-800 text-lg flex items-center gap-2 flex-wrap">
                            <span>{deptAnt.nome}</span>
                            {mostrarEtapaBadge && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold">
                                {etapa}ª etapa
                              </span>
                            )}
                          </h5>
                          {dados?.respondidoEm && (
                            <p className="text-sm text-gray-600">
                              Respondido por <span className="font-medium">{dados?.respondidoPor}</span> em{' '}
                              {formatarDataHora(dados.respondidoEm)}
                            </p>
                          )}
                        </div>
                        <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                          {docsDept.length} documento(s)
                        </span>
                      </div>

                      <div className="space-y-2">
                        {docsDept.map((doc: any) => (
                          <div
                            key={doc.id}
                            className="relative flex items-center justify-between bg-white dark:bg-[var(--card)] border border-blue-100 dark:border-[var(--border)] rounded-lg p-3 pr-20"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText size={20} className="text-blue-600 flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="font-medium text-sm text-gray-900 truncate max-w-[calc(100%-96px)]" title={doc.nome}>{formatarNomeArquivo(doc.nome)}</div>
                                <div className="text-xs text-gray-500">{formatarDataHora(doc.dataUpload)}</div>
                              </div>
                            </div>
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => visualizarDocumento(doc)}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                                title="Visualizar"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => baixarDocumento(doc)}
                                className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-[var(--muted)] rounded-lg"
                                title="Baixar"
                              >
                                <Download size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                const camposControladoresDepto = new Set(
                  questionarioDepto
                    .filter((p) => p.tipo === 'grupo_repetivel' && p.modoRepeticao === 'numero' && p.controladoPor)
                    .map((p) => p.controladoPor!)
                );

                const deveAparecerNaVisualizacao = (pergunta: Questionario) => {
                  if (camposControladoresDepto.has(pergunta.id)) return false;
                  if (!pergunta.condicao) return true;
                  const { perguntaId, operador, valor } = pergunta.condicao;
                  const respostaCondicional = respostasDepto[String(perguntaId)];
                  if (respostaCondicional === undefined || respostaCondicional === null || respostaCondicional === '') {
                    return false;
                  }
                  const r = String(respostaCondicional).trim().toLowerCase();
                  const v = String(valor).trim().toLowerCase();
                  switch (operador) {
                    case 'igual':
                      return r === v;
                    case 'diferente':
                      return r !== v;
                    case 'contem':
                      return r.includes(v);
                    default:
                      return true;
                  }
                };

                const perguntasVisiveis = questionarioDepto.filter((p) => deveAparecerNaVisualizacao(p));
                if (perguntasVisiveis.length === 0) return null;

                const pares: Questionario[][] = [];
                for (let i = 0; i < perguntasVisiveis.length; i += 2) {
                  pares.push(perguntasVisiveis.slice(i, i + 2));
                }

                return (
                  <div
                    key={chave}
                    className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-[var(--muted)] dark:to-[var(--card)] rounded-xl p-6 border-2 border-blue-200 dark:border-[var(--border)] shadow-sm"
                  >
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-blue-200 dark:border-[var(--border)]">
                      <div
                        className={`w-12 h-12 rounded-lg bg-gradient-to-br ${deptAnt.cor} flex items-center justify-center`}
                      >
                        {(() => {
                          const Icone = getDepartamentoIcone(deptAnt.icone);
                          return Icone ? (
                            <Icone size={20} className="text-white" />
                          ) : (
                            <MessageSquare size={20} className="text-white" />
                          );
                        })()}
                      </div>
                      <div className="flex-1">
                        <h5 className="font-bold text-gray-800 text-lg flex items-center gap-2 flex-wrap">
                          <span>{deptAnt.nome}</span>
                          {mostrarEtapaBadge && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold">
                              {etapa}ª etapa
                            </span>
                          )}
                        </h5>
                        {dados?.respondidoEm && (
                          <p className="text-sm text-gray-600">
                            Respondido por <span className="font-medium">{dados?.respondidoPor}</span> em{' '}
                            {formatarDataHora(dados.respondidoEm)}
                          </p>
                        )}
                      </div>
                      <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        {perguntasVisiveis.length} respostas
                      </span>
                    </div>

                    <div className="space-y-4">
                      {pares.map((par, idx) => (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {par.map((pergunta) => {
                            const resposta = respostasDepto[String(pergunta.id)];
                            return (
                              <div
                                key={pergunta.id}
                                className="bg-white dark:bg-[var(--card)] rounded-lg p-4 border border-blue-100 dark:border-[var(--border)] shadow-sm h-full flex flex-col"
                              >
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  {pergunta.label}
                                  {pergunta.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                                  {pergunta.condicao && (
                                    <span className="ml-2 text-xs text-blue-600"> Condicional</span>
                                  )}
                                </label>

                                <div className="flex-1">
                                  {pergunta.tipo === 'file' ? (
                                    <div className="space-y-2">
                                      {(() => {
                                            const docs = docsAnexadosPerguntaNoDepartamento(Number(deptId), pergunta.id);
                                            if (docs.length > 0) {
                                              return docs.map((doc: any) => (
                                                <div
                                                  key={doc.id}
                                                  className="relative flex items-center justify-between bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-[var(--border)] rounded-lg p-3 w-full overflow-hidden pr-20"
                                                >
                                                  <div className="flex items-center gap-3 flex-1">
                                                    <FileText size={20} className="text-blue-600" />
                                                    <div className="flex-1 min-w-0">
                                                      <div className="font-medium text-sm text-gray-900 truncate max-w-[calc(100%-96px)]" title={doc.nome}>
                                                          {formatarNomeArquivo(doc.nome)}
                                                        </div>
                                                      <div className="text-xs text-gray-500">
                                                        {formatarTamanhoParcela(Number(doc.tamanho || 0))}
                                                      </div>
                                                    </div>
                                                  </div>
                                                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() => visualizarDocumento(doc)}
                                                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                                                      title="Visualizar"
                                                    >
                                                      <Eye size={16} />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => baixarDocumento(doc)}
                                                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                                      title="Baixar"
                                                    >
                                                      <Download size={16} />
                                                    </button>
                                                  </div>
                                                </div>
                                              ));
                                            }

                                            // Se não há anexos visíveis, verificar se existem anexos restritos no backend
                                            const counts: Record<string, number> = (processo as any)?.documentosCounts ?? {};
                                            const keySpecific = `${pergunta.id}:${deptId}`;
                                            const keyAny = `${pergunta.id}:0`;
                                            const total = Number(counts[keySpecific] ?? counts[keyAny] ?? 0);
                                            if (total > 0) {
                                              return (
                                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center text-sm text-gray-700 flex items-center justify-center gap-2">
                                                  <CheckCircle size={16} className="text-green-500" />
                                                  <span>Respondido — anexo enviado (sem permissão para visualizar)</span>
                                                </div>
                                              );
                                            }

                                            return (
                                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center text-sm text-gray-500">
                                                Nenhum arquivo anexado
                                              </div>
                                            );
                                      })()}
                                    </div>
                                  ) : resposta === undefined || resposta === null || String(resposta).trim() === '' ? (
                                    <div className="bg-yellow-50 border border-yellow-200 dark:bg-yellow-500/10 dark:border-[var(--border)] rounded-lg p-3 text-center text-sm text-yellow-700 dark:text-yellow-200 h-full flex items-center justify-center">
                                      ⚠️ Não respondido
                                    </div>
                                  ) : pergunta.tipo === 'textarea' ? (
                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 whitespace-pre-wrap text-sm text-gray-800 h-full">
                                      {String(resposta)}
                                    </div>
                                  ) : pergunta.tipo === 'select' ? (
                                    <div className="bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-[var(--fg)] px-3 py-2 rounded-lg text-sm font-medium inline-block">
                                      {String(resposta)}
                                    </div>
                                  ) : pergunta.tipo === 'checkbox' ? (
                                    <div className="bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-[var(--fg)] px-3 py-2 rounded-lg text-sm font-medium inline-block">
                                      {(() => {
                                        try {
                                          const valores = typeof resposta === 'string' ? JSON.parse(resposta) : resposta;
                                          if (Array.isArray(valores)) {
                                            return valores
                                              .map((v: any) => {
                                                const s = String(v ?? '');
                                                const m = s.match(/^\d+\|(.*)$/);
                                                return m ? m[1] : s;
                                              })
                                              .filter((x: string) => x.trim())
                                              .join(', ');
                                          }
                                          return String(resposta);
                                        } catch {
                                          return String(resposta);
                                        }
                                      })()}
                                    </div>
                                  ) : pergunta.tipo === 'boolean' ? (
                                    <div
                                      className={`${String(resposta) === 'Sim'
                                        ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-[var(--fg)]'
                                        : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-[var(--fg)]'} px-3 py-2 rounded-lg text-sm font-medium inline-block`}
                                    >
                                      {String(resposta)}
                                    </div>
                                  ) : (
                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm text-gray-800 h-full">
                                      {String(resposta)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <hr className="my-6 border-gray-300 dark:border-[var(--border)]" />
            </div>
          )}

          {carregandoProcesso ? (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600 mb-2">Carregando questionário…</p>
              <p className="text-sm text-gray-500">Buscando detalhes desta solicitação.</p>
            </div>
          ) : questionarioAtual.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600 mb-4">Esta solicitação não possui questionário ainda.</p>
              <p className="text-sm text-gray-500">O questionário será adicionado ao criar a solicitação.</p>
            </div>
          ) : somenteLeitura ? (
            <div className="mb-8">
              <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-lg">
                <Eye size={18} className="text-blue-500" />
                Respostas do Questionário (somente leitura)
              </h4>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-[var(--muted)] dark:to-[var(--card)] rounded-xl p-6 border-2 border-blue-200 dark:border-[var(--border)] shadow-sm">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-blue-200 dark:border-[var(--border)]">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${departamento.cor} flex items-center justify-center`}>
                    {(() => {
                      const Icone = getDepartamentoIcone(departamento.icone);
                      return Icone ? (
                        <Icone size={20} className="text-white" />
                      ) : (
                        <MessageSquare size={20} className="text-white" />
                      );
                    })()}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-bold text-gray-800 text-lg">{departamento.nome}</h5>
                    {processo.respostasHistorico?.[departamentoId]?.respondidoEm && (
                      <p className="text-sm text-gray-600">
                        Respondido por{' '}
                        <span className="font-medium">
                          {processo.respostasHistorico?.[departamentoId]?.respondidoPor}
                        </span>{' '}
                        em {formatarDataHora(processo.respostasHistorico?.[departamentoId]?.respondidoEm as any)}
                      </p>
                    )}
                  </div>
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    {questionarioAtual.filter((p) => !camposControladores.has(p.id) && avaliarCondicao(p, respostas)).length} respostas
                  </span>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const perguntasVisiveis = questionarioAtual.filter((p) => !camposControladores.has(p.id) && avaliarCondicao(p, respostas));
                    // Agrupar em pares, mas quebrar em cada 'titulo' para que seja renderizado em linha cheia
                    const blocos: Array<{ tipo: 'titulo'; pergunta: Questionario } | { tipo: 'par'; par: Questionario[] }> = [];
                    let bufferPar: Questionario[] = [];
                    const flushPar = () => {
                      for (let i = 0; i < bufferPar.length; i += 2) {
                        blocos.push({ tipo: 'par', par: bufferPar.slice(i, i + 2) });
                      }
                      bufferPar = [];
                    };
                    for (const p of perguntasVisiveis) {
                      if (p.tipo === 'titulo') {
                        flushPar();
                        blocos.push({ tipo: 'titulo', pergunta: p });
                      } else {
                        bufferPar.push(p);
                      }
                    }
                    flushPar();
                    return blocos.map((bloco, idx) => {
                      if (bloco.tipo === 'titulo') {
                        return (
                          <div key={`titulo-${bloco.pergunta.id}-${idx}`} className="pt-2 pb-1 border-b-2 border-cyan-500 dark:border-cyan-400">
                            <h5 className="text-lg font-bold text-cyan-700 dark:text-cyan-200 uppercase tracking-wide">
                              {bloco.pergunta.label}
                            </h5>
                          </div>
                        );
                      }
                      return (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {bloco.par.map((pergunta) => {
                          const resposta = respostas[String(pergunta.id)];
                          return (
                            <div
                              key={pergunta.id}
                              className="bg-white dark:bg-[var(--card)] rounded-lg p-4 border border-blue-100 dark:border-[var(--border)] shadow-sm h-full flex flex-col"
                            >
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                {pergunta.label}
                                {pergunta.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                                {pergunta.condicao && (
                                  <span className="ml-2 text-xs text-blue-600"> Condicional</span>
                                )}
                              </label>
                              <div className="flex-1">
                                {pergunta.tipo === 'file' ? (
                                  renderCampo(pergunta)
                                ) : !resposta ? (
                                  <div className="bg-yellow-50 border border-yellow-200 dark:bg-yellow-500/10 dark:border-[var(--border)] rounded-lg p-3 text-center text-sm text-yellow-700 dark:text-yellow-200 h-full flex items-center justify-center">
                                    ⚠️ Não respondido
                                  </div>
                                ) : pergunta.tipo === 'textarea' ? (
                                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 whitespace-pre-wrap text-sm text-gray-800 h-full">
                                    {String(resposta)}
                                  </div>
                                ) : pergunta.tipo === 'select' ? (
                                  <div className="bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-[var(--fg)] px-3 py-2 rounded-lg text-sm font-medium inline-block">
                                    {String(resposta)}
                                  </div>
                                ) : pergunta.tipo === 'checkbox' ? (
                                  <div className="bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-[var(--fg)] px-3 py-2 rounded-lg text-sm font-medium inline-block">
                                    {(() => {
                                      try {
                                        const valores = typeof resposta === 'string' ? JSON.parse(resposta) : resposta;
                                        if (Array.isArray(valores)) {
                                          return valores
                                            .map((v: any) => {
                                              const s = String(v ?? '');
                                              const m = s.match(/^\d+\|(.*)$/);
                                              return m ? m[1] : s;
                                            })
                                            .filter((x: string) => x.trim())
                                            .join(', ');
                                        }
                                        return String(resposta);
                                      } catch {
                                        return String(resposta);
                                      }
                                    })()}
                                  </div>
                                ) : pergunta.tipo === 'boolean' ? (
                                  <div
                                      className={`${String(resposta) === 'Sim'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-[var(--fg)]'
                                      : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-[var(--fg)]'} px-3 py-2 rounded-lg text-sm font-medium inline-block`}
                                  >
                                    {String(resposta)}
                                  </div>
                                ) : (
                                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm text-gray-800 h-full">
                                    {String(resposta)}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          ) : (
            <>
              <h4 className="font-semibold text-gray-800 mb-6">Preencha o Questionário:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {questionarioAtual
                  .filter((p) => !camposControladores.has(p.id) && avaliarCondicao(p, respostas))
                  .map((pergunta) => {
                    if (pergunta.tipo === 'titulo') {
                      return (
                        <div key={pergunta.id} className="md:col-span-2 pt-2 pb-1 border-b-2 border-cyan-500 dark:border-cyan-400">
                          <h5 className="text-lg font-bold text-cyan-700 dark:text-cyan-200 uppercase tracking-wide">
                            {pergunta.label}
                          </h5>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={pergunta.id}
                        className={pergunta.tipo === 'textarea' || pergunta.tipo === 'file' || pergunta.tipo === 'grupo_repetivel' ? 'md:col-span-2' : ''}
                      >
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {pergunta.label}{' '}
                          {pergunta.obrigatorio && <span className="text-red-500">*</span>}
                        </label>
                        {renderCampo(pergunta)}
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleFecharModal}
              className="flex-1 min-h-[36px] px-4 py-1.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 hover:shadow-sm text-base font-medium transition-all duration-200"
            >
              Fechar
            </button>

            {!somenteLeitura && (processo?.status !== 'finalizado' || allowEditFinalizado) && (
              <button
                type="submit"
                disabled={salvandoRespostas}
                className="flex-1 min-h-[36px] px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 font-semibold flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                {salvandoRespostas ? 'Salvando...' : 'Salvar Questionário'}
              </button>
            )}

            {/* Botão Editar Quest. */}
            {!somenteLeitura && (processo?.status !== 'finalizado' || allowEditFinalizado) && setShowQuestionarioSolicitacao && (
              <button
                type="button"
                onClick={() => {
                  if (processo && departamento) {
                    setShowQuestionarioSolicitacao({ processoId: processo.id, departamentoId: departamento.id });
                  }
                }}
                className="flex-1 min-h-[36px] px-4 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 font-semibold flex items-center justify-center gap-2 text-base"
              >
                <Pencil size={16} /> Editar Quest.
              </button>
            )}

            {/* Botão Ver Detalhes da Empresa */}
            {setShowListarEmpresas && (
              <button
                type="button"
                onClick={() => {
                  const nome = (processo?.empresa || processo?.nomeEmpresa || '').toString();
                  const encontrada = (empresas || []).find(
                    (e: any) => e.id === processo?.empresaId || e.razao_social === nome || e.apelido === nome
                  );
                  setShowListarEmpresas({
                    tipo: 'cadastradas',
                    empresaId: encontrada?.id,
                  });
                }}
                className="flex-1 min-h-[36px] px-4 py-1.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 font-semibold flex items-center justify-center gap-2 text-base"
              >
                🏢 Ver Detalhes da Empresa
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
