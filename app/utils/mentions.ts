// Helper para verificar se há menções do usuário logado nos comentários
export function verificarMencoes(comentarios: any[], usuarioLogado: any): boolean {
  if (!comentarios || !Array.isArray(comentarios) || !usuarioLogado?.nome) {
    return false;
  }

  return comentarios.some((comentario) => {
    if (!comentario.mencoes || !Array.isArray(comentario.mencoes)) {
      return false;
    }

    return comentario.mencoes.some((mencao: string) => {
      const nomeMencao = mencao.replace('@', '').replace(/_/g, ' ').toLowerCase();
      const nomeUsuario = usuarioLogado.nome.toLowerCase();
      return nomeMencao === nomeUsuario;
    });
  });
}

export function isNotificacaoDeMencao(notificacao: any): boolean {
  const msg = String(notificacao?.mensagem || '');
  return /mencionou\s+você/i.test(msg);
}

export function verificarMencoesNaoLidasPorNotificacoes(notificacoes: any[], processoId: number): boolean {
  if (!Array.isArray(notificacoes) || !Number.isFinite(processoId)) return false;
  return notificacoes.some((n: any) => {
    if (!n || n.lida) return false;
    if (Number(n.processoId) !== Number(processoId)) return false;
    return isNotificacaoDeMencao(n);
  });
}

export function obterNotificacoesMencaoNaoLidasPorProcesso(notificacoes: any[], processoId: number): any[] {
  if (!Array.isArray(notificacoes) || !Number.isFinite(processoId)) return [];
  return notificacoes.filter((n: any) => {
    if (!n || n.lida) return false;
    if (Number(n.processoId) !== Number(processoId)) return false;
    return isNotificacaoDeMencao(n);
  });
}
