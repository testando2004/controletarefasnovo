// Utilitários e funções auxiliares

import { Processo } from '../types';

/**
 * Obtém as cores do badge de prioridade baseado na prioridade
 */
export const getPriorityColor = (prioridade: string): { bg: string; text: string; border: string } => {
  switch (prioridade.toLowerCase()) {
    case 'alta':
      return { bg: 'bg-red-100 dark:bg-red-700', text: 'text-red-800 dark:text-white', border: 'border-red-200 dark:border-red-600' };
    case 'media':
      return { bg: 'bg-yellow-100 dark:bg-yellow-600', text: 'text-yellow-800 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-500' };
    case 'baixa':
      return { bg: 'bg-green-100 dark:bg-green-700', text: 'text-green-800 dark:text-green-300', border: 'border-green-200 dark:border-green-600' };
    default:
      return { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-200', border: 'border-gray-200 dark:border-gray-600' };
  }
};

/**
 * Obtém a cor do texto para o badge de prioridade
 */
export const getPriorityTextColor = (prioridade: string): string => {
  const colors = getPriorityColor(prioridade);
  return colors.text;
};

/**
 * Obtém a cor de fundo para o badge de prioridade
 */
export const getPriorityBgColor = (prioridade: string): string => {
  const colors = getPriorityColor(prioridade);
  return colors.bg;
};

/**
 * Obtém a cor da borda para o badge de prioridade
 */
export const getPriorityBorderColor = (prioridade: string): string => {
  const colors = getPriorityColor(prioridade);
  return colors.border;
};

/**
 * Obtém o texto formatado do status
 */
export const getStatusLabel = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'em_andamento':
      return 'Em Andamento';
    case 'finalizado':
      return 'Finalizado';
    case 'pausado':
      return 'Pausado';
    case 'cancelado':
      return 'Cancelado';
    case 'rascunho':
      return 'Rascunho';
    default:
      return status;
  }
};

/**
 * Obtém a cor do badge de status
 */
