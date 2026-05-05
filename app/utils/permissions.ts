import { Usuario } from '@/app/types';
import { GHOST_USER_EMAIL, MASTER_USER_EMAIL } from './constants';

/**
 * Verifica se um usuário é o ghost user ou o master user (yasmin)
 */
export function isSuperUsuario(usuario: Usuario | null): boolean {
  if (!usuario) return false;
  if ((usuario as any).isGhost) return true;
  if (usuario.email === GHOST_USER_EMAIL) return true;
  if (usuario.email === MASTER_USER_EMAIL) return true;
  return false;
}

/**
 * Verifica se um usuário é ghost (sem logs)
 */
export function isGhostUsuario(usuario: Usuario | null): boolean {
  if (!usuario) return false;
  if ((usuario as any).isGhost) return true;
  if (usuario.email === GHOST_USER_EMAIL) return true;
  return false;
}

/**
 * Verifica se o admin pode editar/excluir outro admin
 * Apenas ghost e master podem editar outros admins
 */
export function podeEditarUsuario(editor: Usuario | null, alvo: Usuario | null): boolean {
  if (!editor || !alvo) return false;

  // Super users podem editar qualquer um
  if (isSuperUsuario(editor)) return true;

  // Se o alvo é admin, apenas super users podem editar
  if (alvo.role === 'admin' || alvo.role === 'admin_departamento') {
    return false; // Já tratado acima - admins normais NÃO podem editar outros admins
  }

  // Admins podem editar gerentes e usuários
  if (editor.role === 'admin' || editor.role === 'admin_departamento') return true;

  return false;
}

/**
 * Verifica se o admin pode alterar a senha de outro usuário
 * Admins NÃO podem alterar senha de outros admins (exceto ghost e master)
 */
export function podeAlterarSenha(editor: Usuario | null, alvo: Usuario | null): boolean {
  if (!editor || !alvo) return false;

  // Super users podem tudo
  if (isSuperUsuario(editor)) return true;

  // Editando a si mesmo - sempre pode
  if (editor.id === alvo.id) return true;

  // Se o alvo é admin, somente super users
  if (alvo.role === 'admin' || alvo.role === 'admin_departamento') {
    return false;
  }

  // Admins podem mudar senha de gerentes e usuários
  if (editor.role === 'admin' || editor.role === 'admin_departamento') return true;

  return false;
}

/**
 * Verifica se um usuário tem permissão para executar uma ação
 */
