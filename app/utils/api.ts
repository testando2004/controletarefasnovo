// API Client para comunicação com backend

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const toLower = (v: any) => (typeof v === 'string' ? v.toLowerCase() : v);
const toUpper = (v: any) => (typeof v === 'string' ? v.toUpperCase() : v);

const normalizeStatus = (status: any) => {
  const s = toLower(status);
  switch (s) {
    case 'em_andamento':
    case 'em andamento':
      return 'em_andamento';
    case 'finalizado':
      return 'finalizado';
    case 'pausado':
      return 'pausado';
    case 'cancelado':
      return 'cancelado';
    case 'rascunho':
      return 'rascunho';
    default:
      // Prisma enum vem como EM_ANDAMENTO etc
      if (typeof status === 'string') return status.toLowerCase();
      return 'em_andamento';
  }
};

const normalizePrioridade = (prioridade: any) => {
  const p = toLower(prioridade);
  switch (p) {
    case 'alta':
      return 'alta';
    case 'media':
      return 'media';
    case 'baixa':
      return 'baixa';
    default:
      if (typeof prioridade === 'string') return prioridade.toLowerCase();
      return 'media';
  }
};

const normalizeTipoCampo = (
  tipo: any
): 'text' | 'textarea' | 'number' | 'date' | 'boolean' | 'select' | 'checkbox' | 'file' | 'phone' | 'email' | 'cpf' | 'cnpj' | 'cep' | 'money' | 'grupo_repetivel' | 'titulo' => {
  const t = typeof tipo === 'string' ? tipo.toLowerCase() : '';
  switch (t) {
    case 'text':
    case 'text_simple':
    case 'texto':
    case 'textosimples':
    case 'textsimples':
    case 'textsimple':
      return 'text';
    case 'textarea':
    case 'text_area':
    case 'texto_longo':
    case 'textolongo':
      return 'textarea';
    case 'number':
    case 'numero':
      return 'number';
    case 'date':
    case 'data':
      return 'date';
    case 'boolean':
    case 'sim_nao':
    case 'sim/nao':
      return 'boolean';
    case 'select':
    case 'selecao':
      return 'select';
    case 'checkbox':
    case 'checklist':
      return 'checkbox';
    case 'file':
    case 'arquivo':
      return 'file';
    case 'phone':
    case 'telefone':
      return 'phone';
    case 'email':
      return 'email';
    case 'cpf':
      return 'cpf';
    case 'cpj':
    case 'cnpj':
      return 'cnpj';
    case 'cep':
      return 'cep';
    case 'money':
    case 'valor':
      return 'money';
    case 'grupo_repetivel':
      return 'grupo_repetivel';
    case 'titulo':
    case 'title':
    case 'titulo_secao':
    case 'heading':
      return 'titulo';
    default: {
      // Prisma enum vem como TEXT, TEXTAREA etc
      const upper = typeof tipo === 'string' ? tipo.toUpperCase() : '';
      switch (upper) {
        case 'TEXT':
          return 'text';
        case 'TEXTAREA':
          return 'textarea';
        case 'NUMBER':
          return 'number';
        case 'DATE':
          return 'date';
        case 'BOOLEAN':
          return 'boolean';
        case 'SELECT':
          return 'select';
        case 'CHECKBOX':
          return 'checkbox';
        case 'FILE':
          return 'file';
        case 'PHONE':
          return 'phone';
        case 'EMAIL':
          return 'email';
        case 'CPF':
          return 'cpf';
        case 'CPJ':
        case 'CNPJ':
          return 'cnpj';
        case 'CEP':
          return 'cep';
        case 'MONEY':
          return 'money';
        case 'GRUPO_REPETIVEL':
          return 'grupo_repetivel';
        case 'TITULO':
          return 'titulo';
        default:
          return 'text';
      }
    }
  }
};

const normalizeTipoEvento = (tipo: any) => {
  const t = typeof tipo === 'string' ? tipo.toUpperCase() : '';
  switch (t) {
    case 'INICIO':
      return 'inicio';
    case 'ALTERACAO':
      return 'alteracao';
    case 'MOVIMENTACAO':
      return 'movimentacao';
    case 'CONCLUSAO':
      return 'conclusao';
    case 'FINALIZACAO':
      return 'finalizacao';
    case 'DOCUMENTO':
      return 'documento';
    case 'COMENTARIO':
      return 'comentario';
    default:
      return 'alteracao';
  }
};

