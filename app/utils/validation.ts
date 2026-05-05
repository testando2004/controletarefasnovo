import { z } from 'zod';

// ============================================
// VALIDAÇÕES DE CAMPOS
// ============================================

export const cpfSchema = z.string().transform((v) => v.replace(/\D/g, '')).refine((v) => v.length === 11 && cpfValido(v), { message: 'CPF inválido' });
export const cnpjSchema = z.string().transform((v) => v.replace(/\D/g, '')).refine((v) => v.length === 14 && cnpjValido(v), { message: 'CNPJ inválido' });
export const ieSchema = z.string().min(2, 'IE inválida');
export const telefoneSchema = z.string().transform((v) => v.replace(/\D/g, '')).refine((v) => v.length >= 10 && v.length <= 11, { message: 'Telefone inválido' });
export const cepSchema = z.string().transform((v) => v.replace(/\D/g, '')).refine((v) => v.length === 8, { message: 'CEP inválido' });
export const emailSchema = z.string().email('E-mail inválido');

export const loginSchema = z.object({
  nome: z.string().min(1, 'Informe o usuário'),
  senha: z.string().min(1, 'Informe a senha'),
});

// ============================================
// VALIDAÇÕES DE PROCESSOS
// ============================================

export const processoSchema = z.object({
  nomeServico: z.string().min(3, 'Nome do serviço deve ter no mínimo 3 caracteres'),
  nomeEmpresa: z.string().min(3, 'Nome da empresa é obrigatório'),
  status: z.enum(['em_andamento', 'finalizado', 'pausado', 'cancelado', 'rascunho'], {
    errorMap: () => ({ message: 'Status inválido' })
  }),
  prioridade: z.enum(['alta', 'media', 'baixa'], {
    errorMap: () => ({ message: 'Prioridade inválida' })
  }),
  departamentoAtual: z.number().positive('Departamento é obrigatório'),
  dataEntrega: z.date().optional(),
  email: emailSchema.optional().or(z.literal('')),
  telefone: telefoneSchema.optional().or(z.literal('')),
  descricao: z.string().max(5000, 'Descrição muito longa (máx 5000 caracteres)').optional(),
});

export const empresaSchema = z.object({
  razao_social: z.string().min(3, 'Razão social deve ter no mínimo 3 caracteres'),
  cnpj: cnpjSchema.optional().or(z.literal('')),
  codigo: z.string().min(1, 'Código é obrigatório'),
  inscricao_estadual: z.string().optional(),
  email: emailSchema.optional().or(z.literal('')),
  telefone: telefoneSchema.optional().or(z.literal('')),
  cep: cepSchema.optional().or(z.literal('')),
});

export const usuarioSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: emailSchema,
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  role: z.enum(['admin', 'gerente', 'usuario'], {
    errorMap: () => ({ message: 'Perfil inválido' })
  }),
  departamentoId: z.number().positive().optional(),
});

export const departamentoSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  descricao: z.string().optional(),
  responsavel: z.string().optional(),
  cor: z.string().min(1, 'Cor é obrigatória'),
  ordem: z.number().nonnegative('Ordem deve ser maior ou igual a 0'),
});

export const questionarioSchema = z.object({
  label: z.string().min(1, 'Texto da pergunta é obrigatório'),
  tipo: z.enum(['text', 'textarea', 'number', 'date', 'boolean', 'select', 'checkbox', 'file', 'phone', 'email', 'cpf', 'cnpj', 'cep', 'money', 'grupo_repetivel', 'titulo'], {
    errorMap: () => ({ message: 'Tipo de pergunta inválido' })
  }),
  obrigatorio: z.boolean(),
  opcoes: z.array(z.string()).optional(),
  ordem: z.number().nonnegative().optional(),
});

// ============================================
// TIPOS DE VALIDAÇÃO
// ============================================

export type ErroValidacao = {
  campo: string;
  mensagem: string;
  tipo: 'erro' | 'aviso';
};

export type ResultadoValidacao = {
  valido: boolean;
  erros: ErroValidacao[];
};

// ============================================
// FUNÇÕES DE VALIDAÇÃO DE REQUISITOS
// ============================================

/**
 * Valida se um processo está pronto para avançar de departamento
 */
