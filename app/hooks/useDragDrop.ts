import { useCallback, useContext, useState } from 'react';
import { Processo, Departamento } from '../types';
import { SistemaContext } from '../context/SistemaContext';
import { temPermissao as verificarPermissao } from '../utils/permissions';

interface DragDropState {
  draggedItem: Processo | null;
  dragSource: number | null;
  isValidDropTarget: boolean;
}

export const useDragDrop = () => {
  const context = useContext(SistemaContext);
  const [dragState, setDragState] = useState<DragDropState>({
    draggedItem: null,
    dragSource: null,
    isValidDropTarget: false
  });

  if (!context) {
    throw new Error('useDragDrop deve ser usado dentro de SistemaProvider');
  }

  const { processos, departamentos, setShowAlerta, usuarioLogado } = context;

  const temPermissao = useCallback((acao: string, contexto: any = {}) => {
    return verificarPermissao(usuarioLogado, acao, contexto);
  }, [usuarioLogado]);

  const handleDragStart = useCallback((e: React.DragEvent, processo: Processo, departamentoAtual: number) => {
    if (!temPermissao('mover_processo', { departamentoOrigemId: departamentoAtual, departamentoAtual })) {
      e.preventDefault();
      setShowAlerta({
        titulo: 'Sem Permissão',
        mensagem: 'Você não tem permissão para mover processos deste departamento. Apenas gerentes podem mover processos do próprio departamento.',
        tipo: 'aviso',
        onClose: () => setShowAlerta(null)
      });
      return;
    }

    setDragState({
      draggedItem: processo,
      dragSource: departamentoAtual,
      isValidDropTarget: false
    });

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      // Alguns browsers exigem setData para iniciar o drag.
      e.dataTransfer.setData('text/plain', String(processo.id));
    }
  }, [temPermissao, setShowAlerta]);

  const validarDropTarget = useCallback((processo: Processo | null, departamentoId: number) => {
    if (!processo) return false;

    if (processo.departamentoAtual === departamentoId) return false;

    // Se o processo tem fluxo obrigatório
    if (processo.fluxoDepartamentos && processo.fluxoDepartamentos.length > 0) {
      const indexAtual = processo.departamentoAtualIndex || 0;
      
      // Verificar se o departamento é o próximo esperado no fluxo
      if (indexAtual + 1 < processo.fluxoDepartamentos.length) {
        const proximoEsperado = processo.fluxoDepartamentos[indexAtual + 1];
        return departamentoId === proximoEsperado;
      }
      // Se já passou por todos os departamentos do fluxo, pode finalizar
      return false;
    }

    // Se não tem fluxo obrigatório, permite mover para qualquer departamento
    return true;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, processo: Processo | null, departamentoId: number) => {
    e.preventDefault();
    
    const isValid = validarDropTarget(processo, departamentoId);
    
    setDragState(prev => ({
      ...prev,
      isValidDropTarget: isValid
    }));

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = isValid ? 'move' : 'none';
    }
  }, [validarDropTarget]);

  const handleDrop = useCallback((
    e: React.DragEvent,
    departamentoId: number,
    onAvancar: (processoId: number) => void | Promise<void>
  ) => {
    e.preventDefault();
    
    const { draggedItem, dragSource } = dragState;

    if (!draggedItem) return;

    if (draggedItem.fluxoDepartamentos && draggedItem.fluxoDepartamentos.length > 0) {
      const indexAtual = draggedItem.departamentoAtualIndex || 0;
      
      // Obter o próximo departamento esperado no fluxo
      if (indexAtual + 1 < draggedItem.fluxoDepartamentos.length) {
        const proximoEsperado = draggedItem.fluxoDepartamentos[indexAtual + 1];
        
        // Se o usuário está tentando mover para um departamento diferente do esperado
        if (departamentoId !== proximoEsperado) {
          const deptEsperado = departamentos.find(d => d.id === proximoEsperado);
          setShowAlerta({
            titulo: 'Fluxo Inválido',
            mensagem: `Este processo deve ir para "${deptEsperado?.nome || 'departamento desconhecido'}" em seguida.`,
            tipo: 'aviso',
            onClose: () => setShowAlerta(null)
          });
          setDragState({ draggedItem: null, dragSource: null, isValidDropTarget: false });
          return;
        }
      }
    }

    // Se chegou aqui, a movimentação é válida
    if (departamentoId !== draggedItem.departamentoAtual) {
      Promise.resolve(onAvancar(draggedItem.id)).catch(err => {
        setShowAlerta({
          titulo: 'Erro',
          mensagem: 'Erro ao mover o processo. Tente novamente.',
          tipo: 'erro',
          onClose: () => setShowAlerta(null)
        });
      });
    }

    setDragState({ draggedItem: null, dragSource: null, isValidDropTarget: false });
  }, [dragState, departamentos, setShowAlerta]);

  const handleDragEnd = useCallback(() => {
    setDragState({ draggedItem: null, dragSource: null, isValidDropTarget: false });
  }, []);

  return {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    validarDropTarget,
    temPermissao
  };
};
