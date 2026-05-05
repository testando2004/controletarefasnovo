'use client';

import React, { useState } from 'react';
import { X, ArrowRight, Edit, Plus, ClipboardList, Save, Workflow, Trash2, Copy } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import ModalBase from './ModalBase';
import LoadingOverlay from '../LoadingOverlay';

// Gera a chave de uma etapa do fluxo. Compatível com a estrutura antiga:
// a primeira aparição de um departamento usa só o id ("8"); a partir da
// segunda aparição usa sufixo ":ocorrencia" ("8:2", "8:3"...).
function chaveDaEtapa(fluxo: number[], idx: number): string {
  const deptId = fluxo[idx];
  let ocorrencia = 0;
  for (let i = 0; i <= idx; i++) {
    if (fluxo[i] === deptId) ocorrencia++;
  }
  return ocorrencia === 1 ? String(deptId) : `${deptId}:${ocorrencia}`;
}
function ocorrenciaDaEtapa(fluxo: number[], idx: number): number {
  const deptId = fluxo[idx];
  let c = 0;
  for (let i = 0; i <= idx; i++) {
    if (fluxo[i] === deptId) c++;
  }
  return c;
}
function totalOcorrenciasDept(fluxo: number[], deptId: number): number {
  return fluxo.filter((d) => d === deptId).length;
}

interface ModalAtividadeProps {
  onClose: () => void;
  templateToEdit?: any;
  modoEdicao?: 'normal' | 'copia';
}

/**
 * Modal "Atividade" - Substitui o antigo "Personalizada".
 * 
 * Aqui o usuário cria APENAS o questionário por departamento e define o fluxo.
 * NÃO tem empresa, responsável nem data.
 * 
 * Ao criar, vira um "Fluxo" salvo que pode ser usado como template  
 * em "Nova Solicitação" (onde aí sim terá empresa, responsável e data).
 */