export function validarAvancoDepartamento(params: {
  processo: any;
  departamento: any;
  questionarios: any[];
  documentos: any[];
  respostas: Record<number, any>;
}): ResultadoValidacao {
  const erros: ErroValidacao[] = [];
  const { processo, departamento, questionarios, documentos, respostas } = params;

  const isRespostaVazia = (valor: any): boolean => {
    if (valor === null || valor === undefined) return true;
    if (typeof valor === 'string') return valor.trim().length === 0;
    if (Array.isArray(valor)) return valor.length === 0;
    return false;
  };

  // Função auxiliar para avaliar condições
  const avaliarCondicao = (pergunta: any): boolean => {
    if (!pergunta?.condicao) return true; // sem condição → sempre visível
    const { perguntaId, operador, valor } = pergunta.condicao;
    const respostaCond = respostas[perguntaId];
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

  // 1. Validar questionários obrigatórios respondidos
  const perguntasObrigatorias = questionarios.filter(q => q.obrigatorio);
  for (const pergunta of perguntasObrigatorias) {
    // Se a pergunta tem condição e ela não é satisfeita, pular validação
    if (!avaliarCondicao(pergunta)) continue;

    const resposta = respostas[pergunta.id];
    const tipoNormalizado = (pergunta.tipo || '').toString().toLowerCase();

    // Para checkbox, verificar se array tem pelo menos 1 item
    if (tipoNormalizado === 'checkbox') {
      let valores: string[] = [];
      try {
        if (typeof resposta === 'string') {
          valores = JSON.parse(resposta);
        } else if (Array.isArray(resposta)) {
          valores = resposta;
        }
      } catch {
        valores = [];
      }
      if (valores.length === 0) {
        erros.push({
          campo: `pergunta_${pergunta.id}`,
          mensagem: `Pergunta obrigatória não respondida: "${pergunta.label}"`,
          tipo: 'erro',
        });
      }
    } else if (tipoNormalizado === 'boolean') {
      // Para boolean, "false" é uma resposta válida
      if (resposta === null || resposta === undefined) {
        erros.push({
          campo: `pergunta_${pergunta.id}`,
          mensagem: `Pergunta obrigatória não respondida: "${pergunta.label}"`,
          tipo: 'erro',
        });
      }
    } else if (tipoNormalizado === 'file') {
      // Para file, a validação de documentos é feita separadamente
      // Verificar se existe algum documento vinculado à pergunta
      const docVinculado = documentos.find(
        (d: any) => Number(d?.perguntaId ?? d?.pergunta_id) === Number(pergunta.id)
      );
      if (!docVinculado && (!resposta || resposta === '' || resposta === null)) {
        erros.push({
          campo: `pergunta_${pergunta.id}`,
          mensagem: `Arquivo obrigatório não enviado: "${pergunta.label}"`,
          tipo: 'erro',
        });
      }
    } else if (isRespostaVazia(resposta)) {
      erros.push({
        campo: `pergunta_${pergunta.id}`,
        mensagem: `Pergunta obrigatória não respondida: "${pergunta.label}"`,
        tipo: 'erro',
      });
    }

    // Validar tipo de resposta
    if (!isRespostaVazia(resposta)) {
      const erroTipo = validarTipoResposta(pergunta, resposta);
      if (erroTipo) erros.push(erroTipo);
    }
  }

  // 2. Validar documentos obrigatórios
  const documentosObrigatorios = departamento.documentosObrigatorios || [];
  for (const docObrigatorio of documentosObrigatorios) {
    const docEncontrado = documentos.find(
      d => d.tipo === docObrigatorio.tipo || d.tipoCategoria === docObrigatorio.tipo
    );
    
    if (!docEncontrado) {
      erros.push({
        campo: `documento_${docObrigatorio.id}`,
        mensagem: `Documento obrigatório não enviado: "${docObrigatorio.nome}"`,
        tipo: 'erro',
      });
    }
  }

  // 3. Validar regras de negócio específicas
  if (processo.prioridade === 'alta' && !processo.dataEntrega) {
    erros.push({
      campo: 'dataEntrega',
      mensagem: 'Processos de alta prioridade devem ter prazo de entrega definido',
      tipo: 'aviso',
    });
  }

  return {
    valido: erros.filter(e => e.tipo === 'erro').length === 0,
    erros,
  };
}

/**
 * Valida tipo de resposta de questionário
 */
function validarTipoResposta(pergunta: any, resposta: any): ErroValidacao | null {
  try {
    switch ((pergunta.tipo || '').toString().toLowerCase()) {
      case 'email':
        emailSchema.parse(resposta);
        break;
      case 'phone':
        telefoneSchema.parse(resposta);
        break;
      case 'number':
        if (isNaN(Number(resposta))) {
          return {
            campo: `pergunta_${pergunta.id}`,
            mensagem: `"${pergunta.label}" deve ser um número válido`,
            tipo: 'erro',
          };
        }
        break;
      case 'date':
        if (!isValidDate(resposta)) {
          return {
            campo: `pergunta_${pergunta.id}`,
            mensagem: `"${pergunta.label}" deve ser uma data válida`,
            tipo: 'erro',
          };
        }
        break;
      case 'file':
        // Validar que há arquivo anexado
        if (!resposta || (Array.isArray(resposta) && resposta.length === 0)) {
          return {
            campo: `pergunta_${pergunta.id}`,
            mensagem: `Arquivo obrigatório não anexado: "${pergunta.label}"`,
            tipo: 'erro',
          };
        }
        break;
      case 'checkbox':
        // Validar que é um array válido e tem pelo menos 1 item selecionado se obrigatório
        let valores: string[] = [];
        try {
          if (typeof resposta === 'string') {
            valores = JSON.parse(resposta);
          } else if (Array.isArray(resposta)) {
            valores = resposta;
          }
        } catch {
          valores = [];
        }
        if (pergunta.obrigatorio && valores.length === 0) {
          return {
            campo: `pergunta_${pergunta.id}`,
            mensagem: `Selecione pelo menos uma opção para "${pergunta.label}"`,
            tipo: 'erro',
          };
        }
        break;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        campo: `pergunta_${pergunta.id}`,
        mensagem: error.errors[0]?.message || 'Resposta inválida',
        tipo: 'erro',
      };
    }
  }
  
  return null;
}

