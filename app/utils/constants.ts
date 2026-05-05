// Constantes da aplicação

export const PRIORIDADES = {
  ALTA: 'alta',
  MEDIA: 'media',
  BAIXA: 'baixa'
} as const;

export const STATUS_PROCESSO = {
  RASCUNHO: 'rascunho',
  EM_ANDAMENTO: 'em_andamento',
  PAUSADO: 'pausado',
  FINALIZADO: 'finalizado',
  CANCELADO: 'cancelado'
} as const;

export const TIPOS_CAMPO_FORMULARIO = {
  TEXTO: 'texto',
  TEXTAREA: 'textarea',
  NUMERO: 'numero',
  DATA: 'data',
  CHECKBOX: 'checkbox',
  SELECT: 'select',
  ARQUIVO: 'arquivo',
  TELEFONE: 'telefone',
  EMAIL: 'email',
  RADIO: 'radio',
  MULTIPLO: 'multiplo'
} as const;

export const TIPOS_OPERADOR_CONDICAO = {
  IGUAL: 'igual',
  DIFERENTE: 'diferente',
  CONTEM: 'contém',
  MAIOR: 'maior',
  MENOR: 'menor',
  SELECIONADO: 'selecionado',
  NAO_SELECIONADO: 'não_selecionado'
} as const;

export const TIPOS_DOCUMENTO = {
  DOCUMENTO_SUPLEMENTAR: 'documento_suplementar',
  COMPROVANTE: 'comprovante',
  ATESTADO: 'atestado',
  RESPOSTA_FORMULARIO: 'resposta_formulario',
  ARQUIVO_TEMPORARIO: 'arquivo_temporario'
} as const;

export const TIPOS_ALERTA = {
  SUCESSO: 'sucesso',
  ERRO: 'erro',
  AVISO: 'aviso',
  INFO: 'info'
} as const;

export const ICONES_DEPARTAMENTO = {
  ENTRADA: 'LogIn',
  ANALISE: 'SearchCheck',
  APROVACAO: 'CheckCircle2',
  ARQUIVOS: 'FileText',
  NOTIFICACAO: 'Bell',
  SAIDA: 'LogOut'
} as const;

export const LIMITES = {
  TAMANHO_MAX_ARQUIVO_MB: 10,
  LIMITE_DOCUMENTOS_POR_PROCESSO: 50,
  LIMITE_COMENTARIOS_POR_PAGINA: 20,
  LIMITE_PROCESSOS_POR_PAGINA: 50
} as const;

export const CORES_TAGS = [
  '#FF6B6B', // red
  '#4ECDC4', // teal
  '#45B7D1', // cyan
  '#FFA07A', // salmon
  '#98D8C8', // mint
  '#F7DC6F', // yellow
  '#BB8FCE', // purple
  '#85C1E2', // blue
  '#F8B88B', // orange
  '#A8E6CF'  // light green
] as const;

export const MENSAGENS = {
  SUCESSO_CRIAR_PROCESSO: 'Processo criado com sucesso',
  SUCESSO_ATUALIZAR_PROCESSO: 'Processo atualizado com sucesso',
  SUCESSO_EXCLUIR_PROCESSO: 'Processo excluído com sucesso',
  ERRO_CRIAR_PROCESSO: 'Erro ao criar processo. Tente novamente.',
  ERRO_ATUALIZAR_PROCESSO: 'Erro ao atualizar processo. Tente novamente.',
  ERRO_EXCLUIR_PROCESSO: 'Erro ao excluir processo. Tente novamente.',
  ERRO_CARREGAR_PROCESSOS: 'Erro ao carregar processos. Tente novamente.',
  
  SUCESSO_CRIAR_DEPARTAMENTO: 'Departamento criado com sucesso',
  SUCESSO_ATUALIZAR_DEPARTAMENTO: 'Departamento atualizado com sucesso',
  SUCESSO_EXCLUIR_DEPARTAMENTO: 'Departamento excluído com sucesso',
  ERRO_CRIAR_DEPARTAMENTO: 'Erro ao criar departamento. Tente novamente.',
  ERRO_ATUALIZAR_DEPARTAMENTO: 'Erro ao atualizar departamento. Tente novamente.',
  ERRO_EXCLUIR_DEPARTAMENTO: 'Erro ao excluir departamento. Tente novamente.',
  
  SUCESSO_UPLOAD_DOCUMENTO: 'Documento enviado com sucesso',
  ERRO_UPLOAD_DOCUMENTO: 'Erro ao enviar documento. Tente novamente.',
  ARQUIVO_MUITO_GRANDE: `Arquivo deve ter no máximo ${LIMITES.TAMANHO_MAX_ARQUIVO_MB}MB`,
  
  SUCESSO_SALVAR_RESPOSTAS: 'Respostas salvas com sucesso',
  ERRO_SALVAR_RESPOSTAS: 'Erro ao salvar respostas. Tente novamente.',
  
  SUCESSO_CRIAR_TAG: 'Tag criada com sucesso',
  SUCESSO_ATUALIZAR_TAG: 'Tag atualizada com sucesso',
  SUCESSO_EXCLUIR_TAG: 'Tag excluída com sucesso',
  ERRO_CRIAR_TAG: 'Erro ao criar tag. Tente novamente.',
  ERRO_ATUALIZAR_TAG: 'Erro ao atualizar tag. Tente novamente.',
  ERRO_EXCLUIR_TAG: 'Erro ao excluir tag. Tente novamente.',
  
  CONFIRMACAO_EXCLUIR: 'Tem certeza que deseja excluir?',
  CONFIRMACAO_EXCLUIR_PROCESSO: 'Tem certeza que deseja excluir este processo?',
  CONFIRMACAO_EXCLUIR_DEPARTAMENTO: 'Tem certeza que deseja excluir este departamento?',
  CONFIRMACAO_EXCLUIR_TAG: 'Tem certeza que deseja excluir esta tag?',
  
  CAMPO_OBRIGATORIO: 'Este campo é obrigatório',
  EMAIL_INVALIDO: 'Email inválido',
  TELEFONE_INVALIDO: 'Telefone inválido',
  CPF_INVALIDO: 'CPF inválido',
  CNPJ_INVALIDO: 'CNPJ inválido'
} as const;