const normalizeProcesso = (raw: any) => {
  const tagsArray = Array.isArray(raw?.tags) ? raw.tags : [];
  const tagsIds = tagsArray.length > 0 && typeof tagsArray[0] === 'object'
    ? tagsArray.map((t: any) => t.tagId ?? t.tag?.id).filter((x: any) => typeof x === 'number')
    : tagsArray;

  const tagsMetadata = tagsArray.length > 0 && typeof tagsArray[0] === 'object'
    ? tagsArray.map((t: any) => t.tag).filter(Boolean)
    : undefined;

  const comentariosArray = Array.isArray(raw?.comentarios) ? raw.comentarios : [];
  const comentarios = comentariosArray.map((c: any) => ({
    id: c.id,
    processoId: c.processoId,
    texto: c.texto,
    autor: c.autor?.nome ?? c.autor ?? '—',
    departamentoId: c.departamentoId ?? undefined,
    departamento: c.departamento?.nome ?? c.departamento ?? undefined,
    timestamp: c.criadoEm ?? c.timestamp ?? new Date().toISOString(),
    editado: Boolean(c.editado),
    editadoEm: c.editadoEm ?? undefined,
    mencoes: Array.isArray(c.mencoes) ? c.mencoes : [],
  }));

  const comentariosCount =
    typeof raw?._count?.comentarios === 'number'
      ? raw._count.comentarios
      : Array.isArray(raw?.comentarios)
        ? raw.comentarios.length
        : 0;

  const documentosCount =
    typeof raw?._count?.documentos === 'number'
      ? raw._count.documentos
      : Array.isArray(raw?.documentos)
        ? raw.documentos.length
        : 0;

  const questionariosArray = Array.isArray(raw?.questionarios) ? raw.questionarios : [];

  const historicoEventosArray = Array.isArray(raw?.historicoEventos) ? raw.historicoEventos : [];
  const historico = historicoEventosArray
    .map((e: any) => {
      const data = e?.data ?? (e?.dataTimestamp ? new Date(Number(e.dataTimestamp)) : undefined);
      const responsavel =
        e?.responsavel?.nome ??
        (typeof e?.responsavel === 'string' ? e.responsavel : undefined) ??
        (typeof e?.responsavelId === 'number' ? `Usuário #${e.responsavelId}` : '—');

      return {
        departamento: e?.departamento ?? '—',
        data: data ?? new Date().toISOString(),
        dataTimestamp:
          e?.dataTimestamp !== undefined
            ? Number(e.dataTimestamp)
            : data
              ? new Date(data).getTime()
              : undefined,
        acao: String(e?.acao ?? ''),
        responsavel,
        tipo: normalizeTipoEvento(e?.tipo) as any,
      };
    })
    .filter((h: any) => h?.acao);

  // Chaves: "8" (etapa 1, retrocompatível) ou "8:2", "8:3"... (etapas seguintes
  // — quando o mesmo dept aparece mais de uma vez no fluxo).
  const respostasHistorico: Record<string, any> = {};

  // Alguns endpoints já retornam `questionariosPorDepartamento` agrupado (com chaves string).
  // Preservamos esse campo para evitar perder perguntas ao recarregar o processo.
  // Chaves podem ser "8" (primeira etapa, retrocompatível) ou "8:2" / "8:3" (etapas subsequentes
  // quando o mesmo dept aparece múltiplas vezes no fluxo).
  const baseQuestionariosPorDepartamento: Record<string, any[]> = (() => {
    const qpd = raw?.questionariosPorDepartamento;
    if (!qpd || typeof qpd !== 'object') return {};

    const out: Record<string, any[]> = {};
    for (const [deptKey, list] of Object.entries(qpd as Record<string, any>)) {
      // Suporta chaves compostas (ex.: "8:2") — extrai deptId para validar
      const partes = String(deptKey).split(':');
      const departamentoId = Number(partes[0]);
      if (!Number.isFinite(departamentoId) || departamentoId <= 0) continue;
      const chaveOut = String(deptKey);
      const arr = Array.isArray(list) ? list : [];
      out[chaveOut] = arr
        .map((q: any) => {
          const id = Number(q?.id);
          if (!Number.isFinite(id)) return null;
          const tipo = normalizeTipoCampo(q?.tipo);
          return {
            id,
            label: String(q?.label ?? ''),
            tipo,
            obrigatorio: Boolean(q?.obrigatorio),
            opcoes: Array.isArray(q?.opcoes) ? q.opcoes : [],
            ordem: Number(q?.ordem ?? 0),
            condicao:
              q?.condicaoPerguntaId
                ? {
                    perguntaId: Number(q.condicaoPerguntaId),
                    operador: (q.condicaoOperador || 'igual') as any,
                    valor: String(q.condicaoValor ?? ''),
                  }
                : (q?.condicao || undefined),
            ...((() => {
              // Log condicao para TODAS as perguntas
              const condicaoResult = q?.condicaoPerguntaId
                ? { perguntaId: Number(q.condicaoPerguntaId), operador: (q.condicaoOperador || 'igual'), valor: String(q.condicaoValor ?? '') }
                : (q?.condicao || undefined);
              console.log('[normalizeProcesso] pergunta:', {
                id,
                label: String(q?.label ?? ''),
                tipo,
                rawCondicaoPerguntaId: q?.condicaoPerguntaId,
                rawCondicao: q?.condicao,
                condicaoResult,
              });
              return {};
            })()),
            ...(tipo === 'grupo_repetivel' ? (() => {
              const gr = {
                modoRepeticao: q?.modoRepeticao || 'manual',
                controladoPor: q?.controladoPor ? Number(q.controladoPor) : undefined,
                subPerguntas: Array.isArray(q?.subPerguntas) ? q.subPerguntas : [],
              };
              console.log('[normalizeProcesso] grupo_repetivel detalhes:', {
                id,
                rawControladoPor: q?.controladoPor,
                rawSubPerguntas: q?.subPerguntas,
                rawSubPerguntasIsArray: Array.isArray(q?.subPerguntas),
                normalizado: gr,
              });
              return gr;
            })() : {}),
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
    }
    return out;
  })();

  const hasBaseQpd = Object.keys(baseQuestionariosPorDepartamento).length > 0;
  const questionariosPorDepartamento: Record<string, any[]> = hasBaseQpd ? baseQuestionariosPorDepartamento : {};

  const questionarios = questionariosArray
    .map((q: any) => {
      const departamentoId = Number(q?.departamentoId ?? q?.departamento?.id ?? 0);
      const etapa = Number.isFinite(Number(q?.etapa)) && Number(q.etapa) > 0 ? Number(q.etapa) : 1;
      const chaveDept = etapa === 1 ? String(departamentoId) : `${departamentoId}:${etapa}`;
      const tipo = normalizeTipoCampo(q?.tipo);
      const normalized = {
        id: Number(q?.id),
        label: String(q?.label ?? ''),
        tipo,
        obrigatorio: Boolean(q?.obrigatorio),
        opcoes: Array.isArray(q?.opcoes) ? q.opcoes : [],
        ordem: Number(q?.ordem ?? 0),
        condicao:
          q?.condicaoPerguntaId
            ? {
                perguntaId: Number(q.condicaoPerguntaId),
                operador: (q.condicaoOperador || 'igual') as any,
                valor: String(q.condicaoValor ?? ''),
              }
            : undefined,
        // grupo_repetivel fields
        ...(tipo === 'grupo_repetivel' ? {
          modoRepeticao: q?.modoRepeticao || 'manual',
          controladoPor: q?.controladoPor ? Number(q.controladoPor) : undefined,
          subPerguntas: Array.isArray(q?.subPerguntas) ? q.subPerguntas : [],
        } : {}),
        // suporte interno para agrupamento
        departamentoId,
        etapa,
        respostas: Array.isArray(q?.respostas) ? q.respostas : [],
      };

      if (Number.isFinite(departamentoId) && departamentoId > 0) {
        // Se já veio agrupado do servidor, evitamos duplicar.
        if (!hasBaseQpd) {
          questionariosPorDepartamento[chaveDept] = questionariosPorDepartamento[chaveDept] || [];
          questionariosPorDepartamento[chaveDept].push({
            id: normalized.id,
            label: normalized.label,
            tipo: normalized.tipo,
            obrigatorio: normalized.obrigatorio,
            opcoes: normalized.opcoes,
            ordem: normalized.ordem,
            condicao: normalized.condicao,
            ...((normalized as any).modoRepeticao ? {
              modoRepeticao: (normalized as any).modoRepeticao,
              controladoPor: (normalized as any).controladoPor,
              subPerguntas: (normalized as any).subPerguntas,
            } : {}),
          });
        }

        // Monta um "snapshot" de respostas por departamento para o modo somente leitura
        const respostas = normalized.respostas;
        if (Array.isArray(respostas) && respostas.length > 0) {
          const sorted = respostas
            .slice()
            .sort((a: any, b: any) => new Date(b.respondidoEm).getTime() - new Date(a.respondidoEm).getTime());
          const r = sorted[0];
          let valor: any = r?.resposta;
          if (typeof valor === 'string') {
            try {
              valor = JSON.parse(valor);
            } catch {
              // mantém string
            }
          }

          if (!respostasHistorico[chaveDept]) {
            respostasHistorico[chaveDept] = {
              departamentoId,
              etapa,
              departamentoNome: '',
              questionario: questionariosPorDepartamento[chaveDept] || [],
              respostas: {},
              respondidoEm: r?.respondidoEm,
              respondidoPor: r?.respondidoPor?.nome ?? undefined,
            };
          }

          respostasHistorico[chaveDept].respostas[String(normalized.id)] = valor;

          const tsPrev = respostasHistorico[chaveDept]?.respondidoEm
            ? new Date(respostasHistorico[chaveDept].respondidoEm).getTime()
            : 0;
          const tsNow = r?.respondidoEm ? new Date(r.respondidoEm).getTime() : 0;
          if (tsNow >= tsPrev) {
            respostasHistorico[chaveDept].respondidoEm = r?.respondidoEm;
            respostasHistorico[chaveDept].respondidoPor = r?.respondidoPor?.nome ?? undefined;
          }
        }
      }

      return {
        id: normalized.id,
        label: normalized.label,
        tipo: normalized.tipo,
        obrigatorio: normalized.obrigatorio,
        opcoes: normalized.opcoes,
        ordem: normalized.ordem,
        condicao: normalized.condicao,
        ...((normalized as any).modoRepeticao ? {
          modoRepeticao: (normalized as any).modoRepeticao,
          controladoPor: (normalized as any).controladoPor,
          subPerguntas: (normalized as any).subPerguntas,
        } : {}),
        departamentoId,
        etapa,
      };
    })
    .filter((q: any) => Number.isFinite(q?.id));

  const resultado = {
    ...raw,
    nomeEmpresa: raw?.nomeEmpresa ?? raw?.empresa ?? 'Nova Empresa',
    status: normalizeStatus(raw?.status),
    prioridade: normalizePrioridade(raw?.prioridade),
    departamentoAtual: Number(raw?.departamentoAtual ?? 0),
    departamentoAtualIndex: Number(raw?.departamentoAtualIndex ?? 0),
    fluxoDepartamentos: Array.isArray(raw?.fluxoDepartamentos)
      ? raw.fluxoDepartamentos.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v) && v > 0)
      : [],
    // Campos explícitos para departamentos independentes e interligação
    deptIndependente: Boolean(raw?.deptIndependente),
    processoOrigemId: raw?.processoOrigemId ? Number(raw.processoOrigemId) : null,
    interligadoComId: raw?.interligadoComId ? Number(raw.interligadoComId) : null,
    interligadoNome: raw?.interligadoNome ?? null,
    interligacaoTemplateIds: Array.isArray(raw?.interligacaoTemplateIds)
      ? raw.interligacaoTemplateIds.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v) && v > 0)
      : [],
    tags: tagsIds,
    tagsMetadata,
    comentarios,
    comentariosCount,
    documentos: Array.isArray(raw?.documentos) ? raw.documentos : [],
    documentosCount,
    questionarios,
    questionariosPorDepartamento,
    respostasHistorico,
    respostasInterligadas: Array.isArray(raw?.respostasInterligadas) ? raw.respostasInterligadas : [],
    historico,
    historicoEvento: historico,
  };
  return resultado;
};

