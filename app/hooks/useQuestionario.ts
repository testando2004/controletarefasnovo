import { useCallback, useContext, useRef, useState } from 'react';
import { Processo, RespostaQuestionario, Questionario } from '../types';
import { api } from '../utils/api';
import { SistemaContext } from '../context/SistemaContext';

interface BackupRespostas {
  [key: string]: any;
}

export const useQuestionario = () => {
  const context = useContext(SistemaContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<BackupRespostas>({});
  
  const backupRef = useRef<BackupRespostas>({});

  if (!context) {
    throw new Error('useQuestionario deve ser usado dentro de SistemaProvider');
  }

  const carregarRespostas = useCallback(async (processoId: number, departamentoId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRespostasQuestionario(processoId, departamentoId);
      const respostasData = data.respostas || {};
      setRespostas(respostasData);
      backupRef.current = { ...respostasData };
      return respostasData;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar respostas');
      console.error('Erro ao carregar respostas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const salvarRespostas = useCallback(
    async (processoId: number, departamentoId: number, novasRespostas?: BackupRespostas) => {
      setLoading(true);
      setError(null);
      try {
        const respostasParaSalvar = novasRespostas || respostas;
        const data = await api.salvarRespostasQuestionario(processoId, departamentoId, respostasParaSalvar);
        
        setRespostas(respostasParaSalvar);
        backupRef.current = { ...respostasParaSalvar };
        
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar respostas');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [respostas]
  );

  const atualizarResposta = useCallback((chave: string, valor: any) => {
    setRespostas(prev => ({
      ...prev,
      [chave]: valor
    }));
  }, []);

  const restaurarResposta = useCallback((chave: string) => {
    if (backupRef.current.hasOwnProperty(chave)) {
      setRespostas(prev => ({
        ...prev,
        [chave]: backupRef.current[chave]
      }));
    } else {
      setRespostas(prev => {
        const novo = { ...prev };
        delete novo[chave];
        return novo;
      });
    }
  }, []);

  const limparRespostas = useCallback(() => {
    setRespostas({});
    backupRef.current = {};
  }, []);

  const verificarCondicao = useCallback((condicao: any, respostasAtual: BackupRespostas): boolean => {
    if (!condicao) return true;

    const { campo, operador, valor } = condicao;
    const respostaDoUsuario = respostasAtual[campo];

    switch (operador) {
      case 'igual':
        return respostaDoUsuario === valor;
      case 'diferente':
        return respostaDoUsuario !== valor;
      case 'contém':
        return typeof respostaDoUsuario === 'string' && respostaDoUsuario.includes(valor);
      case 'maior':
        return Number(respostaDoUsuario) > Number(valor);
      case 'menor':
        return Number(respostaDoUsuario) < Number(valor);
      case 'selecionado':
        return respostaDoUsuario === true;
      case 'não_selecionado':
        return respostaDoUsuario === false;
      default:
        return true;
    }
  }, []);

  const filtrarPerguntas = useCallback(
    (perguntas: Questionario[], respostasAtual: BackupRespostas): Questionario[] => {
      return perguntas.filter(pergunta => {
        if (!pergunta.condicao) return true;
        return verificarCondicao(pergunta.condicao, respostasAtual);
      });
    },
    [verificarCondicao]
  );

  const validarRespostas = useCallback(
    (perguntas: Questionario[], respostasAtual: BackupRespostas): { valido: boolean; erros: { [key: string]: string } } => {
      const erros: { [key: string]: string } = {};
      const perguntasVisiveis = filtrarPerguntas(perguntas, respostasAtual);

      perguntasVisiveis.forEach(pergunta => {
        const resposta = respostasAtual[pergunta.id];
        
        if (pergunta.obrigatorio) {
          if (!resposta || (typeof resposta === 'string' && resposta.trim() === '') || (Array.isArray(resposta) && resposta.length === 0)) {
            erros[pergunta.id] = `${pergunta.label} é obrigatória`;
          }
        }

        // Validar tipo de dado
        if (resposta && pergunta.tipo === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(respostasAtual[pergunta.id])) {
            erros[pergunta.id] = 'Email inválido';
          }
        }

        if (resposta && pergunta.tipo === 'phone') {
          const telefoneeRegex = /^\d{10,15}$/;
          if (!telefoneeRegex.test(respostasAtual[pergunta.id].replace(/\D/g, ''))) {
            erros[pergunta.id] = 'Telefone inválido';
          }
        }
      });

      return {
        valido: Object.keys(erros).length === 0,
        erros
      };
    },
    [filtrarPerguntas]
  );

  return {
    respostas,
    loading,
    error,
    carregarRespostas,
    salvarRespostas,
    atualizarResposta,
    restaurarResposta,
    limparRespostas,
    verificarCondicao,
    filtrarPerguntas,
    validarRespostas
  };
};
