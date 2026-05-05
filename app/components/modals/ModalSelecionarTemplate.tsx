'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, FileText, Info, MoreVertical, Trash2, Edit, ClipboardList, Link2, ArrowUp, ArrowDown, Search, Pin } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import { Template } from '@/app/types';
import { api } from '@/app/utils/api';
import LoadingOverlay from '../LoadingOverlay';

interface ModalSelecionarTemplateProps {
  onClose: () => void;
  onEditTemplate?: (template: any, modo: 'normal' | 'copia') => void;
}

export default function ModalSelecionarTemplate({ onClose, onEditTemplate }: ModalSelecionarTemplateProps) {
  const {
    usuarioLogado,
    criarProcesso,
    empresas,
    departamentos,
    templates,
    processos,
    excluirTemplate: excluirTemplateContext,
    mostrarAlerta,
    mostrarConfirmacao,
  } = useSistema();
  
  const [empresaSelecionada, setEmpresaSelecionada] = useState<any>(null);
  const [semEmpresa, setSemEmpresa] = useState(false);
  const [templatesFixados, setTemplatesFixados] = useState<Set<number>>(new Set());
  const [responsavelId, setResponsavelId] = useState<number | null>(null);
  const [prazoEntrega, setPrazoEntrega] = useState<string>(new Date().toISOString().split('T')[0]); // Prazo de entrega — padrão: data atual
  const [usuariosResponsaveis, setUsuariosResponsaveis] = useState<Array<{ id: number; nome: string; email: string; role: string; ativo?: boolean }>>([]);
  const [erroUsuariosResponsaveis, setErroUsuariosResponsaveis] = useState<string | null>(null);
  const [templateSelecionado, setTemplateSelecionado] = useState<number | null>(null);
  const [templateComTooltip, setTemplateComTooltip] = useState<number | null>(null);
  const [templateComTooltipNome, setTemplateComTooltipNome] = useState<number | null>(null);
  const [showMenuTemplate, setShowMenuTemplate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [interligarCom, setInterligarCom] = useState<number[]>([]);
  const [interligarParalelo, setInterligarParalelo] = useState(false);
  const [deptIndependente, setDeptIndependente] = useState(false);
  const [buscaTemplate, setBuscaTemplate] = useState('');

  // Projeto (dossiê) — opcional, agrupa solicitações do mesmo assunto
  const [projetoId, setProjetoId] = useState<number | ''>('');
  const [projetosDisponiveis, setProjetosDisponiveis] = useState<Array<{ id: number; nome: string; empresaId: number | null }>>([]);
  const [mostrarNovoProjeto, setMostrarNovoProjeto] = useState(false);
  const [novoProjetoNome, setNovoProjetoNome] = useState('');
  const role = String(usuarioLogado?.role ?? '').toLowerCase();
  const isAdminLike = role === 'admin' || role === 'admin_departamento';
  const podeSelecionarResponsavel = isAdminLike || role === 'gerente';

  const templatesDisponiveis: Template[] = templates || [];

  // Templates fixados — persistido em localStorage por usuário
  const fixadosStorageKey = useMemo(() => {
    const uid = (usuarioLogado as any)?.id;
    return uid ? `tarefas-templates-fixados:${uid}` : null;
  }, [usuarioLogado]);

  useEffect(() => {
    if (!fixadosStorageKey) return;
    try {
      const raw = localStorage.getItem(fixadosStorageKey);
      if (!raw) { setTemplatesFixados(new Set()); return; }
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        setTemplatesFixados(new Set(arr.map((n) => Number(n)).filter((n) => Number.isFinite(n))));
      }
    } catch {
      setTemplatesFixados(new Set());
    }
  }, [fixadosStorageKey]);

  const toggleFixarTemplate = (templateId: number) => {
    setTemplatesFixados((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) next.delete(templateId); else next.add(templateId);
      if (fixadosStorageKey) {
        try { localStorage.setItem(fixadosStorageKey, JSON.stringify(Array.from(next))); } catch {}
      }
      return next;
    });
  };

  const templatesFiltrados = useMemo(() => {
    const termo = buscaTemplate.trim().toLowerCase();
    const filtrados = !termo
      ? [...templatesDisponiveis]
      : templatesDisponiveis.filter((t: any) => {
          const nome = String(t?.nome ?? '').toLowerCase();
          const desc = String(t?.descricao ?? '').toLowerCase();
          return nome.includes(termo) || desc.includes(termo);
        });
    return filtrados.sort((a: any, b: any) => {
      const aFix = templatesFixados.has(Number(a?.id)) ? 1 : 0;
      const bFix = templatesFixados.has(Number(b?.id)) ? 1 : 0;
      if (aFix !== bFix) return bFix - aFix;
      return 0; // mantém ordem original (criação) quando empate
    });
  }, [templatesDisponiveis, buscaTemplate, templatesFixados]);

  const empresasDisponiveis = useMemo(() => {
    return [...(empresas || [])].sort((a: any, b: any) => {
      const na = String(a?.razao_social ?? a?.nome ?? '').toLowerCase();
      const nb = String(b?.razao_social ?? b?.nome ?? '').toLowerCase();
      return na.localeCompare(nb, 'pt-BR');
    });
  }, [empresas]);

  // Combobox de empresa: busca por código, nome ou CNPJ
  const [buscaEmpresa, setBuscaEmpresa] = useState('');
  const [showEmpresaDropdown, setShowEmpresaDropdown] = useState(false);
  const empresaWrapperRef = useRef<HTMLDivElement | null>(null);

  const empresasFiltradas = useMemo(() => {
    const termo = buscaEmpresa.trim().toLowerCase();
    if (!termo) return empresasDisponiveis;
    const termoDigits = termo.replace(/\D/g, '');
    return empresasDisponiveis.filter((emp: any) => {
      const nome = String(emp?.razao_social ?? emp?.nome ?? '').toLowerCase();
      const codigo = String(emp?.codigo ?? '').toLowerCase();
      const cnpj = String(emp?.cnpj ?? '').replace(/\D/g, '');
      return (
        nome.includes(termo) ||
        codigo.includes(termo) ||
        (termoDigits.length > 0 && cnpj.includes(termoDigits))
      );
    });
  }, [empresasDisponiveis, buscaEmpresa]);

  useEffect(() => {
    if (!showEmpresaDropdown) return;
    const handler = (e: MouseEvent) => {
      if (empresaWrapperRef.current && !empresaWrapperRef.current.contains(e.target as Node)) {
        setShowEmpresaDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmpresaDropdown]);

  useEffect(() => {
    let ativo = true;
    if (!usuarioLogado || !podeSelecionarResponsavel) return;

    setErroUsuariosResponsaveis(null);

    (async () => {
      try {
        const data = await api.getUsuariosResponsaveis();
        if (!ativo) return;
        setUsuariosResponsaveis(Array.isArray(data) ? data : []);
      } catch {
        if (!ativo) return;
        setUsuariosResponsaveis([]);
        setErroUsuariosResponsaveis('Não foi possível carregar os usuários responsáveis.');
      }
    })();

    return () => {
      ativo = false;
    };
  }, [usuarioLogado, podeSelecionarResponsavel]);

  const responsavelSelecionado = useMemo(() => {
    if (typeof responsavelId !== 'number') return null;
    return usuariosResponsaveis.find((u) => u.id === responsavelId) ?? null;
  }, [usuariosResponsaveis, responsavelId]);

  const toggleInterligacao = (templateId: number) => {
    setInterligarCom((prev) =>
      prev.includes(templateId) ? prev.filter((id) => id !== templateId) : [...prev, templateId]
    );
  };

  useEffect(() => {
    if (typeof templateSelecionado !== 'number') return;
    // Ao selecionar um template, aplicar sua cadeia de interligação padrão (se houver).
    const tmpl: any = (templatesDisponiveis || []).find((t: any) => t.id === templateSelecionado);
    const padrao: number[] = Array.isArray(tmpl?.interligacaoTemplateIds)
      ? tmpl.interligacaoTemplateIds
          .map((x: any) => Number(x))
          .filter((x: any) => Number.isFinite(x) && x > 0 && x !== templateSelecionado)
          .filter((id: number) => (templatesDisponiveis || []).some((t: any) => t.id === id))
      : [];
    if (padrao.length > 0) {
      setInterligarCom(padrao);
      setInterligarParalelo(Boolean(tmpl?.interligacaoParalelo));
    } else {
      setInterligarCom((prev) => prev.filter((id) => id !== templateSelecionado));
    }
  }, [templateSelecionado, templatesDisponiveis]);

  useEffect(() => {
    if (interligarCom.length === 0 && interligarParalelo) {
      setInterligarParalelo(false);
    }
  }, [interligarCom, interligarParalelo]);

  // Carrega projetos da empresa selecionada (apenas EM_ANDAMENTO/PAUSADO — projetos ativos)
  useEffect(() => {
    if (!empresaSelecionada?.id) {
      setProjetosDisponiveis([]);
      setProjetoId('');
      return;
    }
    let ativo = true;
    (async () => {
      try {
        const dados = await api.getProjetos({ empresaId: empresaSelecionada.id });
        if (!ativo) return;
        const ativos = (Array.isArray(dados) ? dados : []).filter((p: any) => p.status === 'EM_ANDAMENTO' || p.status === 'PAUSADO');
        setProjetosDisponiveis(ativos.map((p: any) => ({ id: p.id, nome: p.nome, empresaId: p.empresaId })));
      } catch {
        if (ativo) setProjetosDisponiveis([]);
      }
    })();
    return () => { ativo = false; };
  }, [empresaSelecionada?.id]);

  const moverInterligacao = (templateId: number, direcao: -1 | 1) => {
    setInterligarCom((prev) => {
      const index = prev.indexOf(templateId);
      if (index < 0) return prev;
      const nextIndex = index + direcao;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const handleCriar = async () => {
    if (!semEmpresa && !empresaSelecionada) {
      void mostrarAlerta('Atenção', 'Selecione uma empresa ou marque "Sem empresa".', 'aviso');
      return;
    }

    if (!templateSelecionado) {
      void mostrarAlerta('Atenção', 'Selecione um template.', 'aviso');
      return;
    }

    const template = templatesDisponiveis.find((t) => t.id === templateSelecionado);
    if (!template) {
      void mostrarAlerta('Erro', 'Template não encontrado.', 'erro');
      return;
    }

    const fluxo = (() => {
      const v: any = (template as any).fluxoDepartamentos ?? (template as any).fluxo_departamentos;
      if (Array.isArray(v)) return v as number[];
      try {
        const parsed = JSON.parse(v as any);
        return Array.isArray(parsed) ? (parsed as number[]) : [];
      } catch {
        return [];
      }
    })();

    const deptIds = new Set<number>((departamentos || []).map((d: any) => Number(d.id)).filter((x: any) => Number.isFinite(x)));
    const fluxoNormalizado = (Array.isArray(fluxo) ? fluxo : [])
      .map((x: any) => Number(x))
      .filter((x: any) => Number.isFinite(x))
      .filter((id: number) => (deptIds.size > 0 ? deptIds.has(id) : true));

    const questionariosPorDept = (() => {
      const v: any = (template as any).questionariosPorDepartamento ?? (template as any).questionarios_por_departamento;
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as any;
      try {
        const parsed = JSON.parse(v as any);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    })();

    if (fluxoNormalizado.length === 0) {
      void mostrarAlerta('Template inválido', 'Fluxo vazio ou com departamentos inválidos.', 'aviso');
      return;
    }

    // Responsável: somente via seleção.
    // - ADMIN/GERENTE: obrigatório selecionar um usuário.
    // - USUARIO: usa o próprio usuário logado.
    const responsavelIdFinal = (() => {
      const role = usuarioLogado?.role;
      if (role === 'usuario') {
        const id = Number((usuarioLogado as any)?.id);
        return Number.isFinite(id) ? id : null;
      }
      return typeof responsavelId === 'number' ? responsavelId : null;
    })();

    if (podeSelecionarResponsavel) {
      if (typeof responsavelIdFinal !== 'number') {
        void mostrarAlerta('Atenção', 'Selecione o responsável (usuário).', 'aviso');
        return;
      }
    }

    // Validar se gerente/usuário está tentando criar solicitação para outro departamento
    // (aceita qualquer um dos deptos do usuário — principal ou extras)
    if (usuarioLogado?.role === 'gerente' || usuarioLogado?.role === 'usuario') {
      const deptPrincipal = (usuarioLogado as any).departamentoId ?? (usuarioLogado as any).departamento_id;
      const extras = Array.isArray((usuarioLogado as any).departamentosExtras) ? (usuarioLogado as any).departamentosExtras.map(Number) : [];
      const deptosDoUsuario = [Number(deptPrincipal), ...extras].filter((n) => Number.isFinite(n) && n > 0);
      if (deptosDoUsuario.length === 0) {
        void mostrarAlerta('Erro', 'Usuário sem departamento definido.', 'erro');
        return;
      }
      const primeiroDepartamento = fluxoNormalizado[0];
      if (!deptosDoUsuario.includes(primeiroDepartamento)) {
        void mostrarAlerta('Erro', 'Você só pode criar solicitações que começam em um dos seus departamentos.', 'erro');
        return;
      }
    }

    try {
      setLoading(true);

      // Resolve o projeto: se foi digitado um novo nome, cria o projeto primeiro
      let projetoIdFinal: number | null = typeof projetoId === 'number' ? projetoId : null;
      if (mostrarNovoProjeto && novoProjetoNome.trim()) {
        try {
          const novoProj = await api.criarProjeto({
            nome: novoProjetoNome.trim(),
            empresaId: semEmpresa ? null : (empresaSelecionada?.id || null),
            responsavelId: typeof responsavelIdFinal === 'number' ? responsavelIdFinal : null,
          });
          projetoIdFinal = Number(novoProj?.id) || null;
        } catch (err: any) {
          void mostrarAlerta('Erro', err?.message || 'Não foi possível criar o projeto', 'erro');
          setLoading(false);
          return;
        }
      }

      // Herda dependências do template — se houver, força deptIndependente=true
      const deps = (template as any).dependenciasDept;
      const temDeps = deps && typeof deps === 'object' && !Array.isArray(deps) && Object.keys(deps).length > 0;
      const gruposDoTemplate = (template as any).interligacaoGrupos;

      // Modo paralelo (deptIndependente OU dependências) não suporta o mesmo
      // dept aparecendo mais de uma vez no fluxo: o checklist é único por
      // (processo, dept), então concluir uma ocorrência concluiria todas.
      if (deptIndependente || temDeps) {
        const contagem = new Map<number, number>();
        fluxoNormalizado.forEach((id) => contagem.set(id, (contagem.get(id) || 0) + 1));
        const duplicados = Array.from(contagem.entries())
          .filter(([, n]) => n > 1)
          .map(([id]) => (departamentos || []).find((d: any) => d.id === id)?.nome || `#${id}`);
        if (duplicados.length > 0) {
          void mostrarAlerta(
            'Configuração inválida',
            `Modo paralelo não suporta o mesmo departamento aparecendo mais de uma vez neste fluxo: ${duplicados.join(', ')}.\n\nOpções:\n• Desmarque "Departamentos em paralelo" e use sequencial.\n• Ou divida a atividade em solicitações encadeadas (Interligações) — cada rodada do dept vira uma solicitação separada.`,
            'aviso'
          );
          setLoading(false);
          return;
        }
      }

      const nomeEmpresaFinal = semEmpresa
        ? 'Sem empresa'
        : (empresaSelecionada?.razao_social || empresaSelecionada?.nome || 'Empresa');
      const empresaIdFinal = semEmpresa ? null : empresaSelecionada?.id;

      await criarProcesso({
        nome: template.nome,
        nomeServico: template.nome,
        nomeEmpresa: nomeEmpresaFinal,
        empresa: nomeEmpresaFinal,
        empresaId: empresaIdFinal,
        cliente: (usuariosResponsaveis.find((u) => u.id === responsavelIdFinal)?.nome || '').trim(),
        responsavelId: typeof responsavelIdFinal === 'number' ? responsavelIdFinal : undefined,
        fluxoDepartamentos: fluxoNormalizado,
        departamentoAtual: fluxoNormalizado[0],
        departamentoAtualIndex: 0,
        questionariosPorDepartamento: questionariosPorDept as any,
        personalizado: false,
        templateId: template.id,
        criadoPor: usuarioLogado?.nome,
        descricao: `Solicitação criada via template: ${template.nome}`,
        dataEntrega: prazoEntrega ? new Date(prazoEntrega) : undefined, // Prazo de entrega
        ...(projetoIdFinal ? { projetoId: projetoIdFinal } : {}),
        ...(interligarCom.length > 0 ? {
          interligacaoTemplateIds: interligarCom,
          interligadoParalelo: interligarParalelo,
        } : {}),
        ...(Array.isArray(gruposDoTemplate) && gruposDoTemplate.length > 0 ? {
          interligacaoGrupos: gruposDoTemplate,
        } : {}),
        ...(temDeps ? {
          dependenciasDept: deps,
          deptIndependente: true,  // dependências implicam paralelismo
        } : (deptIndependente ? { deptIndependente: true } : {})),
      } as any);
      onClose();
    } catch (error: any) {
      void mostrarAlerta('Erro', error.message || 'Erro ao criar solicitação', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const excluirTemplate = (templateId: number, templateNome: string) => {
    if (!isAdminLike) {
      void mostrarAlerta('Permissão negada', 'Apenas administradores podem excluir templates.', 'aviso');
      return;
    }

    void (async () => {
      const ok = await mostrarConfirmacao({
        titulo: 'Excluir Template',
        mensagem: `Tem certeza que deseja excluir o template "${templateNome}"?\n\nEsta ação não pode ser desfeita.`,
        tipo: 'perigo',
        textoConfirmar: 'Sim, Excluir',
        textoCancelar: 'Cancelar',
      });

      if (ok) {
        excluirTemplateContext(templateId);
        setShowMenuTemplate(null);
      }
    })();
  };

  const formatarData = (data: Date | string) => {
    const d = new Date(data);
    return d.toLocaleDateString("pt-BR");
  };

  const parseFluxo = (template: Template): number[] => {
    const v: any = (template as any).fluxoDepartamentos ?? (template as any).fluxo_departamentos;
    if (Array.isArray(v)) return v as number[];
    try {
      const parsed = JSON.parse(v as any);
      return Array.isArray(parsed) ? (parsed as number[]) : [];
    } catch {
      return [];
    }
  };

  const parseQuestionarios = (template: Template): Record<number, any[]> => {
    const v: any = (template as any).questionariosPorDepartamento ?? (template as any).questionarios_por_departamento;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as any;
    try {
      const parsed = JSON.parse(v as any);
      return parsed && typeof parsed === 'object' ? (parsed as any) : {};
    } catch {
      return {};
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black bg-opacity-60 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="relative max-h-[calc(100dvh-0.75rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl sm:max-h-[90vh]">
        <LoadingOverlay show={loading} text="Criando solicitação..." />
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-t-2xl sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <ClipboardList size={18} /> Nova Solicitação (Template)
              </h3>
              <p className="text-white opacity-90 text-sm mt-1">
                Selecione um template e preencha os dados básicos
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCriar();
          }}
          className="space-y-6 p-4 sm:p-6"
        >
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
            <h4 className="font-semibold text-purple-800 mb-4">Dados da Empresa</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Selecionar Empresa Cadastrada {!semEmpresa && <span className="text-red-500">*</span>}
                </label>
                <div className="relative" ref={empresaWrapperRef}>
                  <input
                    type="text"
                    value={empresaSelecionada
                      ? `${empresaSelecionada.codigo} - ${empresaSelecionada.razao_social}`
                      : buscaEmpresa}
                    onChange={(e) => {
                      if (empresaSelecionada) setEmpresaSelecionada(null);
                      setBuscaEmpresa(e.target.value);
                      setShowEmpresaDropdown(true);
                    }}
                    onFocus={() => setShowEmpresaDropdown(true)}
                    placeholder="Digite o código ou nome da empresa"
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    required={!semEmpresa}
                    disabled={semEmpresa}
                    autoComplete="off"
                  />
                  {empresaSelecionada && !semEmpresa && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmpresaSelecionada(null);
                        setBuscaEmpresa('');
                        setShowEmpresaDropdown(true);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      aria-label="Limpar empresa"
                    >
                      <X size={14} />
                    </button>
                  )}
                  {showEmpresaDropdown && !semEmpresa && (
                    <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-300 rounded-xl shadow-lg">
                      {empresasFiltradas.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          Nenhuma empresa encontrada
                        </div>
                      ) : (
                        empresasFiltradas.map((emp: any) => (
                          <button
                            type="button"
                            key={emp.id}
                            onClick={() => {
                              setEmpresaSelecionada(emp);
                              setBuscaEmpresa('');
                              setShowEmpresaDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-purple-50 border-b border-gray-100 last:border-b-0"
                          >
                            <span className="font-medium text-gray-700">{emp.codigo}</span>
                            <span className="text-gray-700"> - {emp.razao_social}</span>
                            {String(emp.cnpj ?? '').replace(/\D/g, '').length === 0 && (
                              <span className="ml-1 text-xs text-amber-600">(NOVA)</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <label className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={semEmpresa}
                    onChange={(e) => {
                      setSemEmpresa(e.target.checked);
                      if (e.target.checked) setEmpresaSelecionada(null);
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  Sem empresa <span className="text-xs text-gray-500">(ex.: abertura de empresa)</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Responsável (usuário)
                </label>
                <select
                  value={responsavelId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) {
                      setResponsavelId(null);
                      return;
                    }
                    const id = Number(v);
                    setResponsavelId(Number.isFinite(id) ? id : null);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required={podeSelecionarResponsavel}
                  disabled={usuarioLogado?.role === 'usuario'}
                >
                  <option value="">
                    {usuarioLogado?.role === 'usuario'
                      ? 'Responsável será você'
                      : 'Selecione um usuário'}
                  </option>
                  {usuariosResponsaveis.map((u) => (
                    <option key={u.id} value={u.id} disabled={u.ativo === false}>
                      {u.nome} ({u.email}){u.ativo === false ? ' (inativo)' : ''}
                    </option>
                  ))}
                </select>
                {erroUsuariosResponsaveis && (
                  <p className="text-xs text-red-600 mt-2">
                    {erroUsuariosResponsaveis}
                  </p>
                )}
                {podeSelecionarResponsavel && usuariosResponsaveis.length === 0 && !erroUsuariosResponsaveis && (
                  <p className="text-xs text-gray-600 mt-2">
                    Nenhum usuário encontrado para seleção.
                  </p>
                )}
              </div>
            </div>

            {empresaSelecionada && (
              <div className="mt-3 bg-white rounded-lg p-3 border border-purple-200">
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-gray-900">{empresaSelecionada.razao_social}</p>
                  <p className="text-gray-600">📄 CNPJ: {empresaSelecionada.cnpj}</p>
                  {responsavelSelecionado?.nome && (
                    <p className="text-gray-600">👤 Responsável: {responsavelSelecionado.nome}</p>
                  )}
                </div>
              </div>
            )}

            {/* Campo de Prazo de Entrega */}
            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📅 Prazo de Entrega <span className="text-gray-400 text-xs font-normal">(opcional - aparece no calendário)</span>
              </label>
              <input
                type="date"
                value={prazoEntrega}
                onChange={(e) => setPrazoEntrega(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-purple-300 dark:border-purple-700 rounded-xl focus:ring-2 focus:ring-purple-500 bg-purple-50 dark:bg-purple-900/20 text-gray-900 dark:text-[var(--fg)]"
              />
              {prazoEntrega && (
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  ✓ Esta solicitação aparecerá no calendário em {new Date(prazoEntrega + 'T12:00:00').toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>

            {/* Seletor de Projeto (dossiê) */}
            {empresaSelecionada && (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📁 Projeto <span className="text-gray-400 text-xs font-normal">(opcional — agrupa solicitações relacionadas)</span>
                </label>
                {!mostrarNovoProjeto ? (
                  <div className="flex gap-2">
                    <select
                      value={projetoId}
                      onChange={(e) => setProjetoId(e.target.value ? Number(e.target.value) : '')}
                      className="flex-1 px-4 py-3 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/20 text-gray-900 dark:text-[var(--fg)]"
                    >
                      <option value="">— Sem projeto (solicitação avulsa) —</option>
                      {projetosDisponiveis.map((p) => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setMostrarNovoProjeto(true); setProjetoId(''); }}
                      className="px-3 py-2 text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl whitespace-nowrap"
                    >
                      + Novo projeto
                    </button>
                  </div>
                ) : (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-3 space-y-2">
                    <input
                      type="text"
                      value={novoProjetoNome}
                      onChange={(e) => setNovoProjetoNome(e.target.value)}
                      placeholder={`Ex.: Abertura de Empresa — ${empresaSelecionada.razao_social || empresaSelecionada.nome || 'Empresa'}`}
                      className="w-full px-3 py-2 border border-indigo-300 dark:border-indigo-600 rounded-lg text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setMostrarNovoProjeto(false); setNovoProjetoNome(''); }}
                        className="flex-1 px-3 py-2 text-xs text-gray-700 border border-gray-300 rounded-lg"
                      >
                        Cancelar
                      </button>
                      <span className="flex-1 text-xs text-indigo-700 dark:text-indigo-300 py-2 text-center">
                        ✓ Será criado ao confirmar
                      </span>
                    </div>
                  </div>
                )}
                {typeof projetoId === 'number' && projetoId > 0 && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                    ✓ Esta solicitação será vinculada ao projeto. Interligações automáticas herdam o projeto.
                  </p>
                )}
              </div>
            )}

          </div>

          <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-200">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="font-semibold text-cyan-800">
                Selecione o Template <span className="text-red-500">*</span>
              </h4>
              {isAdminLike && (
                <span className="text-xs text-gray-500">
                </span>
              )}
            </div>

            {templatesDisponiveis.length === 0 ? (
              <div className="text-center py-8">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 mb-2">Nenhum template disponível</p>
                <p className="text-sm text-gray-500">
                  Admins precisam criar templates primeiro
                </p>
              </div>
            ) : (
              <>
                <div className="relative mb-4">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={buscaTemplate}
                    onChange={(e) => setBuscaTemplate(e.target.value)}
                    placeholder="Buscar por nome ou descrição..."
                    className="w-full pl-9 pr-9 py-2.5 border border-cyan-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-sm"
                  />
                  {buscaTemplate && (
                    <button
                      type="button"
                      onClick={() => setBuscaTemplate('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      aria-label="Limpar busca"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {templatesFiltrados.length === 0 ? (
                  <div className="text-center py-8">
                    <Search size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-600 text-sm">
                      Nenhum template encontrado para &quot;{buscaTemplate}&quot;
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templatesFiltrados.map(template => (
                  <div
                    key={template.id}
                    className={`border-2 rounded-xl p-4 transition-all relative ${
                      templateSelecionado === template.id
                        ? 'border-cyan-500 bg-cyan-100'
                        : 'border-gray-200 hover:border-cyan-300 cursor-pointer'
                    }`}
                  >
                    <label className="cursor-pointer block">
                      <input
                        type="radio"
                        name="template"
                        value={template.id}
                        checked={templateSelecionado === template.id}
                        onChange={() => setTemplateSelecionado(template.id)}
                        className="sr-only"
                      />
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText size={20} className="text-white" />
                        </div>

                        <div className={`flex-1 min-w-0 ${isAdminLike ? 'pr-16' : 'pr-8'}`}>
                          <div className="relative">
                            <h5
                              className="font-bold text-lg text-cyan-700 mb-2 truncate cursor-help"
                              onMouseEnter={() => setTemplateComTooltipNome(template.id)}
                              onMouseLeave={() => setTemplateComTooltipNome(null)}
                            >
                              {template.nome}
                            </h5>

                            {templateComTooltipNome === template.id && (
                              <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 text-white text-sm rounded-lg p-3 z-50 shadow-xl">
                                <div className="font-semibold">{template.nome}</div>
                                {template.descricao && (
                                  <div className="text-gray-300 text-xs mt-1">{template.descricao}</div>
                                )}
                              </div>
                            )}
                          </div>

                          {template.descricao && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {template.descricao}
                            </p>
                          )}

                          <div className="relative inline-block mt-2">
                            <button
                              type="button"
                              onMouseEnter={() => setTemplateComTooltip(template.id)}
                              onMouseLeave={() => setTemplateComTooltip(null)}
                              className="text-xs text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                            >
                              <Info size={12} />
                              Ver detalhes do fluxo
                            </button>

                            {templateComTooltip === template.id && (
                              <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 z-50 shadow-xl">
                                <div className="font-semibold mb-2">Fluxo do Template:</div>
                                <div className="space-y-2">
                                  {parseFluxo(template).map((deptId, index) => {
                                    const dept = departamentos.find(d => d.id === deptId);
                                    const perguntas = parseQuestionarios(template)[deptId] || [];

                                    return (
                                      <div key={deptId} className="flex items-start gap-2">
                                        <div className="bg-cyan-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                          {index + 1}
                                        </div>
                                        <div className="flex-1">
                                          <div className="font-medium">
                                            {dept?.nome || `Departamento ${deptId}`}
                                          </div>
                                          <div className="text-cyan-300">
                                            {perguntas.length} pergunta(s)
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="border-t border-gray-700 mt-2 pt-2 text-cyan-300">
                                  Total: {parseFluxo(template).length} departamentos
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                            <span>{parseFluxo(template).length} departamentos</span>
                            <span>•</span>
                            <span>Criado em {formatarData(template.criado_em)}</span>
                          </div>
                        </div>
                      </div>
                    </label>

                    {/* Botão Fixar — visível para todos */}
                    <div className={`absolute top-3 ${isAdminLike ? 'right-10' : 'right-3'}`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFixarTemplate(template.id);
                        }}
                        className={`p-1.5 rounded transition-colors ${
                          templatesFixados.has(template.id)
                            ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'
                            : 'text-gray-300 hover:text-amber-500 hover:bg-amber-50'
                        }`}
                        title={templatesFixados.has(template.id) ? 'Desafixar template' : 'Fixar template no topo'}
                      >
                        <Pin size={16} className={templatesFixados.has(template.id) ? 'fill-current' : ''} />
                      </button>
                    </div>

                    {isAdminLike && (
                      <div className="absolute top-3 right-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenuTemplate(
                              showMenuTemplate === template.id ? null : template.id
                            );
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {showMenuTemplate === template.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[var(--card)] rounded-lg shadow-xl border border-gray-200 dark:border-[var(--border)] z-50 min-w-[180px] overflow-hidden">
                            {onEditTemplate && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenuTemplate(null);
                                    onEditTemplate(template, 'normal');
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2 transition-colors"
                                >
                                  <Edit size={14} />
                                  <span>Editar este</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenuTemplate(null);
                                    onEditTemplate(template, 'copia');
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 transition-colors border-t border-gray-100 dark:border-[var(--border)]"
                                >
                                  <Edit size={14} />
                                  <span>Editar como cópia</span>
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                excluirTemplate(template.id, template.nome);
                              }}
                              className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                            >
                              <Trash2 size={14} />
                              <span>Excluir</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Interligação com outra solicitação (template/atividade) */}
          {templatesDisponiveis.length > 1 && (() => {
            const tmplSel: any = (templatesDisponiveis || []).find((t: any) => t.id === templateSelecionado);
            const temCadeiaPadrao = Array.isArray(tmplSel?.interligacaoTemplateIds) && tmplSel.interligacaoTemplateIds.length > 0;
            return (
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Link2 className="inline w-4 h-4 mr-1" />
                  Selecione as atividades para continuar <span className="text-gray-400 text-xs font-normal">(opcional)</span>
                </label>
                {temCadeiaPadrao && (
                  <div className="mb-2 px-3 py-2 rounded-lg bg-purple-100 border border-purple-200 text-xs text-purple-700">
                    ✓ Cadeia pré-configurada no template aplicada. Você pode ajustar antes de criar.
                  </div>
                )}
                <div className="space-y-2 rounded-xl border border-purple-200 bg-white p-3">
                  {templatesDisponiveis
                    .filter((t) => t.id !== templateSelecionado)
                    .map((t) => {
                      const selecionado = interligarCom.includes(t.id);
                      const ordem = interligarCom.indexOf(t.id);
                      return (
                        <label
                          key={t.id}
                          className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                            selecionado
                              ? 'border-purple-400 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selecionado}
                            onChange={() => toggleInterligacao(t.id)}
                            className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
                          />
                          {selecionado && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-xs font-bold text-white">
                              {ordem + 1}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-700">
                              {t.nome}
                            </span>
                            {t.descricao && (
                              <span className="block truncate text-xs text-gray-500">
                                {t.descricao}
                              </span>
                            )}
                          </div>
                          {selecionado && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  moverInterligacao(t.id, -1);
                                }}
                                className="rounded p-1 text-gray-500 hover:bg-purple-100 hover:text-purple-700"
                                title="Mover para cima"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  moverInterligacao(t.id, 1);
                                }}
                                className="rounded p-1 text-gray-500 hover:bg-purple-100 hover:text-purple-700"
                                title="Mover para baixo"
                              >
                                <ArrowDown size={14} />
                              </button>
                            </div>
                          )}
                        </label>
                      );
                    })}
                </div>
                {interligarCom.length > 0 && (
                  <>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      🔗 Ao finalizar esta solicitacao, a primeira atividade da lista sera criada automaticamente. As demais permanecem salvas em fila.
                    </p>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={interligarParalelo}
                        onChange={(e) => setInterligarParalelo(e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                        ⚡ Ativar departamentos em paralelo nas atividades interligadas
                      </span>
                    </label>
                  </>
                )}
              </div>
            );
          })()}

          {/* Departamentos Independentes (paralelo) */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-700">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={deptIndependente}
                onChange={(e) => setDeptIndependente(e.target.checked)}
                className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
                  ⚡ Departamentos trabalham em paralelo
                </span>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                  Ative se cada departamento pode preencher seu questionário independentemente.
                  A solicitação aparecerá em todos os departamentos do fluxo. O check (finalização)
                  segue a ordem: dep 1 precisa dar check antes do 2, que precisa antes do 3, e assim por diante.
                </p>
              </div>
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!templateSelecionado || (!semEmpresa && !empresaSelecionada)}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
            >
              Criar Solicitação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