export const API_ENDPOINTS = {
  LOGIN: '/login',
  LOGOUT: '/logout',
  
  PROCESSOS: '/processos',
  PROCESSOS_ID: (id: number) => `/processos/${id}`,
  
  DEPARTAMENTOS: '/departamentos',
  DEPARTAMENTOS_ID: (id: number) => `/departamentos/${id}`,
  
  DOCUMENTOS: '/documentos',
  DOCUMENTOS_ID: (id: number) => `/documentos/${id}`,
  DOCUMENTOS_PROCESSO: (processoId: number) => `/documentos?processoId=${processoId}`,
  
  QUESTIONARIOS: '/questionarios',
  QUESTIONARIOS_RESPOSTAS: (processoId: number, departamentoId: number) => 
    `/questionarios/respostas/${processoId}/${departamentoId}`,
  QUESTIONARIOS_SALVAR: '/questionarios/salvar-respostas',
  
  COMENTARIOS: '/comentarios',
  COMENTARIOS_ID: (id: number) => `/comentarios/${id}`,
  COMENTARIOS_PROCESSO: (processoId: number) => `/comentarios?processoId=${processoId}`,
  
  TAGS: '/tags',
  TAGS_ID: (id: number) => `/tags/${id}`,
  
  EMPRESAS: '/empresas',
  EMPRESAS_ID: (id: number) => `/empresas/${id}`,
  
  TEMPLATES: '/templates',
  TEMPLATES_ID: (id: number) => `/templates/${id}`,
  
  USUARIOS: '/usuarios',
  USUARIOS_ME: '/usuarios/me',
  
  NOTIFICACOES: '/notificacoes',
  NOTIFICACOES_ID: (id: number) => `/notificacoes/${id}`,
  NOTIFICACOES_LIDA: (id: number) => `/notificacoes/${id}/marcar-lida`
} as const;

export const DURACAO_ANIMACOES = {
  ALERTA: 3000,
  TOOLTIP: 200,
  TRANSICAO: 300,
  FADE: 200
} as const;

// ==================== USUÁRIOS ESPECIAIS ====================
// Ghost user: não aparece em logs, permissões superiores a todos
export const GHOST_USER_ID = 'bdf74a16-ef7e-477e-ab81-ae3a25b41375';
// Para uso com IDs numéricos internos, mapeamos via email
export const GHOST_USER_EMAIL = 'ghost@triar.system';
// Usuário master adicional (Yasmin) - mesmas permissões do ghost para editar/excluir
export const MASTER_USER_EMAIL = 'yasmin@triarcontabilidade.com.br';

// IDs numéricos são definidos em runtime após consulta ao banco
// Estes emails são usados para verificar se um usuário é "super"
export function isGhostUser(userId: number | string | undefined | null, email?: string): boolean {
  if (!userId && !email) return false;
  if (email === GHOST_USER_EMAIL) return true;
  if (String(userId) === GHOST_USER_ID) return true;
  return false;
}

export function isSuperUser(userId: number | string | undefined | null, email?: string): boolean {
  if (isGhostUser(userId, email)) return true;
  if (email === MASTER_USER_EMAIL) return true;
  return false;
}

// Senha mínima
export const SENHA_MIN_LENGTH = 8;

export const STORAGE_KEYS = {
  TOKEN: 'token',
  USUARIO: 'usuario',
  TEMA: 'tema',
  RESPOSTAS_BACKUP: 'respostas_backup',
  SCROLL_POSITION: 'scroll_position',
  FILTROS_SALVOS: 'filtros_salvos'
} as const;

export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  TELEFONE: /^\d{10,15}$/,
  NUMERO: /^\d+$/,
  URL: /^https?:\/\/.+/,
  DATA_BR: /^\d{2}\/\d{2}\/\d{4}$/
} as const;

export const HORARIOS_FUNCIONAMENTO = {
  INICIO: '08:00',
  FIM: '18:00',
  INTERVALO: '12:00'
} as const;