export default function ModalAtividade({ onClose, templateToEdit, modoEdicao = 'copia' }: ModalAtividadeProps) {
  const editandoNoOriginal = !!templateToEdit && modoEdicao === 'normal';
  const { departamentos, usuarioLogado, criarTemplate, atualizarTemplate, mostrarAlerta, templates } = useSistema();

  // Parse template data for editing
  const parseTemplateData = (tmpl: any) => {
    if (!tmpl) return { nome: '', descricao: '', fluxo: [] as number[], qpd: {} as any };
    const fluxoRaw = tmpl.fluxoDepartamentos ?? tmpl.fluxo_departamentos;
    let fluxo: number[] = [];
    if (Array.isArray(fluxoRaw)) {
      fluxo = fluxoRaw.map(Number);
    } else if (typeof fluxoRaw === 'string') {
      try { fluxo = JSON.parse(fluxoRaw).map(Number); } catch { fluxo = []; }
    }
    const qpdRaw = tmpl.questionariosPorDepartamento ?? tmpl.questionarios_por_departamento;
    let qpd: any = {};
    if (qpdRaw && typeof qpdRaw === 'object' && !Array.isArray(qpdRaw)) {
      qpd = qpdRaw;
    } else if (typeof qpdRaw === 'string') {
      try { qpd = JSON.parse(qpdRaw); } catch { qpd = {}; }
    }
    // Ensure all qpd values have proper IDs
    for (const key of Object.keys(qpd)) {
      qpd[key] = (qpd[key] || []).map((p: any, idx: number) => ({
        ...p,
        id: p.id || Date.now() + idx,
      }));
    }
    // Filtra IDs órfãos: templates que foram excluídos não devem aparecer nas interligações.
    const idsValidos = new Set<number>(
      (templates || [])
        .map((t: any) => Number(t?.id))
        .filter((x: number) => Number.isFinite(x))
    );
    const interligIds = Array.isArray(tmpl?.interligacaoTemplateIds)
      ? tmpl.interligacaoTemplateIds
          .map(Number)
          .filter((x: any) => Number.isFinite(x) && idsValidos.has(x))
      : [];
    const interligGrupos: Array<{ modo: 'sequencial' | 'paralelo'; templateIds: number[] }> = Array.isArray(tmpl?.interligacaoGrupos)
      ? tmpl.interligacaoGrupos
          .map((g: any) => ({
            modo: (g?.modo === 'paralelo' ? 'paralelo' : 'sequencial') as 'sequencial' | 'paralelo',
            templateIds: Array.isArray(g?.templateIds)
              ? g.templateIds
                  .map(Number)
                  .filter((x: any) => Number.isFinite(x) && idsValidos.has(x))
              : [],
          }))
          .filter((g: any) => g.templateIds.length > 0)
      : [];
    const depsRaw = tmpl?.dependenciasDept;
    const dependencias: Record<string, string[]> = depsRaw && typeof depsRaw === 'object' && !Array.isArray(depsRaw)
      ? Object.fromEntries(
          Object.entries(depsRaw)
            .filter(([, v]) => Array.isArray(v))
            .map(([k, v]) => [String(k), (v as any[]).map(String).filter((s) => s.trim() !== '')])
            .filter(([, v]) => (v as string[]).length > 0)
        )
      : {};
    return {
      nome: modoEdicao === 'normal' ? (tmpl.nome || '') : (tmpl.nome || '') + ' (cópia)',
      descricao: tmpl.descricao || '',
      fluxo,
      qpd,
      interligIds,
      interligParalelo: Boolean(tmpl?.interligacaoParalelo),
      interligGrupos,
      dependencias,
    };
  };

  const editData = parseTemplateData(templateToEdit);

  const [nomeAtividade, setNomeAtividade] = useState(editData.nome);
  const [descricao, setDescricao] = useState(editData.descricao);
  const [questionariosPorDept, setQuestionariosPorDept] = useState<any>(editData.qpd);
  // Índice da etapa selecionada no fluxo (um dept pode aparecer múltiplas vezes com perguntas diferentes).
  const [etapaSelecionadaIdx, setEtapaSelecionadaIdx] = useState<number | null>(null);
  const [editandoPergunta, setEditandoPergunta] = useState<any>(null);
  const [fluxoDepartamentos, setFluxoDepartamentos] = useState<number[]>(editData.fluxo);
  const [loading, setLoading] = useState(false);
  const [interligacaoTemplateIds, setInterligacaoTemplateIds] = useState<number[]>(editData.interligIds || []);
  const [interligacaoParalelo, setInterligacaoParalelo] = useState<boolean>(editData.interligParalelo || false);
  // Grupos (sequencial / paralelo) - se vazio, cai na lógica antiga (tudo sequencial)
  const [interligacaoGrupos, setInterligacaoGrupos] = useState<Array<{ modo: 'sequencial' | 'paralelo'; templateIds: number[] }>>(
    (editData as any).interligGrupos || []
  );
  // Dependências entre etapas do fluxo (Fase 3). Mapa chaveEtapa -> lista de chaves de que depende.
  const [dependenciasDept, setDependenciasDept] = useState<Record<string, string[]>>(
    (editData as any).dependencias || {}
  );

  // Derivados da etapa selecionada
  const etapaSelecionadaDeptId = etapaSelecionadaIdx != null && etapaSelecionadaIdx >= 0 && etapaSelecionadaIdx < fluxoDepartamentos.length
    ? fluxoDepartamentos[etapaSelecionadaIdx]
    : null;
  const etapaSelecionadaChave = etapaSelecionadaIdx != null && etapaSelecionadaIdx >= 0 && etapaSelecionadaIdx < fluxoDepartamentos.length
    ? chaveDaEtapa(fluxoDepartamentos, etapaSelecionadaIdx)
    : null;
  // Para compatibilidade com código antigo que verificava "departamentoSelecionado".
  const departamentoSelecionado: number | null = etapaSelecionadaDeptId;

  const tiposCampo = [
    { valor: 'titulo', label: 'Título (cabeçalho de seção)' },
    { valor: 'text', label: 'Texto Simples' },
    { valor: 'textarea', label: 'Texto Longo' },
    { valor: 'number', label: 'Número' },
    { valor: 'date', label: 'Data' },
    { valor: 'boolean', label: 'Sim/Não' },
    { valor: 'select', label: 'Seleção Única' },
    { valor: 'checkbox', label: 'Checklist' },
    { valor: 'file', label: 'Arquivo/Anexo' },
    { valor: 'phone', label: 'Telefone' },
    { valor: 'email', label: 'Email' },
    { valor: 'cpf', label: 'CPF' },
    { valor: 'cnpj', label: 'CNPJ' },
    { valor: 'cep', label: 'CEP' },
    { valor: 'money', label: 'Valor (R$)' },
    { valor: 'grupo_repetivel', label: 'Grupo Repetível' },
  ];

  // Adiciona uma nova etapa no fluxo (aceita duplicatas — o mesmo dept pode aparecer
  // múltiplas vezes com perguntas diferentes, ex.: CADASTRO → FINANCEIRO → CADASTRO)
  const adicionarDepartamentoAoFluxo = (deptId: number) => {
    const novoFluxo = [...fluxoDepartamentos, deptId];
    setFluxoDepartamentos(novoFluxo);
    const novaChave = chaveDaEtapa(novoFluxo, novoFluxo.length - 1);
    setQuestionariosPorDept({
      ...questionariosPorDept,
      [novaChave]: [],
    });
    setEtapaSelecionadaIdx(novoFluxo.length - 1);
  };

  // Duplica uma etapa — adiciona o mesmo dept novamente no fim do fluxo, com perguntas vazias
  const duplicarEtapaNoFluxo = (deptId: number) => {
    adicionarDepartamentoAoFluxo(deptId);
  };

  // Remove uma etapa específica por índice (não o dept inteiro).
  const removerEtapaDoFluxo = (idx: number) => {
    if (idx < 0 || idx >= fluxoDepartamentos.length) return;
    const chaveRemover = chaveDaEtapa(fluxoDepartamentos, idx);
    const deptId = fluxoDepartamentos[idx];
    const novoFluxo = fluxoDepartamentos.filter((_, i) => i !== idx);

    // Reindexa as chaves do dept removido (se havia múltiplas ocorrências)
    const novosQuestionarios: any = { ...questionariosPorDept };
    delete novosQuestionarios[chaveRemover];

    // Precisamos reindexar porque as ocorrências mudaram.
    const chavesDesteDept: string[] = [];
    fluxoDepartamentos.forEach((id, i) => {
      if (i !== idx && id === deptId) chavesDesteDept.push(chaveDaEtapa(fluxoDepartamentos, i));
    });
    const perguntasDesteDept = chavesDesteDept.map((c) => novosQuestionarios[c] || []);
    chavesDesteDept.forEach((c) => { delete novosQuestionarios[c]; });
    // Reatribui nas novas posições
    let pos = 0;
    novoFluxo.forEach((id, i) => {
      if (id === deptId) {
        const novaChave = chaveDaEtapa(novoFluxo, i);
        novosQuestionarios[novaChave] = perguntasDesteDept[pos] || [];
        pos++;
      }
    });

    setFluxoDepartamentos(novoFluxo);
    setQuestionariosPorDept(novosQuestionarios);
    if (etapaSelecionadaIdx === idx) {
      setEtapaSelecionadaIdx(null);
    } else if (etapaSelecionadaIdx != null && etapaSelecionadaIdx > idx) {
      setEtapaSelecionadaIdx(etapaSelecionadaIdx - 1);
    }
  };

  // Mantida para retrocompatibilidade com usos externos — remove TODAS as etapas deste dept.
  const removerDepartamentoDoFluxo = (deptId: number) => {
    const idxs = fluxoDepartamentos.map((id, i) => (id === deptId ? i : -1)).filter((i) => i >= 0);
    // Remove do último para o primeiro para não bagunçar os índices
    idxs.reverse().forEach((i) => removerEtapaDoFluxo(i));
  };

  // Move uma etapa no fluxo preservando TODOS os questionários de TODAS as etapas.
  // direcao: -1 (sobe) ou +1 (desce)
  const moverEtapaNoFluxo = (idx: number, direcao: -1 | 1) => {
    const destino = idx + direcao;
    if (idx < 0 || idx >= fluxoDepartamentos.length) return;
    if (destino < 0 || destino >= fluxoDepartamentos.length) return;

    // 1) Captura perguntas de cada etapa atual usando a chave atual
    const perguntasPorIdxAntigo: Array<any[]> = fluxoDepartamentos.map((_, i) => {
      const chave = chaveDaEtapa(fluxoDepartamentos, i);
      return questionariosPorDept[chave] || [];
    });

    // 2) Reordena o fluxo e as perguntas por posição
    const novoFluxo = [...fluxoDepartamentos];
    [novoFluxo[idx], novoFluxo[destino]] = [novoFluxo[destino], novoFluxo[idx]];
    const perguntasPorIdxNovo = [...perguntasPorIdxAntigo];
    [perguntasPorIdxNovo[idx], perguntasPorIdxNovo[destino]] = [perguntasPorIdxNovo[destino], perguntasPorIdxNovo[idx]];

    // 3) Remonta o dicionário usando as chaves novas (ocorrência pode ter mudado)
    const novosQuestionarios: any = {};
    novoFluxo.forEach((_, i) => {
      const novaChave = chaveDaEtapa(novoFluxo, i);
      novosQuestionarios[novaChave] = perguntasPorIdxNovo[i] || [];
    });

    setFluxoDepartamentos(novoFluxo);
    setQuestionariosPorDept(novosQuestionarios);

    // Ajusta o índice selecionado para seguir a etapa
    if (etapaSelecionadaIdx === idx) setEtapaSelecionadaIdx(destino);
    else if (etapaSelecionadaIdx === destino) setEtapaSelecionadaIdx(idx);
  };

  // Move uma pergunta dentro do questionário da etapa selecionada
  const moverPergunta = (perguntaId: number, direcao: -1 | 1) => {
    const chave = etapaSelecionadaChave;
    if (chave == null) return;
    const lista: any[] = questionariosPorDept[chave] || [];
    const idx = lista.findIndex((p: any) => p.id === perguntaId);
    if (idx < 0) return;
    const destino = idx + direcao;
    if (destino < 0 || destino >= lista.length) return;
    const nova = [...lista];
    [nova[idx], nova[destino]] = [nova[destino], nova[idx]];
    // Atualiza a "ordem" para refletir a nova posição (persiste na hora de salvar)
    const reordenada = nova.map((p: any, i: number) => ({ ...p, ordem: i + 1 }));
    setQuestionariosPorDept({ ...questionariosPorDept, [chave]: reordenada });
  };

  const adicionarPergunta = (tipo: string) => {
    if (etapaSelecionadaChave == null) {
      void mostrarAlerta('Atenção', 'Selecione uma etapa antes de adicionar perguntas!', 'aviso');
      return;
    }
    const novaPergunta = {
      id: Date.now(),
      label: '',
      tipo,
      obrigatorio: false,
      opcoes: tipo === 'select' || tipo === 'checkbox' ? [''] : [],
      ordem: (questionariosPorDept[etapaSelecionadaChave]?.length || 0) + 1,
      condicao: null,
      ...(tipo === 'grupo_repetivel' ? {
        modoRepeticao: 'manual',
        subPerguntas: [],
      } : {}),
    };
    setEditandoPergunta(novaPergunta);
  };

  const salvarPergunta = () => {
    if (!editandoPergunta.label.trim()) {
      void mostrarAlerta('Atenção', 'Digite o texto da pergunta!', 'aviso');
      return;
    }
    const chave = etapaSelecionadaChave;
    const perguntasDepto = chave !== null ? questionariosPorDept[chave] || [] : [];
    if (chave !== null && perguntasDepto.find((p: any) => p.id === editandoPergunta.id)) {
      setQuestionariosPorDept({
        ...questionariosPorDept,
        [chave]: perguntasDepto.map((p: any) =>
          p.id === editandoPergunta.id ? editandoPergunta : p
        ),
      });
    } else if (chave !== null) {
      setQuestionariosPorDept({
        ...questionariosPorDept,
        [chave]: [...perguntasDepto, editandoPergunta],
      });
    }
    setEditandoPergunta(null);
  };

  const excluirPergunta = (perguntaId: number) => {
    const chave = etapaSelecionadaChave;
    if (chave !== null) {
      setQuestionariosPorDept({
        ...questionariosPorDept,
        [chave]: (questionariosPorDept[chave] || []).filter(
          (p: any) => p.id !== perguntaId
        ),
      });
    }
  };

  const adicionarOpcao = () => {
    setEditandoPergunta({
      ...editandoPergunta,
      opcoes: [...editandoPergunta.opcoes, ''],
    });
  };

  const atualizarOpcao = (index: number, valor: string) => {
    const novasOpcoes = [...editandoPergunta.opcoes];
    novasOpcoes[index] = valor;
    setEditandoPergunta({ ...editandoPergunta, opcoes: novasOpcoes });
  };

  const removerOpcao = (index: number) => {
    setEditandoPergunta({
      ...editandoPergunta,
      opcoes: editandoPergunta.opcoes.filter((_: any, i: number) => i !== index),
    });
  };

  const handleSalvarComoFluxo = async () => {
    if (!nomeAtividade.trim()) {
      void mostrarAlerta('Atenção', 'Digite o nome da atividade!', 'aviso');
      return;
    }

    // Verificação de nome duplicado (ignora o próprio template em edição)
    const nomeNorm = nomeAtividade.trim().toLowerCase();
    const duplicado = (templates || []).some(
      (t) => t.id !== templateToEdit?.id && t.nome.trim().toLowerCase() === nomeNorm
    );
    if (duplicado) {
      void mostrarAlerta('Nome duplicado', `Já existe uma atividade/template com o nome "${nomeAtividade.trim()}". Escolha um nome diferente.`, 'aviso');
      return;
    }

    if (fluxoDepartamentos.length === 0) {
      void mostrarAlerta('Atenção', 'Adicione pelo menos um departamento ao fluxo!', 'aviso');
      return;
    }

    // Validação: cada etapa deve ter pelo menos 1 pergunta
    const missingEtapas: string[] = [];
    fluxoDepartamentos.forEach((deptId, idx) => {
      const chave = chaveDaEtapa(fluxoDepartamentos, idx);
      const qs = questionariosPorDept[chave];
      if (!Array.isArray(qs) || qs.length === 0) {
        const nomeDept = departamentos.find((d) => d.id === deptId)?.nome || `#${deptId}`;
        const oc = ocorrenciaDaEtapa(fluxoDepartamentos, idx);
        const total = totalOcorrenciasDept(fluxoDepartamentos, deptId);
        missingEtapas.push(total > 1 ? `${nomeDept} (${oc}ª)` : nomeDept);
      }
    });

    if (missingEtapas.length > 0) {
      void mostrarAlerta('Questionários faltando', `Etapas sem questionário: ${missingEtapas.join(', ')}`, 'aviso');
      return;
    }

    // Modo paralelo (com dependências configuradas) não suporta o mesmo dept
    // aparecendo mais de uma vez no fluxo, porque o checklist é único por
    // (processo, dept) — concluir uma ocorrência conclui todas. Pra rodadas
    // separadas do mesmo dept, usar Cadeias (Interligações).
    if (Object.keys(dependenciasDept).length > 0) {
      const contagem = new Map<number, number>();
      fluxoDepartamentos.forEach((id) => contagem.set(id, (contagem.get(id) || 0) + 1));
      const duplicados = Array.from(contagem.entries())
        .filter(([, n]) => n > 1)
        .map(([id]) => departamentos.find((d) => d.id === id)?.nome || `#${id}`);
      if (duplicados.length > 0) {
        void mostrarAlerta(
          'Configuração inválida',
          `Modo paralelo (com dependências) não suporta o mesmo departamento aparecendo mais de uma vez no fluxo: ${duplicados.join(', ')}.\n\nOpções:\n• Remova a duplicata e use sequencial.\n• Ou divida em solicitações encadeadas (Interligações) — cada rodada do dept vira uma solicitação separada.`,
          'aviso'
        );
        return;
      }
    }

    try {
      setLoading(true);
      // Base: se o usuário montou grupos, usa eles. Se não, gera grupos flat a partir do array linear.
      const gruposBase: Array<{ modo: 'sequencial' | 'paralelo'; templateIds: number[] }> =
        interligacaoGrupos.length > 0
          ? interligacaoGrupos
          : (interligacaoParalelo && interligacaoTemplateIds.length > 0
              ? [{ modo: 'paralelo', templateIds: [...interligacaoTemplateIds] }]
              : interligacaoTemplateIds.map((id) => ({ modo: 'sequencial' as const, templateIds: [id] })));

      // Reconcilia os grupos com a lista atual de IDs marcados nos checkboxes:
      // - remove dos grupos qualquer ID que tenha sido desmarcado
      // - adiciona ao final como bloco sequencial qualquer ID marcado que não esteja em nenhum grupo
      const idsSelecionados = new Set(interligacaoTemplateIds);
      const gruposLimpos = gruposBase
        .map((g) => ({ ...g, templateIds: g.templateIds.filter((id) => idsSelecionados.has(id)) }))
        .filter((g) => g.templateIds.length > 0);
      const idsJaEmGrupos = new Set(gruposLimpos.flatMap((g) => g.templateIds));
      const idsFaltando = interligacaoTemplateIds.filter((id) => !idsJaEmGrupos.has(id));
      const gruposParaSalvar = [
        ...gruposLimpos,
        ...idsFaltando.map((id) => ({ modo: 'sequencial' as const, templateIds: [id] })),
      ];

      const idsFlat = gruposParaSalvar.flatMap((g) => g.templateIds);

      const payload = {
        nome: nomeAtividade.trim(),
        descricao: descricao.trim() || `Atividade: ${nomeAtividade.trim()}`,
        fluxoDepartamentos,
        questionariosPorDepartamento: {
          ...questionariosPorDept,
        },
        interligacaoTemplateIds: idsFlat,
        interligacaoParalelo,
        interligacaoGrupos: gruposParaSalvar,
        dependenciasDept,
      };

      if (editandoNoOriginal && templateToEdit?.id) {
        await atualizarTemplate(Number(templateToEdit.id), payload as any);
        void mostrarAlerta('Sucesso!', 'Atividade atualizada com sucesso.', 'sucesso');
      } else {
        await criarTemplate(payload as any);
        void mostrarAlerta('Sucesso!', 'Atividade salva como Fluxo! Agora ela aparece em "Nova Solicitação" para ser usada com empresa, responsável e prazo.', 'sucesso');
      }
      onClose();
    } catch (error: any) {
      void mostrarAlerta('Erro', error.message || 'Erro ao salvar atividade', 'erro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalBase
      isOpen
      onClose={onClose}
      labelledBy="atividade-title"
      dialogClassName="w-full max-w-6xl bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl outline-none max-h-[90vh] overflow-y-auto"
      zIndex={1050}
    >
      <div className="rounded-2xl relative">
        <LoadingOverlay show={loading} text="Salvando atividade..." />

        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 rounded-t-2xl sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h3 id="atividade-title" className="text-xl font-bold text-white flex items-center gap-2">
                <Workflow size={22} /> {editandoNoOriginal ? 'Editar Atividade' : (templateToEdit ? 'Nova Atividade (cópia)' : 'Nova Atividade')}
              </h3>
              <p className="text-white/80 text-sm mt-1">
                {editandoNoOriginal
                  ? 'Você está editando o template original. As alterações vão sobrescrever o atual.'
                  : 'Crie o questionário e defina o fluxo. Depois salve como template para usar em "Nova Solicitação".'}
              </p>
            </div>
            <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Nome e descrição */}
          <div className="bg-cyan-50 dark:bg-[#0f2b34] rounded-xl p-4 border border-cyan-200 dark:border-[#155e75]">
            <h4 className="font-semibold text-cyan-800 mb-4 flex items-center gap-2">
              <ClipboardList size={18} /> Informações da Atividade
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome da Atividade <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nomeAtividade}
                  onChange={(e) => setNomeAtividade(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-[var(--border)] rounded-xl focus:ring-2 focus:ring-cyan-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                  placeholder="Ex: Abertura de Empresa, Alteração Contratual..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descrição <span className="text-gray-400 text-xs font-normal">(opcional)</span>
                </label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-[var(--border)] rounded-xl focus:ring-2 focus:ring-cyan-500 bg-white dark:bg-[var(--card)] text-gray-900 dark:text-[var(--fg)]"
                  placeholder="Descreva brevemente a atividade..."
                  rows={2}
                />
              </div>


            </div>
          </div>

          {/* Questionários por departamento */}
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
            <h4 className="font-semibold text-purple-800 mb-4">
              Criar Questionários por Departamento
            </h4>

            <div className="mb-6">
              <h5 className="text-sm font-medium text-gray-700 mb-3">
                Adicionar Departamentos ao Fluxo:
              </h5>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
                Você pode adicionar o <strong>mesmo departamento várias vezes</strong> no fluxo (cada aparição tem perguntas próprias).
              </p>
              <div className="flex flex-wrap gap-2">
                {departamentos.map((dept: any) => {
                  const qtd = totalOcorrenciasDept(fluxoDepartamentos, dept.id);
                  const jaAdicionado = qtd > 0;
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => adicionarDepartamentoAoFluxo(dept.id)}
                      title={jaAdicionado ? 'Clique para adicionar outra etapa deste departamento' : 'Adicionar ao fluxo'}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium ${
                        jaAdicionado
                          ? 'bg-blue-600 text-white'
                          : 'border-2 border-gray-300 hover:border-purple-500 text-gray-700'
                      }`}
                    >
                      <ClipboardList size={16} /> {dept.nome}
                      {jaAdicionado && (
                        <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                          <Plus size={10} /> {qtd}×
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fluxo Visual com badges de ordem */}
            {fluxoDepartamentos.length > 0 && (
              <div className="mb-6 bg-white rounded-lg p-4">
                <h5 className="text-sm font-medium text-gray-700 mb-3">
                  Fluxo da Atividade ({fluxoDepartamentos.length} etapa{fluxoDepartamentos.length === 1 ? '' : 's'}):
                </h5>
                <div className="flex flex-wrap items-center gap-2">
                  {fluxoDepartamentos.map((deptId, index) => {
                    const dept = departamentos.find((d: any) => d.id === deptId);
                    if (!dept) return null;
                    const totalOc = totalOcorrenciasDept(fluxoDepartamentos, deptId);
                    const ocorrencia = ocorrenciaDaEtapa(fluxoDepartamentos, index);
                    const chave = chaveDaEtapa(fluxoDepartamentos, index);
                    const qtdPerguntas = (questionariosPorDept[chave] || []).length;
                    const selecionada = etapaSelecionadaIdx === index;
                    return (
                      <React.Fragment key={`${deptId}-${index}`}>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEtapaSelecionadaIdx(index)}
                            className={`px-3 py-2 pl-6 rounded-lg flex items-center gap-2 font-medium transition-all relative ${
                              selecionada
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {/* Badge de ordem */}
                            <span className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              selecionada ? 'bg-yellow-400 text-gray-900' : 'bg-blue-500 text-white'
                            }`}>
                              {index + 1}
                            </span>
                            <ClipboardList size={14} />
                            <span>
                              {dept.nome}
                              {totalOc > 1 && (
                                <span className={`ml-1 text-xs font-bold ${selecionada ? 'text-yellow-200' : 'text-blue-600'}`}>
                                  ({ocorrencia}ª)
                                </span>
                              )}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              selecionada ? 'bg-white/20' : 'bg-gray-300 text-gray-700'
                            }`}>
                              {qtdPerguntas}p
                            </span>
                          </button>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); moverEtapaNoFluxo(index, -1); }}
                              disabled={index === 0}
                              className="px-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-none"
                              title="Mover etapa para antes"
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); moverEtapaNoFluxo(index, 1); }}
                              disabled={index === fluxoDepartamentos.length - 1}
                              className="px-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-none"
                              title="Mover etapa para depois"
                            >
                              ▶
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removerEtapaDoFluxo(index); }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                            title="Remover esta etapa"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        {index < fluxoDepartamentos.length - 1 && (
                          <ArrowRight size={16} className="text-gray-400" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DEPENDÊNCIAS ENTRE ETAPAS (Fase 3) — só faz sentido com 2+ etapas */}
            {fluxoDepartamentos.length >= 2 && (
              <details className="mb-6 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-700">
                <summary className="cursor-pointer p-4 select-none">
                  <span className="font-semibold text-teal-800 dark:text-teal-200">
                    ⚡ Dependências entre etapas (avançado)
                  </span>
                  <span className="text-xs text-teal-700 dark:text-teal-300 ml-2">
                    — permitir que etapas trabalhem em paralelo, mas algumas esperem outras
                  </span>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-xs text-teal-700 dark:text-teal-300">
                    Por padrão, o check segue a ordem do fluxo (etapa 2 só libera após etapa 1). Use esta seção para
                    soltar isso e dizer <strong>explicitamente</strong> de quais etapas cada uma depende.
                    Ex.: RH sem dependência, FISCAL depende de CONTÁBIL.
                    Ao criar a solicitação a partir deste template, os departamentos trabalharão em paralelo
                    respeitando essas regras.
                  </p>

                  {(() => {
                    const contagem = new Map<number, number>();
                    fluxoDepartamentos.forEach((id) => contagem.set(id, (contagem.get(id) || 0) + 1));
                    const duplicados = Array.from(contagem.entries())
                      .filter(([, n]) => n > 1)
                      .map(([id]) => departamentos.find((d: any) => d.id === id)?.nome || `#${id}`);
                    if (duplicados.length === 0) return null;
                    return (
                      <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                        <strong>⚠ Atenção:</strong> o modo paralelo não suporta o mesmo departamento aparecendo mais de uma vez no fluxo
                        ({duplicados.join(', ')}). Concluir uma ocorrência concluiria todas.
                        Pra rodadas separadas do mesmo dept, use <strong>Cadeias (Interligações)</strong> — cada rodada vira uma
                        solicitação encadeada. Salvar com dependências aqui será bloqueado enquanto houver duplicatas.
                      </div>
                    );
                  })()}

                  <div className="space-y-2">
                    {fluxoDepartamentos.map((deptId, idx) => {
                      const dept = departamentos.find((d: any) => d.id === deptId);
                      const totalOc = totalOcorrenciasDept(fluxoDepartamentos, deptId);
                      const oc = ocorrenciaDaEtapa(fluxoDepartamentos, idx);
                      const chave = chaveDaEtapa(fluxoDepartamentos, idx);
                      const depsDesta = Array.isArray(dependenciasDept[chave]) ? dependenciasDept[chave] : [];

                      return (
                        <div key={`dep-${idx}`} className="bg-white dark:bg-slate-900 rounded-lg border border-teal-200 dark:border-teal-700 p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-medium text-sm text-gray-800 dark:text-slate-100">
                              {dept?.nome || `Dept #${deptId}`}
                              {totalOc > 1 && <span className="ml-1 text-xs text-teal-600">({oc}ª)</span>}
                            </span>
                            <span className="text-[10px] text-gray-500 ml-auto">depende de:</span>
                          </div>
                          <div className="flex flex-wrap gap-1 pl-8">
                            {fluxoDepartamentos.map((outroDeptId, outroIdx) => {
                              if (outroIdx === idx) return null; // não pode depender de si mesmo
                              const outroDept = departamentos.find((d: any) => d.id === outroDeptId);
                              const outroTotalOc = totalOcorrenciasDept(fluxoDepartamentos, outroDeptId);
                              const outroOc = ocorrenciaDaEtapa(fluxoDepartamentos, outroIdx);
                              const outroChave = chaveDaEtapa(fluxoDepartamentos, outroIdx);
                              const selecionado = depsDesta.includes(outroChave);
                              return (
                                <button
                                  key={`dep-${idx}-${outroIdx}`}
                                  type="button"
                                  onClick={() => {
                                    setDependenciasDept((prev) => {
                                      const atuais = Array.isArray(prev[chave]) ? prev[chave] : [];
                                      const novas = selecionado
                                        ? atuais.filter((x) => x !== outroChave)
                                        : [...atuais, outroChave];
                                      const out = { ...prev };
                                      if (novas.length > 0) out[chave] = novas;
                                      else delete out[chave];
                                      return out;
                                    });
                                  }}
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all ${
                                    selecionado
                                      ? 'bg-teal-500 text-white border-teal-500'
                                      : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 border-gray-300 dark:border-slate-700 hover:border-teal-400'
                                  }`}
                                >
                                  {selecionado ? '✓ ' : '+ '}
                                  {outroDept?.nome || `Dept #${outroDeptId}`}
                                  {outroTotalOc > 1 ? ` (${outroOc}ª)` : ''}
                                </button>
                              );
                            })}
                          </div>
                          {depsDesta.length === 0 && (
                            <p className="text-[10px] text-gray-400 italic mt-1 pl-8">
                              Livre (nenhuma dependência — libera junto com as que também não têm dependência).
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {Object.keys(dependenciasDept).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDependenciasDept({})}
                      className="text-xs text-red-600 hover:text-red-700 underline"
                    >
                      Limpar todas as dependências (voltar para ordem sequencial)
                    </button>
                  )}
                </div>
              </details>
            )}

            {/* Editor de Questionário */}
            {etapaSelecionadaIdx != null && etapaSelecionadaChave != null && (
              <div className="border-2 border-purple-300 rounded-xl p-4 bg-white">
                {(() => {
                  const dept = departamentos.find((d: any) => d.id === etapaSelecionadaDeptId);
                  const perguntasDepto = questionariosPorDept[etapaSelecionadaChave] || [];
                  const totalOc = etapaSelecionadaDeptId != null ? totalOcorrenciasDept(fluxoDepartamentos, etapaSelecionadaDeptId) : 1;
                  const ocorrencia = ocorrenciaDaEtapa(fluxoDepartamentos, etapaSelecionadaIdx);

                  return (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="font-medium text-gray-800 flex items-center gap-2">
                          📋 Questionário - {dept?.nome}
                          {totalOc > 1 && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">
                              Etapa {etapaSelecionadaIdx + 1} • {ocorrencia}ª aparição
                            </span>
                          )}
                        </h5>
                        <span className="text-sm text-gray-600">
                          {perguntasDepto.length} pergunta(s)
                        </span>
                      </div>

                      {!editandoPergunta && (
                        <div className="mb-4">
                          <h6 className="text-sm font-medium text-gray-700 mb-2">
                            Adicionar Pergunta:
                          </h6>
                          <div className="grid grid-cols-3 gap-2">
                            {tiposCampo.map((tipo) => (
                              <button
                                key={tipo.valor}
                                type="button"
                                onClick={() => adicionarPergunta(tipo.valor)}
                                className="p-2 border-2 border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 text-sm font-medium transition-all"
                              >
                                {tipo.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {editandoPergunta && (
                        <div className="bg-purple-50 rounded-lg p-4 mb-4 border-2 border-purple-400">
                          <h6 className="font-medium text-gray-800 mb-3">Editando Pergunta:</h6>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Texto da Pergunta <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={editandoPergunta.label}
                                onChange={(e) =>
                                  setEditandoPergunta({ ...editandoPergunta, label: e.target.value })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                placeholder="Ex: Qual o nome da empresa?"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="obrigatorio-atividade"
                                checked={editandoPergunta.obrigatorio}
                                onChange={(e) =>
                                  setEditandoPergunta({ ...editandoPergunta, obrigatorio: e.target.checked })
                                }
                                className="w-4 h-4 text-purple-600 rounded"
                              />
                              <label htmlFor="obrigatorio-atividade" className="text-sm font-medium text-gray-700">
                                Campo obrigatório
                              </label>
                            </div>

                            {/* Pergunta Condicional */}
                            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <label className="flex items-center gap-2 mb-3">
                                <input
                                  type="checkbox"
                                  checked={!!editandoPergunta.condicao}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditandoPergunta({
                                        ...editandoPergunta,
                                        condicao: { perguntaId: null, operador: 'igual', valor: '' },
                                      });
                                    } else {
                                      setEditandoPergunta({ ...editandoPergunta, condicao: null });
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-sm font-medium text-gray-700">
                                  Pergunta Condicional (só aparece se...)
                                </span>
                              </label>

                              {editandoPergunta.condicao && (
                                <div className="space-y-3 mt-3">
                                  <select
                                    value={editandoPergunta.condicao.perguntaId || ''}
                                    onChange={(e) =>
                                      setEditandoPergunta({
                                        ...editandoPergunta,
                                        condicao: { ...editandoPergunta.condicao, perguntaId: Number(e.target.value) },
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  >
                                    <option value="">Depende da pergunta...</option>
                                    {(questionariosPorDept[etapaSelecionadaChave ?? ''] || [])
                                      .filter((p: any) => p.id !== editandoPergunta.id)
                                      .map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.label}</option>
                                      ))}
                                  </select>
                                  <select
                                    value={editandoPergunta.condicao.operador}
                                    onChange={(e) =>
                                      setEditandoPergunta({
                                        ...editandoPergunta,
                                        condicao: { ...editandoPergunta.condicao, operador: e.target.value },
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  >
                                    <option value="igual">É igual a</option>
                                    <option value="diferente">É diferente de</option>
                                    <option value="contem">Contém</option>
                                  </select>
                                  <input
                                    type="text"
                                    value={editandoPergunta.condicao.valor}
                                    onChange={(e) =>
                                      setEditandoPergunta({
                                        ...editandoPergunta,
                                        condicao: { ...editandoPergunta.condicao, valor: e.target.value },
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="Ex: Sim"
                                  />
                                </div>
                              )}
                            </div>

                            {(editandoPergunta.tipo === 'select' || editandoPergunta.tipo === 'checkbox') && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Opções de Resposta
                                </label>
                                <div className="space-y-2">
                                  {editandoPergunta.opcoes.map((opcao: string, index: number) => (
                                    <div key={index} className="flex gap-2">
                                      <input
                                        type="text"
                                        value={opcao}
                                        onChange={(e) => atualizarOpcao(index, e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                        placeholder={`Opção ${index + 1}`}
                                      />
                                      <button type="button" onClick={() => removerOpcao(index)} className="px-2 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={adicionarOpcao}
                                    className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 text-gray-600 hover:text-purple-600 text-sm font-medium"
                                  >
                                    + Adicionar Opção
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Editor de Grupo Repetível */}
                            {editandoPergunta.tipo === 'grupo_repetivel' && (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Modo de Repetição</label>
                                    <select
                                      value={editandoPergunta.modoRepeticao || 'manual'}
                                      onChange={(e) => setEditandoPergunta({ ...editandoPergunta, modoRepeticao: e.target.value })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    >
                                      <option value="manual">Manual (botão adicionar)</option>
                                      <option value="numero">Controlado por número</option>
                                    </select>
                                  </div>
                                  {editandoPergunta.modoRepeticao === 'numero' && (
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Controlado por</label>
                                      <select
                                        value={editandoPergunta.controladoPor || ''}
                                        onChange={(e) => setEditandoPergunta({ ...editandoPergunta, controladoPor: e.target.value ? Number(e.target.value) : undefined })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                      >
                                        <option value="">Selecione...</option>
                                        {(questionariosPorDept[etapaSelecionadaChave ?? ''] || [])
                                          .filter((p: any) => p.tipo === 'number' && p.id !== editandoPergunta.id)
                                          .map((p: any) => (
                                            <option key={p.id} value={p.id}>{p.label || `Pergunta #${p.id}`}</option>
                                          ))}
                                      </select>
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">Sub-perguntas do Grupo</label>
                                  <div className="space-y-3">
                                    {(editandoPergunta.subPerguntas || []).map((sub: any, idx: number) => (
                                      <div key={sub.id || idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
                                        <div className="flex gap-2 items-center">
                                          <input
                                            type="text"
                                            value={sub.label}
                                            onChange={(e) => {
                                              const next = [...(editandoPergunta.subPerguntas || [])];
                                              next[idx] = { ...next[idx], label: e.target.value };
                                              setEditandoPergunta({ ...editandoPergunta, subPerguntas: next });
                                            }}
                                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                                            placeholder="Texto da sub-pergunta"
                                          />
                                          <select
                                            value={sub.tipo}
                                            onChange={(e) => {
                                              const next = [...(editandoPergunta.subPerguntas || [])];
                                              const novoTipo = e.target.value;
                                              next[idx] = {
                                                ...next[idx],
                                                tipo: novoTipo,
                                                opcoes: novoTipo === 'select' ? (next[idx].opcoes || ['']) : undefined,
                                              };
                                              setEditandoPergunta({ ...editandoPergunta, subPerguntas: next });
                                            }}
                                            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                                          >
                                            <option value="text">Texto</option>
                                            <option value="number">Número</option>
                                            <option value="date">Data</option>
                                            <option value="select">Seleção</option>
                                            <option value="boolean">Sim/Não</option>
                                            <option value="phone">Telefone</option>
                                            <option value="email">Email</option>
                                            <option value="cpf">CPF</option>
                                            <option value="cnpj">CNPJ</option>
                                            <option value="file">Arquivo/Anexo</option>
                                            <option value="cep">CEP</option>
                                            <option value="money">Valor (R$)</option>
                                          </select>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const next = (editandoPergunta.subPerguntas || []).filter((_: any, i: number) => i !== idx);
                                              setEditandoPergunta({ ...editandoPergunta, subPerguntas: next });
                                            }}
                                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>

                                        {/* Opções para sub-pergunta do tipo select */}
                                        {sub.tipo === 'select' && (
                                          <div className="pl-2 border-l-2 border-purple-200">
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Opções</label>
                                            {(sub.opcoes || ['']).map((op: string, oIdx: number) => (
                                              <div key={oIdx} className="flex gap-1 mb-1">
                                                <input
                                                  type="text"
                                                  value={op}
                                                  onChange={(e) => {
                                                    const next = [...(editandoPergunta.subPerguntas || [])];
                                                    const nextOps = [...(next[idx].opcoes || [])];
                                                    nextOps[oIdx] = e.target.value;
                                                    next[idx] = { ...next[idx], opcoes: nextOps };
                                                    setEditandoPergunta({ ...editandoPergunta, subPerguntas: next });
                                                  }}
                                                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                                                  placeholder={`Opção ${oIdx + 1}`}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const next = [...(editandoPergunta.subPerguntas || [])];
                                                    const nextOps = (next[idx].opcoes || []).filter((_: any, i: number) => i !== oIdx);
                                                    next[idx] = { ...next[idx], opcoes: nextOps.length > 0 ? nextOps : [''] };
                                                    setEditandoPergunta({ ...editandoPergunta, subPerguntas: next });
                                                  }}
                                                  className="px-2 py-1 text-red-500 hover:bg-red-50 rounded text-xs"
                                                >
                                                  X
                                                </button>
                                              </div>
                                            ))}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const next = [...(editandoPergunta.subPerguntas || [])];
                                                next[idx] = { ...next[idx], opcoes: [...(next[idx].opcoes || []), ''] };
                                                setEditandoPergunta({ ...editandoPergunta, subPerguntas: next });
                                              }}
                                              className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                                            >
                                              + Opção
                                            </button>
                                          </div>
                                        )}

                                        {/* Obrigatório */}
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            id={`sub-obrig-${sub.id}`}
                                            checked={Boolean(sub.obrigatorio)}
                                            onChange={(e) => {
                                              const next = [...(editandoPergunta.subPerguntas || [])];
                                              next[idx] = { ...next[idx], obrigatorio: e.target.checked };
                                              setEditandoPergunta({ ...editandoPergunta, subPerguntas: next });
                                            }}
                                            className="w-3.5 h-3.5 text-purple-600 rounded"
                                          />
                                          <label htmlFor={`sub-obrig-${sub.id}`} className="text-xs font-medium text-gray-700 cursor-pointer">
                                            Obrigatória
                                          </label>
                                        </div>

                                        {/* Sub-pergunta Condicional */}
                                        <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                                          <label className="flex items-center gap-2 mb-2">
                                            <input
                                              type="checkbox"
                                              checked={!!sub.condicao}
                                              onChange={(e) => {
                                                const next = [...(editandoPergunta.subPerguntas || [])];
                                                if (e.target.checked) {
                                                  next[idx] = { ...next[idx], condicao: { perguntaId: null, operador: 'igual', valor: '' } };
                                                } else {
                                                  const { condicao, ...rest } = next[idx];
                                                  next[idx] = rest;
                                                }
                                                setEditandoPergunta({ ...editandoPergunta, subPerguntas: next });
                                              }}
                                              className="w-3.5 h-3.5 text-blue-600 rounded"
                                            />
                                            <span className="text-xs font-medium text-gray-700">
                                              Sub-pergunta Condicional (só aparece se...)
                                            </span>
                                          </label>

                                          {sub.condicao && (
                                            <div className="space-y-2 mt-2">
                                              <select
                                                value={sub.condicao.perguntaId || ''}
                                                onChange={(e) => {
                                                  const next = [...(editandoPergunta.subPerguntas || [])];
                                                  next[idx] = { ...next[idx], condicao: { ...next[idx].condicao, perguntaId: Number(e.target.value) } };
                                                  setEditandoPergunta({ ...editandoPergunta, subPerguntas: next });
                                                }}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                                              >
                                                <option value="">Depende da sub-pergunta...</option>
                                                {(editandoPergunta.subPerguntas || [])
                                                  .filter((s: any) => s.id !== sub.id && String(s.label || '').trim() !== '')
                                                  .map((s: any) => (
                                                    <option key={s.id} value={s.id}>{s.label}</option>
                                                  ))}
                                              </select>
                                              <select
                                                value={sub.condicao.operador}
                                                onChange={(e) => {
                                                  const next = [...(editandoPergunta.subPerguntas || [])];
                                                  next[idx] = { ...next[idx], condicao: { ...next[idx].condicao, operador: e.target.value } };
                                                  setEditandoPergunta({ ...editandoPergunta, subPerguntas: next });
                                                }}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                                              >
                                                <option value="igual">É igual a</option>
                                                <option value="diferente">É diferente de</option>
                                                <option value="contem">Contém</option>
                                              </select>
                                              <input
                                                type="text"
                                                value={sub.condicao.valor}
                                                onChange={(e) => {
                                                  const next = [...(editandoPergunta.subPerguntas || [])];
                                                  next[idx] = { ...next[idx], condicao: { ...next[idx].condicao, valor: e.target.value } };
                                                  setEditandoPergunta({ ...editandoPergunta, subPerguntas: next });
                                                }}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                                                placeholder="Ex: Sim"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const novaSub = { id: Date.now() + Math.random(), label: '', tipo: 'text', obrigatorio: false, ordem: (editandoPergunta.subPerguntas || []).length + 1 };
                                        setEditandoPergunta({ ...editandoPergunta, subPerguntas: [...(editandoPergunta.subPerguntas || []), novaSub] });
                                      }}
                                      className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 text-gray-600 hover:text-purple-600 text-sm font-medium"
                                    >
                                      + Adicionar Sub-pergunta
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setEditandoPergunta(null)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={salvarPergunta}
                                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                              >
                                Salvar Pergunta
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {perguntasDepto.length > 0 && (
                        <div>
                          <h6 className="text-sm font-medium text-gray-700 mb-2">
                            Perguntas Criadas ({perguntasDepto.length}):
                          </h6>
                          <div className="space-y-2">
                            {perguntasDepto.map((pergunta: any, index: number) => (
                              <div key={pergunta.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">
                                        {index + 1}
                                      </span>
                                      <span className="font-medium text-sm">{pergunta.label}</span>
                                      {pergunta.obrigatorio && <span className="text-red-500 text-xs">*</span>}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      Tipo: {tiposCampo.find((t) => t.valor === pergunta.tipo)?.label}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="flex flex-col">
                                      <button
                                        type="button"
                                        onClick={() => moverPergunta(pergunta.id, -1)}
                                        disabled={index === 0}
                                        className="px-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-none"
                                        title="Subir pergunta"
                                      >
                                        ▲
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moverPergunta(pergunta.id, 1)}
                                        disabled={index === perguntasDepto.length - 1}
                                        className="px-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-none"
                                        title="Descer pergunta"
                                      >
                                        ▼
                                      </button>
                                    </div>
                                    <button type="button" onClick={() => setEditandoPergunta(pergunta)} className="p-1 text-purple-600 hover:bg-purple-100 rounded" title="Editar">
                                      <Edit size={14} />
                                    </button>
                                    <button type="button" onClick={() => excluirPergunta(pergunta.id)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Excluir">
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Cadeia de interligação pré-configurada */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4">
            <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-1">
              Interligações padrão (cadeia automática)
            </h4>
            <p className="text-xs text-purple-700 dark:text-purple-400 mb-3">
              Ao finalizar um processo criado deste template, as atividades abaixo serão abertas automaticamente, em ordem.
              Essa configuração fica <strong>salva no template</strong> — uma vez definida, não é preciso interligar manualmente a cada nova solicitação.
            </p>

            {(templates || []).filter((t: any) => t.id !== templateToEdit?.id).length === 0 ? (
              <p className="text-xs text-gray-500 italic">Crie outros templates para poder configurar uma cadeia.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(templates || [])
                  .filter((t: any) => t.id !== templateToEdit?.id)
                  .map((t: any) => {
                    const selecionado = interligacaoTemplateIds.includes(t.id);
                    const ordem = interligacaoTemplateIds.indexOf(t.id);
                    return (
                      <label
                        key={t.id}
                        className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${
                          selecionado
                            ? 'border-purple-400 bg-purple-100 dark:bg-purple-900/40'
                            : 'border-gray-200 dark:border-slate-700 hover:border-purple-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selecionado}
                          onChange={() => {
                            setInterligacaoTemplateIds((prev) =>
                              prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                            );
                          }}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                        {selecionado && (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-xs font-bold text-white">
                            {ordem + 1}
                          </span>
                        )}
                        <span className="flex-1 text-sm text-gray-800 dark:text-slate-100 truncate">
                          {t.nome}
                        </span>
                        {selecionado && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setInterligacaoTemplateIds((prev) => {
                                  const idx = prev.indexOf(t.id);
                                  if (idx <= 0) return prev;
                                  const next = [...prev];
                                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                  return next;
                                });
                              }}
                              className="p-1 text-purple-600 hover:bg-purple-200 rounded"
                              title="Subir"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setInterligacaoTemplateIds((prev) => {
                                  const idx = prev.indexOf(t.id);
                                  if (idx < 0 || idx >= prev.length - 1) return prev;
                                  const next = [...prev];
                                  [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                                  return next;
                                });
                              }}
                              className="p-1 text-purple-600 hover:bg-purple-200 rounded"
                              title="Descer"
                            >
                              ▼
                            </button>
                          </div>
                        )}
                      </label>
                    );
                  })}
              </div>
            )}

            {interligacaoTemplateIds.length > 0 && (
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={interligacaoParalelo}
                  onChange={(e) => setInterligacaoParalelo(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                <span className="text-xs font-medium text-purple-800 dark:text-purple-300">
                  Criar as atividades interligadas com departamentos em paralelo (dentro de cada solicitação)
                </span>
              </label>
            )}

            {/* RAMIFICAÇÃO — configurar grupos sequencial/paralelo */}
            {interligacaoTemplateIds.length > 0 && (
              <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-700">
                <h5 className="text-xs font-bold text-purple-800 dark:text-purple-200 mb-2 uppercase tracking-wide">
                  Ramificação (opcional)
                </h5>
                <p className="text-[11px] text-purple-700 dark:text-purple-300 mb-3">
                  Por padrão cada atividade da cadeia abre <strong>uma de cada vez</strong>. Se algumas devem abrir <strong>ao mesmo tempo</strong> (ex.: depois do Cadastro, abrir RH + Contábil + Fiscal juntos), agrupe elas em um bloco paralelo.
                </p>

                <div className="space-y-2">
                  {(() => {
                    // Gera grupos visuais: se interligacaoGrupos está vazio, mostra cada id como bloco sequencial.
                    const gruposExibicao: Array<{ modo: 'sequencial' | 'paralelo'; templateIds: number[] }> =
                      interligacaoGrupos.length > 0
                        ? interligacaoGrupos
                        : interligacaoTemplateIds.map((id) => ({ modo: 'sequencial' as const, templateIds: [id] }));

                    // Atualiza o state local — garante que interligacaoGrupos reflita a ordem/modo visual
                    const sincronizarGruposComFila = (novos: Array<{ modo: 'sequencial' | 'paralelo'; templateIds: number[] }>) => {
                      setInterligacaoGrupos(novos);
                      setInterligacaoTemplateIds(novos.flatMap((g) => g.templateIds));
                    };

                    return (
                      <>
                        {gruposExibicao.map((grupo, gIdx) => (
                          <div
                            key={gIdx}
                            className={`rounded-lg border-2 p-2 ${
                              grupo.modo === 'paralelo'
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                                : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/40'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                  BLOCO {gIdx + 1}
                                </span>
                                <select
                                  value={grupo.modo}
                                  onChange={(e) => {
                                    const novos = [...gruposExibicao];
                                    novos[gIdx] = { ...novos[gIdx], modo: e.target.value as 'sequencial' | 'paralelo' };
                                    sincronizarGruposComFila(novos);
                                  }}
                                  className="text-[11px] px-2 py-0.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 font-medium"
                                >
                                  <option value="sequencial">Sequencial (um após o outro)</option>
                                  <option value="paralelo">Paralelo (todos ao mesmo tempo)</option>
                                </select>
                              </div>
                              {gruposExibicao.length > 1 && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (gIdx === 0) return;
                                      const novos = [...gruposExibicao];
                                      [novos[gIdx - 1], novos[gIdx]] = [novos[gIdx], novos[gIdx - 1]];
                                      sincronizarGruposComFila(novos);
                                    }}
                                    disabled={gIdx === 0}
                                    className="text-[10px] px-1.5 py-0.5 text-purple-600 hover:bg-purple-100 rounded disabled:opacity-30"
                                    title="Mover bloco para cima"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (gIdx === gruposExibicao.length - 1) return;
                                      const novos = [...gruposExibicao];
                                      [novos[gIdx + 1], novos[gIdx]] = [novos[gIdx], novos[gIdx + 1]];
                                      sincronizarGruposComFila(novos);
                                    }}
                                    disabled={gIdx === gruposExibicao.length - 1}
                                    className="text-[10px] px-1.5 py-0.5 text-purple-600 hover:bg-purple-100 rounded disabled:opacity-30"
                                    title="Mover bloco para baixo"
                                  >
                                    ▼
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {grupo.templateIds.map((tid) => {
                                const tmpl = (templates || []).find((t: any) => Number(t.id) === tid);
                                return (
                                  <span
                                    key={tid}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200"
                                  >
                                    {tmpl?.nome || `#${tid}`}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const novos = gruposExibicao
                                          .map((g, i) =>
                                            i === gIdx
                                              ? { ...g, templateIds: g.templateIds.filter((x) => x !== tid) }
                                              : g
                                          )
                                          .filter((g) => g.templateIds.length > 0);
                                        sincronizarGruposComFila(novos);
                                      }}
                                      className="ml-1 text-purple-700 hover:text-red-600"
                                      title="Remover desta cadeia"
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })}
                              {grupo.templateIds.length > 1 && grupo.modo === 'sequencial' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const novos = [...gruposExibicao];
                                    novos[gIdx] = { ...novos[gIdx], modo: 'paralelo' };
                                    sincronizarGruposComFila(novos);
                                  }}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-white hover:bg-amber-500 font-semibold"
                                  title="Executar em paralelo"
                                >
                                  ⚡ Paralelizar
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Juntar blocos adjacentes em paralelo */}
                        {gruposExibicao.length >= 2 && (
                          <div className="pt-1 flex flex-wrap gap-2">
                            {gruposExibicao.slice(0, -1).map((_, gIdx) => (
                              <button
                                key={gIdx}
                                type="button"
                                onClick={() => {
                                  const novos = [...gruposExibicao];
                                  const mesclado = {
                                    modo: 'paralelo' as const,
                                    templateIds: [...novos[gIdx].templateIds, ...novos[gIdx + 1].templateIds],
                                  };
                                  novos.splice(gIdx, 2, mesclado);
                                  sincronizarGruposComFila(novos);
                                }}
                                className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300"
                                title={`Juntar bloco ${gIdx + 1} e ${gIdx + 2} em paralelo`}
                              >
                                ⚡ Juntar bloco {gIdx + 1} + {gIdx + 2}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Separar bloco paralelo de volta em sequenciais */}
                        {gruposExibicao.some((g) => g.modo === 'paralelo' && g.templateIds.length > 1) && (
                          <div className="pt-1 flex flex-wrap gap-2">
                            {gruposExibicao.map((g, gIdx) =>
                              g.modo === 'paralelo' && g.templateIds.length > 1 ? (
                                <button
                                  key={gIdx}
                                  type="button"
                                  onClick={() => {
                                    const novos = [...gruposExibicao];
                                    const separados = g.templateIds.map((id) => ({ modo: 'sequencial' as const, templateIds: [id] }));
                                    novos.splice(gIdx, 1, ...separados);
                                    sincronizarGruposComFila(novos);
                                  }}
                                  className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
                                  title="Quebrar bloco paralelo em sequenciais"
                                >
                                  ⏸ Quebrar bloco {gIdx + 1}
                                </button>
                              ) : null
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100 font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvarComoFluxo}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {editandoNoOriginal ? 'Salvar alterações' : 'Salvar como Fluxo'}
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}
