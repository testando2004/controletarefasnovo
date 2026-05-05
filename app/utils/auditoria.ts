/**
 * Sistema de Auditoria - Registra automaticamente todas as ações do sistema
 */

export type TipoEvento = 
  | 'INICIO'
  | 'ALTERACAO'
  | 'MOVIMENTACAO'
  | 'CONCLUSAO'
  | 'FINALIZACAO'
  | 'DOCUMENTO'
  | 'COMENTARIO';

export interface DadosEvento {
  processoId: number;
  tipo: TipoEvento;
  acao: string;
  responsavelId?: number;
  departamento?: string;
  detalhes?: any;
}

/**
 * Registra um evento no histórico do processo
 */
export async function registrarEvento(dados: DadosEvento) {
  try {
    const response = await fetch('/api/auditoria', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        processoId: dados.processoId,
        tipo: dados.tipo,
        acao: dados.acao,
        responsavelId: dados.responsavelId,
        departamento: dados.departamento,
        detalhes: dados.detalhes,
        dataTimestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      console.error('Erro ao registrar evento:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao registrar evento:', error);
    return null;
  }
}

/**
 * Busca o histórico completo de um processo
 */
export async function buscarHistorico(processoId: number) {
  try {
    const response = await fetch(`/api/auditoria?processoId=${processoId}`);
    
    if (!response.ok) {
      console.error('Erro ao buscar histórico:', await response.text());
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return [];
  }
}

/**
 * Templates de mensagens para eventos comuns
 */
export const EVENTOS = {
  // Início e criação
  PROCESSO_CRIADO: (nomeEmpresa: string, departamento: string) => ({
    tipo: 'INICIO' as TipoEvento,
    acao: `Processo criado para ${nomeEmpresa} no departamento ${departamento}`,
  }),

  // Movimentação entre departamentos
  PROCESSO_AVANCADO: (departamentoOrigem: string, departamentoDestino: string) => ({
    tipo: 'MOVIMENTACAO' as TipoEvento,
    acao: `Processo movido de ${departamentoOrigem} para ${departamentoDestino}`,
  }),

  PROCESSO_RETORNADO: (departamentoOrigem: string, departamentoDestino: string) => ({
    tipo: 'MOVIMENTACAO' as TipoEvento,
    acao: `Processo retornou de ${departamentoOrigem} para ${departamentoDestino}`,
  }),

  // Alterações
  PROCESSO_EDITADO: (campo?: string) => ({
    tipo: 'ALTERACAO' as TipoEvento,
    acao: campo ? `Processo editado - campo: ${campo}` : 'Processo editado',
  }),

  PRIORIDADE_ALTERADA: (prioridadeNova: string, prioridadeAntiga?: string) => ({
    tipo: 'ALTERACAO' as TipoEvento,
    acao: prioridadeAntiga 
      ? `Prioridade alterada de ${prioridadeAntiga} para ${prioridadeNova}`
      : `Prioridade definida como ${prioridadeNova}`,
  }),

  STATUS_ALTERADO: (statusNovo: string, statusAntigo?: string) => ({
    tipo: 'ALTERACAO' as TipoEvento,
    acao: statusAntigo
      ? `Status alterado de ${statusAntigo} para ${statusNovo}`
      : `Status definido como ${statusNovo}`,
  }),

  RESPONSAVEL_ATRIBUIDO: (nomeResponsavel: string) => ({
    tipo: 'ALTERACAO' as TipoEvento,
    acao: `Responsável atribuído: ${nomeResponsavel}`,
  }),

  // Documentos
  DOCUMENTO_ADICIONADO: (nomeDocumento: string, tipo?: string) => ({
    tipo: 'DOCUMENTO' as TipoEvento,
    acao: tipo 
      ? `Documento adicionado: ${nomeDocumento} (${tipo})`
      : `Documento adicionado: ${nomeDocumento}`,
  }),

  DOCUMENTO_REMOVIDO: (nomeDocumento: string) => ({
    tipo: 'DOCUMENTO' as TipoEvento,
    acao: `Documento removido: ${nomeDocumento}`,
  }),

  // Comentários
  COMENTARIO_ADICIONADO: (preview?: string) => ({
    tipo: 'COMENTARIO' as TipoEvento,
    acao: preview 
      ? `Comentário adicionado: "${preview.substring(0, 50)}${preview.length > 50 ? '...' : ''}"`
      : 'Comentário adicionado',
  }),

  COMENTARIO_EDITADO: () => ({
    tipo: 'COMENTARIO' as TipoEvento,
    acao: 'Comentário editado',
  }),

  COMENTARIO_REMOVIDO: () => ({
    tipo: 'COMENTARIO' as TipoEvento,
    acao: 'Comentário removido',
  }),

  // Tags
  TAG_ADICIONADA: (nomeTag: string) => ({
    tipo: 'ALTERACAO' as TipoEvento,
    acao: `Tag adicionada: ${nomeTag}`,
  }),

  TAG_REMOVIDA: (nomeTag: string) => ({
    tipo: 'ALTERACAO' as TipoEvento,
    acao: `Tag removida: ${nomeTag}`,
  }),

  // Questionário
  QUESTIONARIO_RESPONDIDO: (departamento: string) => ({
    tipo: 'ALTERACAO' as TipoEvento,
    acao: `Questionário respondido para o departamento ${departamento}`,
  }),

  QUESTIONARIO_ATUALIZADO: (departamento: string) => ({
    tipo: 'ALTERACAO' as TipoEvento,
    acao: `Respostas do questionário atualizadas - ${departamento}`,
  }),

  // Finalização
  PROCESSO_CONCLUIDO: (departamento: string) => ({
    tipo: 'CONCLUSAO' as TipoEvento,
    acao: `Processo concluído no departamento ${departamento}`,
  }),

  PROCESSO_FINALIZADO: () => ({
    tipo: 'FINALIZACAO' as TipoEvento,
    acao: '🎉 Processo finalizado com sucesso!',
  }),

  PROCESSO_CANCELADO: (motivo?: string) => ({
    tipo: 'ALTERACAO' as TipoEvento,
    acao: motivo ? `Processo cancelado - Motivo: ${motivo}` : 'Processo cancelado',
  }),

  PROCESSO_PAUSADO: (motivo?: string) => ({
    tipo: 'ALTERACAO' as TipoEvento,
    acao: motivo ? `Processo pausado - Motivo: ${motivo}` : 'Processo pausado',
  }),

  PROCESSO_RETOMADO: () => ({
    tipo: 'ALTERACAO' as TipoEvento,
    acao: 'Processo retomado',
  }),
};

/**
 * Função helper para registrar eventos comuns rapidamente
 */
export async function registrarEventoRapido(
  processoId: number,
  eventoTemplate: ReturnType<typeof EVENTOS[keyof typeof EVENTOS]>,
  responsavelId?: number,
  departamento?: string,
  detalhes?: any
) {
  return registrarEvento({
    processoId,
    tipo: eventoTemplate.tipo,
    acao: eventoTemplate.acao,
    responsavelId,
    departamento,
    detalhes,
  });
}
