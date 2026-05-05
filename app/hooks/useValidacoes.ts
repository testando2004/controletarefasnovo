'use client';

import { useState, useCallback } from 'react';
import { validarAvancoDepartamento, calcularProgresso, ErroValidacao } from '@/app/utils/validation';

export function useValidacoes() {
  const [errosValidacao, setErrosValidacao] = useState<ErroValidacao[]>([]);
  const [validando, setValidando] = useState(false);

  /**
   * Valida se um processo pode avançar para o próximo departamento
   */
  const validarAvanco = useCallback(async (params: {
    processo: any;
    departamento: any;
    questionarios: any[];
    documentos: any[];
    respostas: Record<number, any>;
  }): Promise<{ valido: boolean; erros: ErroValidacao[] }> => {
    setValidando(true);
    setErrosValidacao([]);

    try {
      const resultado = validarAvancoDepartamento(params);
      setErrosValidacao(resultado.erros);
      return resultado;
    } catch (error) {
      console.error('Erro ao validar avanço:', error);
      const erroGenerico: ErroValidacao = {
        campo: 'geral',
        mensagem: 'Erro ao validar requisitos. Tente novamente.',
        tipo: 'erro',
      };
      setErrosValidacao([erroGenerico]);
      return { valido: false, erros: [erroGenerico] };
    } finally {
      setValidando(false);
    }
  }, []);

  /**
   * Calcula o progresso de completude do processo no departamento atual
   */
  const obterProgresso = useCallback((params: {
    questionarios: any[];
    documentosObrigatorios: any[];
    respostas: Record<number, any>;
    documentos: any[];
  }) => {
    return calcularProgresso(params);
  }, []);

  /**
   * Limpa os erros de validação
   */
  const limparErros = useCallback(() => {
    setErrosValidacao([]);
  }, []);

  /**
   * Verifica se há erros críticos (tipo 'erro')
   */
  const temErrosCriticos = useCallback(() => {
    return errosValidacao.some(e => e.tipo === 'erro');
  }, [errosValidacao]);

  /**
   * Verifica se há avisos (tipo 'aviso')
   */
  const temAvisos = useCallback(() => {
    return errosValidacao.some(e => e.tipo === 'aviso');
  }, [errosValidacao]);

  return {
    errosValidacao,
    validando,
    validarAvanco,
    obterProgresso,
    limparErros,
    temErrosCriticos,
    temAvisos,
  };
}