function isValidDate(dateString: any): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Calcula progresso de completude de um processo no departamento atual
 */
export function calcularProgresso(params: {
  questionarios: any[];
  documentosObrigatorios: any[];
  respostas: Record<number, any>;
  documentos: any[];
}): {
  percentual: number;
  itensCompletos: number;
  itensTotal: number;
  detalhes: {
    questionarios: { completos: number; total: number };
    documentos: { completos: number; total: number };
  };
} {
  const { questionarios, documentosObrigatorios, respostas, documentos } = params;

  const perguntasObrigatorias = questionarios.filter(q => q.obrigatorio);
  const perguntasRespondidas = perguntasObrigatorias.filter(p => {
    const resposta = respostas[p.id];
    
    // Para checkbox, verificar se tem pelo menos 1 item selecionado
    if (p.tipo === 'checkbox') {
      let valores: string[] = [];
      try {
        if (typeof resposta === 'string') {
          valores = JSON.parse(resposta);
        } else if (Array.isArray(resposta)) {
          valores = resposta;
        }
      } catch {
        valores = [];
      }
      return valores.length > 0;
    }
    
    return resposta !== undefined && resposta !== '' && resposta !== null;
  });

  const docsEnviados = documentosObrigatorios.filter(docObrig =>
    documentos.some(d => d.tipo === docObrig.tipo || d.tipoCategoria === docObrig.tipo)
  );

  const itensCompletos = perguntasRespondidas.length + docsEnviados.length;
  const itensTotal = perguntasObrigatorias.length + documentosObrigatorios.length;

  return {
    percentual: itensTotal > 0 ? Math.round((itensCompletos / itensTotal) * 100) : 100,
    itensCompletos,
    itensTotal,
    detalhes: {
      questionarios: {
        completos: perguntasRespondidas.length,
        total: perguntasObrigatorias.length,
      },
      documentos: {
        completos: docsEnviados.length,
        total: documentosObrigatorios.length,
      },
    },
  };
}

function cpfValido(cpf: string): boolean {
  if (!cpf || cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cpf.charAt(9))) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(cpf.charAt(10));
}

function cnpjValido(cnpj: string): boolean {
  if (!cnpj || cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const calc = (x: number) => {
    let n = 0;
    let pos = x - 7;
    for (let i = 0; i < x; i++) n += parseInt(cnpj.charAt(i)) * pos--, pos = pos < 2 ? 9 : pos;
    const r = n % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(12);
  const d2 = calc(13);
  return d1 === parseInt(cnpj.charAt(12)) && d2 === parseInt(cnpj.charAt(13));
}