export const getStatusColor = (status: string): { bg: string; text: string; border: string } => {
  switch (status.toLowerCase()) {
    case 'em_andamento':
      return { bg: 'bg-blue-50 dark:bg-blue-700', text: 'text-blue-700 dark:text-white', border: 'border-blue-200 dark:border-blue-600' };
    case 'finalizado':
      return { bg: 'bg-green-50 dark:bg-green-700', text: 'text-green-700 dark:text-white', border: 'border-green-200 dark:border-green-600' };
    case 'pausado':
      return { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-200', border: 'border-gray-200 dark:border-gray-600' };
    case 'cancelado':
      return { bg: 'bg-red-50 dark:bg-red-700', text: 'text-red-700 dark:text-white', border: 'border-red-200 dark:border-red-600' };
    case 'rascunho':
      return { bg: 'bg-yellow-50 dark:bg-yellow-600', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-500' };
    default:
      return { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-200', border: 'border-gray-200 dark:border-gray-600' };
  }
};

/**
 * Formata data para formato brasileiro (DD/MM/YYYY)
 */
export const formatarData = (data: string | Date): string => {
  if (!data) return '';

  const date = typeof data === 'string' ? new Date(data) : data;
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const ano = date.getFullYear();

  return `${dia}/${mes}/${ano}`;
};

/**
 * Formata data e hora para formato brasileiro (DD/MM/YYYY HH:MM)
 */
export const formatarDataHora = (data: string | Date): string => {
  if (!data) return '';

  const date = typeof data === 'string' ? new Date(data) : data;
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const ano = date.getFullYear();
  const hora = String(date.getHours()).padStart(2, '0');
  const minuto = String(date.getMinutes()).padStart(2, '0');

  return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
};

/**
 * Calcula o tempo decorrido desde uma data
 */
export const calcularTempoDecorrido = (data: string | Date): string => {
  const dataInicio = typeof data === 'string' ? new Date(data) : data;
  const agora = new Date();
  
  const diffMs = agora.getTime() - dataInicio.getTime();
  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDias = Math.floor(diffHoras / 24);
  const diffSemanas = Math.floor(diffDias / 7);
  const diffMeses = Math.floor(diffDias / 30);

  if (diffMeses > 0) return `${diffMeses}m atrás`;
  if (diffSemanas > 0) return `${diffSemanas}s atrás`;
  if (diffDias > 0) return `${diffDias}d atrás`;
  if (diffHoras > 0) return `${diffHoras}h atrás`;

  const diffMinutos = Math.floor(diffMs / (1000 * 60));
  if (diffMinutos > 0) return `${diffMinutos}min atrás`;

  return 'Agora';
};

/**
 * Formata tamanho de arquivo em bytes para formato legível
 */
export const formatarTamanhoParcela = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Formata/encurta nomes de arquivos para exibição mantendo a extensão.
 */
export const formatarNomeArquivo = (nome?: string | null, maxLen = 48): string => {
  if (!nome) return '';
  const raw = String(nome);
  if (raw.length <= maxLen) return raw;
  const lastDot = raw.lastIndexOf('.');
  const ext = lastDot > 0 ? raw.slice(lastDot) : '';
  const keep = Math.max(6, maxLen - (ext.length + 3));
  return `${raw.slice(0, keep)}...${ext}`;
};

/**
 * Valida um email
 */
export const validarEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida um telefone
 */
export const validarTelefone = (telefone: string): boolean => {
  const apenasNumeros = telefone.replace(/\D/g, '');
  return apenasNumeros.length >= 10 && apenasNumeros.length <= 15;
};

/**
 * Valida um CPF
 */
export const validarCPF = (cpf: string): boolean => {
  const apenasNumeros = cpf.replace(/\D/g, '');

  if (apenasNumeros.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(apenasNumeros)) return false;

  let soma = 0;
  let resto;

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(apenasNumeros.substring(i - 1, i)) * (11 - i);
  }

  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(apenasNumeros.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(apenasNumeros.substring(i - 1, i)) * (12 - i);
  }

  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(apenasNumeros.substring(10, 11))) return false;

  return true;
};

/**
 * Valida um CNPJ
 */
export const validarCNPJ = (cnpj: string): boolean => {
  const apenasNumeros = cnpj.replace(/\D/g, '');

  if (apenasNumeros.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(apenasNumeros)) return false;

  let tamanho = apenasNumeros.length - 2;
  let numeros = apenasNumeros.substring(0, tamanho);
  const digitos = apenasNumeros.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = apenasNumeros.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
};

/**
 * Formata CPF para exibição (XXX.XXX.XXX-XX)
 */
export const formatarCPF = (cpf: string): string => {
  const apenasNumeros = cpf.replace(/\D/g, '');
  return apenasNumeros
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{2})$/, '$1-$2');
};

/**
 * Formata CNPJ para exibição (XX.XXX.XXX/XXXX-XX)
 */
