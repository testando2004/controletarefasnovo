import { useCallback, useContext, useEffect, useState } from 'react';
import { Processo, Departamento } from '../types';
import { api } from '../utils/api';
import { SistemaContext } from '../context/SistemaContext';

export const useProcessos = () => {
  const context = useContext(SistemaContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!context) {
    throw new Error('useProcessos deve ser usado dentro de SistemaProvider');
  }

  const { processos, setProcessos, departamentos } = context;

  const carregarProcessos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProcessos();
      setProcessos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar processos');
      console.error('Erro ao carregar processos:', err);
    } finally {
      setLoading(false);
    }
  }, [setProcessos]);

  const criarProcesso = useCallback(async (dados: Partial<Processo>) => {
    setLoading(true);
    setError(null);
    try {
      const novoProcesso = await api.salvarProcesso({
        ...dados,
        dataCriacao: new Date().toISOString(),
        departamentoAtual: dados.departamentoAtual || 1,
        departamentoAtualIndex: 0,
        status: 'em_andamento',
        historicoEvento: [{
          departamento: dados.departamentoAtual || 1,
          dataEntrada: new Date().toISOString(),
          usuario: 'Sistema'
        }]
      });
      
      setProcessos(prev => [...prev, novoProcesso]);
      return novoProcesso;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar processo');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setProcessos]);

  const atualizarProcesso = useCallback(async (id: number, dados: Partial<Processo>) => {
    setLoading(true);
    setError(null);
    try {
      const processoAtualizado = await api.atualizarProcesso(id, dados);
      setProcessos(prev => prev.map(p => p.id === id ? processoAtualizado : p));
      return processoAtualizado;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar processo');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setProcessos]);

  const excluirProcesso = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await api.excluirProcesso(id);
      // Não atualiza localmente, deixa o realtime do Supabase atualizar a lista
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir processo');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const avancarParaProximoDepartamento = useCallback(async (processoId: number) => {
    try {
      const processo = processos.find(p => p.id === processoId);
      if (!processo) return;

      const indexAtual = processo.departamentoAtualIndex || 0;
      
      if (processo.fluxoDepartamentos && processo.fluxoDepartamentos.length > 0) {
        if (indexAtual + 1 < processo.fluxoDepartamentos.length) {
          const proximoDeptId = processo.fluxoDepartamentos[indexAtual + 1];
          const proximoDeptNome = departamentos.find(d => d.id === proximoDeptId)?.nome || `Departamento ${proximoDeptId}`;
          
          const historico = [...(processo.historicoEvento || [])];
          historico.push({
            departamento: proximoDeptNome,
            data: new Date().toISOString(),
            acao: 'Processo movido',
            responsavel: 'Sistema',
            tipo: 'movimentacao'
          });

          return atualizarProcesso(processoId, {
            departamentoAtual: proximoDeptId,
            departamentoAtualIndex: indexAtual + 1,
            historicoEvento: historico,
            status: processo.status
          });
        }
      } else {
        const proximoDeptId = Math.min(...processos
          .filter(p => p.id !== processoId)
          .map(p => p.departamentoAtual)
          .concat([processo.departamentoAtual + 1]));
        
        const proximoDeptNome = departamentos.find(d => d.id === proximoDeptId)?.nome || `Departamento ${proximoDeptId}`;

        const historico = [...(processo.historicoEvento || [])];
        historico.push({
          departamento: proximoDeptNome,
          data: new Date().toISOString(),
          acao: 'Processo movido',
          responsavel: 'Sistema',
          tipo: 'movimentacao'
        });

        return atualizarProcesso(processoId, {
          departamentoAtual: proximoDeptId,
          historicoEvento: historico
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao avançar processo');
      throw err;
    }
  }, [atualizarProcesso, departamentos, processos]);

  const finalizarProcesso = useCallback(async (processoId: number) => {
    setLoading(true);
    setError(null);
    try {
      const processo = processos.find(p => p.id === processoId);
      if (!processo) return;
      
      const deptNome = departamentos.find(d => d.id === processo.departamentoAtual)?.nome || `Departamento ${processo.departamentoAtual}`;

      const historico = [...(processo.historicoEvento || [])];
      historico.push({
        departamento: deptNome,
        data: new Date().toISOString(),
        acao: 'Processo finalizado',
        responsavel: 'Sistema',
        tipo: 'finalizacao'
      });

      return atualizarProcesso(processoId, {
        status: 'finalizado',
        dataFinalizacao: new Date().toISOString(),
        historicoEvento: historico
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao finalizar processo');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [atualizarProcesso, departamentos, processos]);

  return {
    processos,
    loading,
    error,
    carregarProcessos,
    criarProcesso,
    atualizarProcesso,
    excluirProcesso,
    avancarParaProximoDepartamento,
    finalizarProcesso
  };
};