const MENSAGENS_ERRO_HTTP: Record<number, string> = {
  400: 'Dados inválidos. Verifique as informações e tente novamente.',
  401: 'Sessão expirada. Faça login novamente.',
  403: 'Você não tem permissão para realizar esta ação.',
  404: 'O recurso solicitado não foi encontrado.',
  409: 'Conflito: este registro já existe ou foi modificado por outro usuário.',
  413: 'O arquivo enviado é muito grande.',
  422: 'Os dados enviados não puderam ser processados.',
  429: 'Muitas requisições. Aguarde um momento e tente novamente.',
  500: 'Erro interno do servidor. Tente novamente em alguns instantes.',
  502: 'Servidor temporariamente indisponível. Tente novamente.',
  503: 'Serviço indisponível no momento. Tente novamente em alguns instantes.',
};

async function parseError(response: Response) {
  try {
    const data = await response.json();
    let msg = '';

    if (data?.error) msg = String(data.error);
    else if (data?.message) msg = String(data.message);

    // Se a resposta incluir 'detalhes' (ex: validação de avanço), anexar ao erro
    if (Array.isArray(data?.detalhes) && data.detalhes.length > 0) {
      const detalhesStr = data.detalhes.map((d: any) => String(d)).join('; ');
      msg = msg ? `${msg}: ${detalhesStr}` : detalhesStr;
    }

    if (msg) return msg.slice(0, 600);

    // Algumas rotas retornam detalhes adicionais em 'details'
    if (typeof data?.details === 'string' && data.details.trim()) return String(data.details).slice(0, 300);
    if (data?.details && typeof data.details === 'object') {
      try {
        return stringifyJsonSafe(data.details).slice(0, 300);
      } catch {
        // ignore
      }
    }

    return MENSAGENS_ERRO_HTTP[response.status] || 'Erro na requisição';
  } catch {
    return MENSAGENS_ERRO_HTTP[response.status] || 'Erro na requisição';
  }
}