export function temPermissao(
  usuario: Usuario | null,
  permissao: string,
  contexto: any = {}
): boolean {
  if (!usuario) {
    return false;
  }

  const departamentoUsuario =
    typeof (usuario as any).departamento_id === 'number'
      ? (usuario as any).departamento_id
      : typeof (usuario as any).departamentoId === 'number'
        ? (usuario as any).departamentoId
        : undefined;

  // Conjunto completo de departamentos do usuário (principal + extras)
  const deptosDoUsuario: number[] = (() => {
    const set = new Set<number>();
    if (typeof departamentoUsuario === 'number') set.add(departamentoUsuario);
    const extras = (usuario as any).departamentosExtras;
    if (Array.isArray(extras)) {
      for (const raw of extras) {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) set.add(n);
      }
    }
    return Array.from(set);
  })();
  const usuarioAtuaNoDept = (deptId: unknown) =>
    typeof deptId === 'number' && deptosDoUsuario.includes(deptId);

  // Ghost user e super users têm acesso total absoluto
  if (isSuperUsuario(usuario)) {
    return true;
  }

  // Admin e Admin_departamento têm acesso total
  if (usuario.role === 'admin' || usuario.role === 'admin_departamento') {
    return true;
  }

  // Gerente: tem acesso a quase tudo, exceto:
  // - Gerenciar usuários
  if (usuario.role === 'gerente') {
    // Gerente NÃO pode gerenciar usuários
    if (['gerenciar_usuarios', 'criar_usuario', 'editar_usuario', 'excluir_usuario'].includes(permissao)) {
      return false;
    }

    // Gerente NÃO pode gerenciar departamentos
    if (['criar_departamento', 'editar_departamento', 'excluir_departamento'].includes(permissao)) {
      return false;
    }

    // Gerente NÃO pode editar processo
    if (permissao === 'editar_processo') {
      return false;
    }

    // Gerente pode excluir processo apenas em um dos seus departamentos
    if (permissao === 'excluir_processo') {
      const departamentoAtual = contexto?.departamentoAtual;
      if (typeof departamentoAtual === 'number' && deptosDoUsuario.length > 0) {
        return usuarioAtuaNoDept(departamentoAtual);
      }
      return false;
    }

    // Tags: pode gerenciar (CRUD) e aplicar
    if (['gerenciar_tags', 'criar_tag', 'editar_tag', 'excluir_tag', 'aplicar_tags'].includes(permissao)) return true;

    // Análises: pode ver
    if (permissao === 'ver_analises') {
      return true;
    }

    // Criar solicitação (inclusive personalizada)
    if (permissao === 'criar_processo' || permissao === 'criar_processo_personalizado') return true;

    // Mover/avançar processo: gerente só atua em um dos seus departamentos
    if (permissao === 'mover_processo') {
      const departamentoAtual = contexto?.departamentoAtual;
      if (typeof departamentoAtual === 'number' && deptosDoUsuario.length > 0) {
        return usuarioAtuaNoDept(departamentoAtual);
      }
      // Se não conseguimos determinar o contexto, melhor negar do que liberar.
      return false;
    }

    // Finalizar: somente em um dos deptos do usuário e (se informado) apenas no último
    if (permissao === 'finalizar_processo') {
      const departamentoAtual = contexto?.departamentoAtual;
      const isUltimoDepartamento = contexto?.isUltimoDepartamento;
      if (typeof departamentoAtual === 'number' && deptosDoUsuario.length > 0) {
        if (!usuarioAtuaNoDept(departamentoAtual)) return false;
      }
      if (isUltimoDepartamento !== undefined) return Boolean(isUltimoDepartamento);
      return false;
    }

    // Empresa: gerente edita, mas não cadastra/cria
    if (permissao === 'editar_empresa') return true;
    if (permissao === 'cadastrar_empresa' || permissao === 'criar_empresa') return false;

    // Comentários e visualização
    if (permissao === 'comentar' || permissao === 'ver_questionario') return true;

    // Por padrão, permite outras ações
    return true;
  }

  // Usuário normal: acesso limitado
  if (usuario.role === 'usuario') {
    // Pode ver análises
    if (permissao === 'ver_analises') {
      return true;
    }

    // Pode criar solicitação (via template), desde que o fluxo comece no dept dele (validado no backend/UI)
    if (permissao === 'criar_processo') return true;

    // Usuário normal NÃO cria solicitação personalizada
    if (permissao === 'criar_processo_personalizado') return false;

    // Pode comentar e gerenciar/aplicar tags
    if (
      permissao === 'comentar' ||
      ['gerenciar_tags', 'criar_tag', 'editar_tag', 'excluir_tag', 'aplicar_tags'].includes(permissao)
    ) {
      return true;
    }

    // Pode ver questionários
    if (permissao === 'ver_questionario') return true;

    // Pode preencher questionários em um dos deptos dele
    if (permissao === 'responder_questionario') {
      const departamentoAtual = contexto.departamentoAtual;
      return typeof departamentoAtual === 'number' && deptosDoUsuario.length > 0
        ? usuarioAtuaNoDept(departamentoAtual)
        : false;
    }

    // NÃO pode mover/finalizar processos
    if (permissao === 'mover_processo' || permissao === 'finalizar_processo') return false;

    // NÃO pode gerenciar usuários, empresas, departamentos
    if (
      [
        'gerenciar_usuarios',
        'criar_usuario',
        'editar_usuario',
        'excluir_usuario',
        'criar_empresa',
        'cadastrar_empresa',
        'editar_empresa',
        'criar_departamento',
        'editar_departamento',
        'excluir_departamento',
      ].includes(permissao)
    ) {
      return false;
    }

    // Não pode editar/excluir processos
    if (permissao === 'editar_processo' || permissao === 'excluir_processo') return false;

    // Por padrão, nega
    return false;
  }

  return false;
}