export const formatarCNPJ = (cnpj: string): string => {
  const apenasNumeros = cnpj.replace(/\D/g, '');
  return apenasNumeros
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

/**
 * Formata telefone para exibição ((XX) XXXXX-XXXX)
 */
export const formatarTelefone = (telefone: string): string => {
  const apenasNumeros = telefone.replace(/\D/g, '');

  if (apenasNumeros.length === 11) {
    return apenasNumeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (apenasNumeros.length === 10) {
    return apenasNumeros.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  return telefone;
};

/**
 * Mascara entrada de CPF
 */
export const mascaraCPF = (valor: string): string => {
  const apenasNumeros = valor.replace(/\D/g, '').substring(0, 11);
  return formatarCPF(apenasNumeros);
};

/**
 * Mascara entrada de CNPJ
 */
export const mascaraCNPJ = (valor: string): string => {
  const apenasNumeros = valor.replace(/\D/g, '').substring(0, 14);
  return formatarCNPJ(apenasNumeros);
};

/**
 * Mascara entrada de Telefone
 */
export const mascaraTelefone = (valor: string): string => {
  const apenasNumeros = valor.replace(/\D/g, '').substring(0, 11);
  return formatarTelefone(apenasNumeros);
};

/**
 * Obtém iniciais de um nome para avatar
 */
export const obterIniciais = (nome: string): string => {
  if (!nome) return '?';
  return nome
    .split(' ')
    .map(palavra => palavra.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
};

/**
 * Gera uma cor aleatória com base em um hash do nome
 */
export const gerarCorDoNome = (nome: string): string => {
  const cores = [
    '#3B82F6', // blue
    '#EF4444', // red
    '#10B981', // green
    '#F59E0B', // amber
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
  ];

  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }

  return cores[Math.abs(hash) % cores.length];
};

/**
 * Debounce function para evitar chamadas repetidas
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function para limitar chamadas
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Copia texto para a área de transferência
 */
export const copiarParaPrancheta = async (texto: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (err) {
    console.error('Erro ao copiar:', err);
    return false;
  }
};

/**
 * Gera um ID único
 */
export const gerarIdUnico = (): string => {
  return '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Obtém as cores padrão dos departamentos
 */
export const getCorsDepartamento = (index: number): { gradient: string; bg: string; text: string } => {
  const cores = [
    { gradient: 'from-blue-500 to-blue-700', bg: 'bg-blue-100', text: 'text-blue-700' },
    { gradient: 'from-cyan-500 to-cyan-700', bg: 'bg-cyan-100', text: 'text-cyan-700' },
    { gradient: 'from-indigo-500 to-indigo-700', bg: 'bg-indigo-100', text: 'text-indigo-700' },
    { gradient: 'from-purple-500 to-purple-700', bg: 'bg-purple-100', text: 'text-purple-700' },
    { gradient: 'from-pink-500 to-pink-700', bg: 'bg-pink-100', text: 'text-pink-700' },
    { gradient: 'from-red-500 to-red-700', bg: 'bg-red-100', text: 'text-red-700' },
    { gradient: 'from-orange-500 to-orange-700', bg: 'bg-orange-100', text: 'text-orange-700' },
    { gradient: 'from-yellow-500 to-yellow-600', bg: 'bg-yellow-100', text: 'text-yellow-700' },
    { gradient: 'from-lime-500 to-lime-700', bg: 'bg-lime-100', text: 'text-lime-700' },
    { gradient: 'from-green-500 to-green-700', bg: 'bg-green-100', text: 'text-green-700' },
    { gradient: 'from-emerald-500 to-emerald-700', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    { gradient: 'from-teal-500 to-teal-700', bg: 'bg-teal-100', text: 'text-teal-700' },
    { gradient: 'from-slate-500 to-slate-700', bg: 'bg-slate-100', text: 'text-slate-700' },
    { gradient: 'from-amber-700 to-amber-900', bg: 'bg-amber-100', text: 'text-amber-700' },
    { gradient: 'from-rose-700 to-rose-900', bg: 'bg-rose-100', text: 'text-rose-700' },
    { gradient: 'from-blue-700 to-blue-900', bg: 'bg-blue-100', text: 'text-blue-800' },
  ];

  return cores[index % cores.length];
};

/**
 * Ordena processos por departamento
 */
export const ordenarProcessosPorDepartamento = (processos: Processo[], departamentos: any[]): Processo[] => {
  return processos.sort((a, b) => {
    const deptA = departamentos.find(d => d.id === a.departamentoAtual)?.ordem || 0;
    const deptB = departamentos.find(d => d.id === b.departamentoAtual)?.ordem || 0;
    return deptA - deptB;
  });
};

/**
 * Agrupa processos por departamento
 */
export const agruparProcessosPorDepartamento = (processos: Processo[]): { [key: number]: Processo[] } => {
  return processos.reduce((acc, processo) => {
    const deptId = processo.departamentoAtual;
    if (!acc[deptId]) {
      acc[deptId] = [];
    }
    acc[deptId].push(processo);
    return acc;
  }, {} as { [key: number]: Processo[] });
};