function stringifyJsonSafe(payload: unknown) {
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  const minSafe = BigInt(Number.MIN_SAFE_INTEGER);

  return JSON.stringify(payload, (_key, value) => {
    if (typeof value === 'bigint') {
      if (value <= maxSafe && value >= minSafe) {
        return Number(value);
      }
      return value.toString();
    }
    return value;
  });
}

function toPrismaEnum(value: any) {
  if (typeof value !== 'string') return value;
  return value === value.toLowerCase() ? value.toUpperCase() : value;
}

const getToken = () => {
  // Token agora e gerenciado exclusivamente via cookie httpOnly
  // definido pelo servidor. Nao usar mais localStorage por seguranca (XSS).
  return null;
};

export const fetchAutenticado = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers: HeadersInit = {
    ...options.headers,
  };

  // Se não for FormData, adiciona Content-Type
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers, credentials: options.credentials ?? 'include' });
  
  // Se não autorizado, cookie expirou ou é inválido
  if (response.status === 401) {
    // Não fazemos redirect automático, deixa o componente lidar
  }

  return response;
};

export const api = {
  // ========== LOGIN ==========
  login: async (email: string, senha: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
        credentials: 'include', // Importante para receber cookies
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer login');
      }
      
      const data = await response.json();

      // Token gerenciado via cookie httpOnly pelo servidor
      return data;
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      throw error;
    }
  },

  verifyEmailCode: async (email: string, code: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/verify-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao verificar código');
      }

      const data = await response.json();
      // Token gerenciado via cookie httpOnly pelo servidor
      return data;
    } catch (err) {
      console.error('Erro ao verificar código:', err);
      throw err;
    }
  },

  // ========== CONSULTAS EXTERNAS (PROXY) ==========
  consultarCnpj: async (cnpj: string) => {
    try {
      const digits = String(cnpj || '').replace(/\D/g, '');
      const response = await fetchAutenticado(`${API_URL}/cnpj/${digits}`);
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao consultar CNPJ:', error);
      throw error;
    }
  },

  // ========== PROCESSOS ==========
  getProcessos: async () => {
    try {
      const response = await fetchAutenticado(`${API_URL}/processos?lite=1`);
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data = await response.json();
      return Array.isArray(data) ? data.map(normalizeProcesso) : [];
    } catch (error) {
      console.error('Erro ao carregar processos:', error);
      throw error;
    }
  },

  getProcesso: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/processos/${id}`);
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data = await response.json();
      return normalizeProcesso(data);
    } catch (error) {
      console.error('Erro ao carregar processo:', error);
      throw error;
    }
  },

  avancarProcesso: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/processos/${id}/avancar`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data = await response.json();
      return normalizeProcesso(data);
    } catch (error) {
      console.error('Erro ao avançar processo:', error);
      throw error;
    }
  },

  voltarProcesso: async (id: number, destinoDepartamentoId?: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/processos/${id}/voltar`, {
        method: 'POST',
        body: destinoDepartamentoId ? JSON.stringify({ destinoDepartamentoId }) : undefined,
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data = await response.json();
      return normalizeProcesso(data);
    } catch (error) {
      console.error('Erro ao voltar processo:', error);
      throw error;
    }
  },

  salvarProcesso: async (processo: any) => {
    try {
      const payload = { ...processo };
      if (payload.status !== undefined) payload.status = toPrismaEnum(payload.status);
      if (payload.prioridade !== undefined) payload.prioridade = toPrismaEnum(payload.prioridade);

      const response = await fetchAutenticado(`${API_URL}/processos`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data = await response.json();
      return normalizeProcesso(data);
    } catch (error) {
      console.error('Erro ao salvar processo:', error);
      throw error;
    }
  },

  atualizarProcesso: async (id: number, processo: any) => {
    try {
      const payload = { ...processo };
      if (payload.status !== undefined) payload.status = toPrismaEnum(payload.status);
      if (payload.prioridade !== undefined) payload.prioridade = toPrismaEnum(payload.prioridade);

      const response = await fetchAutenticado(`${API_URL}/processos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data = await response.json();
      return normalizeProcesso(data);
    } catch (error) {
      console.error('Erro ao atualizar processo:', error);
      throw error;
    }
  },

  excluirProcesso: async (id: number, motivoExclusao?: string, motivoExclusaoCustom?: string) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/processos/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ motivoExclusao, motivoExclusaoCustom }),
      });
      if (!response.ok) {
        throw new Error('Erro ao excluir processo');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir processo:', error);
      throw error;
    }
  },

  adicionarTagProcesso: async (processoId: number, tagId: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/processos/${processoId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tagId }),
      });
      if (!response.ok) {
        throw new Error('Erro ao adicionar tag');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
      throw error;
    }
  },

  removerTagProcesso: async (processoId: number, tagId: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/processos/${processoId}/tags/${tagId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Erro ao remover tag');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao remover tag:', error);
      throw error;
    }
  },

  // ========== DEPARTAMENTOS ==========
  getDepartamentos: async () => {
    try {
      const response = await fetchAutenticado(`${API_URL}/departamentos`);
      return await response.json();
    } catch (error) {
      console.error('Erro ao carregar departamentos:', error);
      throw error;
    }
  },

  salvarDepartamento: async (departamento: any) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/departamentos`, {
        method: 'POST',
        body: JSON.stringify(departamento)
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao salvar departamento:', error);
      throw error;
    }
  },

  atualizarDepartamento: async (id: number, departamento: any) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/departamentos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(departamento)
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar departamento:', error);
      throw error;
    }
  },

  excluirDepartamento: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/departamentos/${id}`, {
        method: 'DELETE'
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir departamento:', error);
      throw error;
    }
  },

  // ========== DOCUMENTOS ==========
  getDocumentos: async (processoId: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/documentos?processoId=${processoId}`);
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data = await response.json();
      return Array.isArray(data) ? data : data.documentos || [];
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      throw error;
    }
  },

  uploadDocumento: async (processoId: number, arquivo: File, tipo: string, perguntaId?: number, departamentoId?: number, meta?: { visibility?: string; allowedRoles?: string[]; allowedUserIds?: number[]; allowedDepartamentos?: number[] }) => {
    try {
      const formData = new FormData();
      formData.append('arquivo', arquivo);
      formData.append('tipo', tipo);
      formData.append('processoId', String(processoId));
      if (perguntaId) formData.append('perguntaId', String(perguntaId));
      if (departamentoId) formData.append('departamentoId', String(departamentoId));
      if (meta?.visibility) formData.append('visibility', String(meta.visibility));
      if (Array.isArray(meta?.allowedRoles) && meta!.allowedRoles!.length > 0) formData.append('allowedRoles', meta!.allowedRoles!.join(','));
      if (Array.isArray(meta?.allowedUserIds) && meta!.allowedUserIds!.length > 0) formData.append('allowedUserIds', meta!.allowedUserIds!.map(String).join(','));
      if (Array.isArray(meta?.allowedDepartamentos) && meta!.allowedDepartamentos!.length > 0) formData.append('allowedDepartamentos', meta!.allowedDepartamentos!.map(String).join(','));

      const response = await fetchAutenticado(`${API_URL}/documentos`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      throw error;
    }
  },

  salvarQuestionariosProcesso: async (processoId: number, departamentoId: number, perguntas: any[]) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/questionarios`, {
        method: 'PUT',
        body: JSON.stringify({ processoId, departamentoId, perguntas }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao salvar questionários do processo:', error);
      throw error;
    }
  },

  excluirDocumento: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/documentos/${id}`, {
        method: 'DELETE'
      });

      // Se o documento já não existir, tratamos como sucesso (já removido)
      if (response.status === 404) {
        try {
          const body = await response.json().catch(() => ({} as any));
          console.warn('Excluir documento: já ausente no servidor', id, body);
        } catch {}
        return { alreadyDeleted: true };
      }

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir documento:', error);
      throw error;
    }
  },

  atualizarDocumento: async (id: number, dados: { visibility?: string; allowedRoles?: string[]; allowedUserIds?: number[]; allowedDepartamentos?: number[] }) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/documentos/${id}`, {
        method: 'PATCH',
        body: stringifyJsonSafe(dados),
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar documento:', error);
      throw error;
    }
  },

  // ========== QUESTIONÁRIOS ==========
  getQuestionarios: async (departamentoId: number, processoId?: number) => {
    try {
      const url = processoId 
        ? `${API_URL}/questionarios?departamentoId=${departamentoId}&processoId=${processoId}`
        : `${API_URL}/questionarios?departamentoId=${departamentoId}`;
      const response = await fetchAutenticado(url);
      if (!response.ok) {
        throw new Error('Erro ao carregar questionários');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao carregar questionários:', error);
      throw error;
    }
  },

  getRespostasQuestionario: async (processoId: number, departamentoId: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/questionarios/respostas/${processoId}/${departamentoId}`);
      if (!response.ok) {
        throw new Error('Erro ao carregar respostas');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao carregar respostas:', error);
      throw error;
    }
  },

  salvarRespostasQuestionario: async (processoId: number, departamentoId: number, respostas: any) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/questionarios/salvar-respostas`, {
        method: 'POST',
        body: JSON.stringify({ processoId, departamentoId, respostas })
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao salvar respostas:', error);
      throw error;
    }
  },

  // ========== COMENTÁRIOS ==========
  getComentarios: async (processoId: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/comentarios?processoId=${processoId}`);
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data = await response.json();
      const list = Array.isArray(data) ? data : data.comentarios || [];
      return list.map((c: any) => ({
        id: c.id,
        processoId: c.processoId,
        texto: c.texto,
        autor: c.autor?.nome ?? c.autor ?? '—',
        autorId: c.autor?.id ?? c.autorId ?? undefined,
        departamentoId: c.departamentoId ?? undefined,
        departamento: c.departamento?.nome ?? c.departamento ?? undefined,
        timestamp: c.criadoEm ?? c.timestamp ?? new Date().toISOString(),
        editado: Boolean(c.editado),
        editadoEm: c.editadoEm ?? undefined,
        mencoes: Array.isArray(c.mencoes) ? c.mencoes : [],
        parentId: c.parentId ?? null,
        // Campos de interligação
        isInterligado: c.isInterligado ?? false,
        processoOrigemId: c.processoOrigemId ?? c.processoId,
        processoOrigemNome: c.processoOrigemNome ?? '',
      }));
    } catch (error) {
      console.error('Erro ao carregar comentários:', error);
      throw error;
    }
  },

  salvarComentario: async (dados: any) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/comentarios`, {
        method: 'POST',
        body: JSON.stringify(dados)
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const c = await response.json();
      return {
        id: c.id,
        processoId: c.processoId,
        texto: c.texto,
        autor: c.autor?.nome ?? c.autor ?? '—',
        autorId: c.autor?.id ?? c.autorId ?? undefined,
        departamentoId: c.departamentoId ?? undefined,
        departamento: c.departamento?.nome ?? c.departamento ?? undefined,
        timestamp: c.criadoEm ?? c.timestamp ?? new Date().toISOString(),
        editado: Boolean(c.editado),
        editadoEm: c.editadoEm ?? undefined,
        mencoes: Array.isArray(c.mencoes) ? c.mencoes : [],
        parentId: c.parentId ?? null,
      };
    } catch (error) {
      console.error('Erro ao salvar comentário:', error);
      throw error;
    }
  },

  atualizarComentario: async (id: number, texto: string) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/comentarios/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ texto })
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar comentário:', error);
      throw error;
    }
  },

  excluirComentario: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/comentarios/${id}`, {
        method: 'DELETE'
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir comentário:', error);
      throw error;
    }
  },

  // ========== TAGS ==========
  getTags: async () => {
    try {
      const response = await fetchAutenticado(`${API_URL}/tags`);
      return await response.json();
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
      throw error;
    }
  },

  salvarTag: async (tag: any) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/tags`, {
        method: 'POST',
        body: JSON.stringify(tag)
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao salvar tag:', error);
      throw error;
    }
  },

  atualizarTag: async (id: number, tag: any) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/tags/${id}`, {
        method: 'PUT',
        body: JSON.stringify(tag)
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar tag:', error);
      throw error;
    }
  },

  excluirTag: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/tags/${id}`, {
        method: 'DELETE'
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir tag:', error);
      throw error;
    }
  },

  // ========== EMPRESAS ==========
  getEmpresas: async () => {
    try {
      const response = await fetchAutenticado(`${API_URL}/empresas`);
      return await response.json();
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
      throw error;
    }
  },

  salvarEmpresa: async (empresa: any) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/empresas`, {
        method: 'POST',
        body: JSON.stringify(empresa)
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao salvar empresa:', error);
      throw error;
    }
  },

  atualizarEmpresa: async (id: number, empresa: any) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/empresas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(empresa)
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar empresa:', error);
      throw error;
    }
  },

  excluirEmpresa: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/empresas/${id}`, {
        method: 'DELETE'
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir empresa:', error);
      throw error;
    }
  },

  // ========== DOCUMENTOS DA EMPRESA ==========
  getEmpresaDocumentos: async (empresaId: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/empresas/${empresaId}/documentos`);
      if (!response.ok) throw new Error(await parseError(response));
      return await response.json();
    } catch (error) {
      console.error('Erro ao carregar documentos da empresa:', error);
      throw error;
    }
  },

  uploadEmpresaDocumento: async (
    empresaId: number,
    arquivo: File,
    tipo: string,
    meta?: { descricao?: string; validadeAte?: string; alertarDiasAntes?: number }
  ) => {
    try {
      const formData = new FormData();
      formData.append('arquivo', arquivo);
      formData.append('tipo', tipo);
      if (meta?.descricao) formData.append('descricao', meta.descricao);
      if (meta?.validadeAte) formData.append('validadeAte', meta.validadeAte);
      if (meta?.alertarDiasAntes !== undefined) formData.append('alertarDiasAntes', String(meta.alertarDiasAntes));

      const response = await fetchAutenticado(`${API_URL}/empresas/${empresaId}/documentos`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(await parseError(response));
      return await response.json();
    } catch (error) {
      console.error('Erro ao fazer upload do documento da empresa:', error);
      throw error;
    }
  },

  excluirEmpresaDocumento: async (empresaId: number, documentoId: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/empresas/${empresaId}/documentos/${documentoId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(await parseError(response));
      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir documento da empresa:', error);
      throw error;
    }
  },

  atualizarEmpresaDocumento: async (
    empresaId: number,
    documentoId: number,
    dados: { visibility?: string; allowedRoles?: string[]; allowedUserIds?: number[]; allowedDepartamentos?: number[] }
  ) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/empresas/${empresaId}/documentos/${documentoId}`, {
        method: 'PATCH',
        body: stringifyJsonSafe(dados),
      });
      if (!response.ok) throw new Error(await parseError(response));
      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar documento da empresa:', error);
      throw error;
    }
  },

  // ========== PROJETOS (DOSSIÊ) ==========
  getProjetos: async (filtros?: { empresaId?: number; status?: string }) => {
    try {
      const qs = new URLSearchParams();
      if (filtros?.empresaId) qs.set('empresaId', String(filtros.empresaId));
      if (filtros?.status) qs.set('status', String(filtros.status));
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      const response = await fetchAutenticado(`${API_URL}/projetos${suffix}`);
      if (!response.ok) throw new Error(await parseError(response));
      return await response.json();
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      throw error;
    }
  },

  getProjeto: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/projetos/${id}`);
      if (!response.ok) throw new Error(await parseError(response));
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar projeto:', error);
      throw error;
    }
  },

  criarProjeto: async (dados: {
    nome: string;
    descricao?: string;
    empresaId?: number | null;
    responsavelId?: number | null;
    dataEntrega?: Date | string | null;
    status?: 'EM_ANDAMENTO' | 'CONCLUIDO' | 'PAUSADO' | 'CANCELADO';
  }) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/projetos`, {
        method: 'POST',
        body: JSON.stringify(dados),
      });
      if (!response.ok) throw new Error(await parseError(response));
      return await response.json();
    } catch (error) {
      console.error('Erro ao criar projeto:', error);
      throw error;
    }
  },

  atualizarProjeto: async (id: number, dados: Partial<{
    nome: string;
    descricao: string | null;
    empresaId: number | null;
    responsavelId: number | null;
    dataEntrega: Date | string | null;
    status: 'EM_ANDAMENTO' | 'CONCLUIDO' | 'PAUSADO' | 'CANCELADO';
  }>) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/projetos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(dados),
      });
      if (!response.ok) throw new Error(await parseError(response));
      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar projeto:', error);
      throw error;
    }
  },

  excluirProjeto: async (id: number, opts?: { excluirSolicitacoes?: boolean }) => {
    try {
      const qs = opts?.excluirSolicitacoes ? '?excluirSolicitacoes=true' : '';
      const response = await fetchAutenticado(`${API_URL}/projetos/${id}${qs}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(await parseError(response));
      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      throw error;
    }
  },

  atualizarObservacaoDepartamento: async (
    projetoId: number,
    departamentoId: number,
    observacao: string | null
  ) => {
    try {
      const response = await fetchAutenticado(
        `${API_URL}/projetos/${projetoId}/observacoes-departamento`,
        {
          method: 'PATCH',
          body: JSON.stringify({ departamentoId, observacao }),
        }
      );
      if (!response.ok) throw new Error(await parseError(response));
      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar observação do departamento:', error);
      throw error;
    }
  },

  // ========== TEMPLATES ==========
  getTemplates: async () => {
    try {
      const response = await fetchAutenticado(`${API_URL}/templates`);
      return await response.json();
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      throw error;
    }
  },

  salvarTemplate: async (template: any) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/templates`, {
        method: 'POST',
        body: JSON.stringify(template)
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      throw error;
    }
  },

  atualizarTemplate: async (id: number, template: any) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(template)
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      throw error;
    }
  },

  excluirTemplate: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/templates/${id}`, {
        method: 'DELETE'
      });
      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      throw error;
    }
  },

  // ========== USUÁRIOS ==========
  getUsuarios: async () => {
    try {
      const response = await fetchAutenticado(`${API_URL}/usuarios`);
      return await response.json();
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      throw error;
    }
  },

  getMe: async () => {
    try {
      const response = await fetchAutenticado(`${API_URL}/usuarios/me`);
      if (!response.ok) {
        throw new Error('Erro ao carregar dados do usuário');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      throw error;
    }
  },

  salvarUsuario: async (usuario: any) => {
    try {
      // O middleware já adiciona x-user-role automaticamente baseado no token
      // Mas garantimos que está sendo enviado
      const response = await fetchAutenticado(`${API_URL}/usuarios`, {
        method: 'POST',
        body: JSON.stringify(usuario),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({} as any));
        let msg = (error as any).error || 'Erro ao criar usuário';
        const details = (error as any).details;
        if (details && typeof details === 'object') {
          const nome = typeof details.nome === 'string' ? details.nome : '';
          const email = typeof details.email === 'string' ? details.email : '';
          const id = typeof details.usuarioId === 'number' ? details.usuarioId : null;
          if (nome || email || typeof id === 'number') {
            msg = `${msg}${email ? `: ${email}` : ''}${nome ? ` (usuário: ${nome})` : ''}${typeof id === 'number' ? ` [id ${id}]` : ''}`;
          }
        }
        throw new Error(msg);
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  },

  atualizarUsuario: async (id: number, usuario: any) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/usuarios/${id}`, {
        method: 'PUT',
        body: JSON.stringify(usuario),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({} as any));
        let msg = (error as any).error || 'Erro ao atualizar usuário';
        const details = (error as any).details;
        if (details && typeof details === 'object') {
          const nome = typeof details.nome === 'string' ? details.nome : '';
          const email = typeof details.email === 'string' ? details.email : '';
          const uid = typeof details.usuarioId === 'number' ? details.usuarioId : null;
          if (nome || email || typeof uid === 'number') {
            msg = `${msg}${email ? `: ${email}` : ''}${nome ? ` (usuário: ${nome})` : ''}${typeof uid === 'number' ? ` [id ${uid}]` : ''}`;
          }
        }
        throw new Error(msg);
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  },

  excluirUsuario: async (id: number, opts?: { permanente?: boolean }) => {
    try {
      const url = `${API_URL}/usuarios/${id}${opts?.permanente ? '?permanente=1' : ''}`;
      const response = await fetchAutenticado(url, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({} as any));
        throw new Error(error.error || 'Erro ao excluir usuário');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      throw error;
    }
  },

  // ========== NOTIFICAÇÕES ==========
  getNotificacoes: async () => {
    try {
      const response = await fetchAutenticado(`${API_URL}/notificacoes`);
      return await response.json();
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      throw error;
    }
  },

  marcarNotificacaoLida: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/notificacoes/${id}/marcar-lida`, {
        method: 'PATCH'
      });
      if (!response.ok) {
        throw new Error('Erro ao marcar notificação como lida');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      throw error;
    }
  },

  excluirNotificacao: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/notificacoes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as any)?.error || 'Erro ao excluir notificação');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir notificação:', error);
      throw error;
    }
  },

  // ========== USUÁRIOS (seleção de responsável) ==========
  getUsuariosResponsaveis: async (departamentoId?: number) => {
    try {
      const qs = Number.isFinite(departamentoId as any) ? `?departamentoId=${departamentoId}` : '';
      const response = await fetchAutenticado(`${API_URL}/usuarios/responsaveis${qs}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as any)?.error || 'Erro ao buscar usuários');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar usuários responsáveis:', error);
      throw error;
    }
  },

  // ========== ANALYTICS ==========
  getAnalytics: async (periodo?: number) => {
    try {
      const url = periodo 
        ? `${API_URL}/analytics?periodo=${periodo}`
        : `${API_URL}/analytics`;
      const response = await fetchAutenticado(url);
      if (!response.ok) {
        throw new Error('Erro ao carregar analytics');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao carregar analytics:', error);
      throw error;
    }
  },

  // ========== CALENDÁRIO ==========
  getEventosCalendario: async (params?: {
    inicio?: string;
    fim?: string;
    tipo?: string;
    departamentoId?: number;
    empresaId?: number;
    status?: string;
    incluirProcessos?: boolean;
    incluirDocumentos?: boolean;
  }) => {
    try {
      const searchParams = new URLSearchParams();
      if (params?.inicio) searchParams.set('inicio', params.inicio);
      if (params?.fim) searchParams.set('fim', params.fim);
      if (params?.tipo) searchParams.set('tipo', params.tipo);
      if (params?.departamentoId) searchParams.set('departamentoId', String(params.departamentoId));
      if (params?.empresaId) searchParams.set('empresaId', String(params.empresaId));
      if (params?.status) searchParams.set('status', params.status);
      if (params?.incluirProcessos) searchParams.set('incluirProcessos', 'true');
      if (params?.incluirDocumentos) searchParams.set('incluirDocumentos', 'true');
      
      const url = `${API_URL}/calendario?${searchParams.toString()}`;
      const response = await fetchAutenticado(url);
      if (!response.ok) {
        throw new Error('Erro ao carregar eventos do calendário');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      throw error;
    }
  },

  criarEventoCalendario: async (evento: {
    titulo: string;
    descricao?: string;
    tipo?: string;
    dataInicio: string;
    dataFim?: string;
    diaInteiro?: boolean;
    cor?: string;
    processoId?: number;
    empresaId?: number;
    departamentoId?: number;
    criadoPorId?: number;
    recorrencia?: string;
    recorrenciaFim?: string;
    alertaMinutosAntes?: number;
    privado?: boolean;
  }) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/calendario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evento),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as any)?.error || 'Erro ao criar evento');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      throw error;
    }
  },

  atualizarEventoCalendario: async (id: number, evento: Partial<{
    titulo: string;
    descricao: string;
    tipo: string;
    status: string;
    dataInicio: string;
    dataFim: string;
    diaInteiro: boolean;
    cor: string;
    processoId: number;
    empresaId: number;
    departamentoId: number;
    recorrencia: string;
    recorrenciaFim: string;
    alertaMinutosAntes: number;
  }>) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/calendario/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evento),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as any)?.error || 'Erro ao atualizar evento');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar evento:', error);
      throw error;
    }
  },

  excluirEventoCalendario: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/calendario/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as any)?.error || 'Erro ao excluir evento');
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      throw error;
    }
  },

  // Marcar evento como concluído
  concluirEventoCalendario: async (id: number) => {
    return api.atualizarEventoCalendario(id, { status: 'concluido' });
  },

  // ========== LIXEIRA ==========
  getLixeira: async (tipoItem?: string) => {
    try {
      const params = tipoItem ? `?tipoItem=${tipoItem}` : '';
      const response = await fetchAutenticado(`${API_URL}/lixeira${params}`);
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar lixeira:', error);
      throw error;
    }
  },

  getItemLixeira: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/lixeira/${id}`);
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar item da lixeira:', error);
      throw error;
    }
  },

  restaurarItemLixeira: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/lixeira/${id}`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao restaurar item da lixeira:', error);
      throw error;
    }
  },

  excluirItemLixeiraPermanente: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/lixeira/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir item permanentemente:', error);
      throw error;
    }
  },

  limparLixeira: async () => {
    try {
      const response = await fetchAutenticado(`${API_URL}/lixeira`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao limpar lixeira:', error);
      throw error;
    }
  },

  // =============================================
  // FAVORITOS
  // =============================================

  getFavoritos: async () => {
    try {
      const response = await fetchAutenticado(`${API_URL}/favoritos`);
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar favoritos:', error);
      throw error;
    }
  },

  adicionarFavorito: async (processoId: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/favoritos`, {
        method: 'POST',
        body: JSON.stringify({ processoId }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao adicionar favorito:', error);
      throw error;
    }
  },

  removerFavorito: async (processoId: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/favoritos`, {
        method: 'DELETE',
        body: JSON.stringify({ processoId }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao remover favorito:', error);
      throw error;
    }
  },

  toggleFavorito: async (processoId: number, isFavorito: boolean) => {
    if (isFavorito) {
      return api.removerFavorito(processoId);
    } else {
      return api.adicionarFavorito(processoId);
    }
  },

  // ========== LOGS DE AUDITORIA ==========
  getLogs: async (params?: { acao?: string; entidade?: string; limite?: number }) => {
    try {
      const search = new URLSearchParams();
      if (params?.acao) search.set('acao', params.acao);
      if (params?.entidade) search.set('entidade', params.entidade);
      if (params?.limite) search.set('limite', String(params.limite));
      const qs = search.toString();
      const response = await fetchAutenticado(`${API_URL}/logs${qs ? `?${qs}` : ''}`);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      return [];
    }
  },

  registrarLog: async (data: {
    acao: string;
    entidade: string;
    entidadeId?: number;
    entidadeNome?: string;
    campo?: string;
    valorAnterior?: string;
    valorNovo?: string;
    detalhes?: string;
    processoId?: number;
    empresaId?: number;
    departamentoId?: number;
  }) => {
    try {
      await fetchAutenticado(`${API_URL}/logs`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      // Silencioso - não deve impedir operações normais
    }
  },

  deleteLogs: async (params: { ids?: number[]; todos?: boolean }): Promise<{ success: boolean; deletados: number }> => {
    try {
      const response = await fetchAutenticado(`${API_URL}/logs`, {
        method: 'DELETE',
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any)?.error || 'Erro ao excluir logs');
      }
      return await response.json();
    } catch (error: any) {
      console.error('Erro ao excluir logs:', error);
      throw error;
    }
  },

  // ========== PROCESSOS EXCLUÍDOS ANALYTICS ==========
  getProcessosExcluidos: async () => {
    try {
      const response = await fetchAutenticado(`${API_URL}/analytics?tipo=excluidos`);
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  },

  // ========== IMPORTAR EMPRESAS ==========
  importarEmpresas: async (empresas: any[]) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/empresas`, {
        method: 'POST',
        body: JSON.stringify({ bulk: true, empresas }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao importar empresas:', error);
      throw error;
    }
  },

  // ========== FLUXOS DE INTERLIGACAO ==========
  getFluxosInterligacao: async () => {
    try {
      const response = await fetchAutenticado(`${API_URL}/fluxos-interligacao`);
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar fluxos de interligacao:', error);
      throw error;
    }
  },

  criarFluxoInterligacao: async (dados: { nome: string; descricao?: string; templateIds: number[] }) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/fluxos-interligacao`, {
        method: 'POST',
        body: JSON.stringify(dados),
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao criar fluxo de interligacao:', error);
      throw error;
    }
  },

  atualizarFluxoInterligacao: async (id: number, dados: { nome?: string; descricao?: string; templateIds?: number[] }) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/fluxos-interligacao/${id}`, {
        method: 'PUT',
        body: JSON.stringify(dados),
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar fluxo de interligacao:', error);
      throw error;
    }
  },

  excluirFluxoInterligacao: async (id: number) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/fluxos-interligacao/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir fluxo de interligacao:', error);
      throw error;
    }
  },
};
