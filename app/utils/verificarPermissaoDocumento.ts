/**
 * Utilitário centralizado para verificação de permissão de documentos.
 * Usado por todas as rotas que lidam com documentos (processos e empresas).
 */

interface DocumentoPermissao {
  visibility?: string | null;
  allowedRoles?: string[] | null;
  allowedUserIds?: number[] | null;
  allowedDepartamentos?: number[] | null;
  uploadPorId?: number | null;
}

interface UsuarioPermissao {
  id: number;
  role: string;
  departamentoId?: number | null;
}

/**
 * Verifica se um usuário tem permissão para visualizar/acessar um documento.
 *
 * Regras (em ordem de prioridade):
 * 1. O autor do upload (uploadPorId) SEMPRE tem acesso
 * 2. ADMIN sempre tem acesso
 * 3. PUBLIC = qualquer usuário autenticado
 * 4. ROLES = somente usuários com role listada em allowedRoles
 * 5. USERS = somente usuários listados em allowedUserIds
 * 6. DEPARTAMENTOS = somente usuários do departamento listado em allowedDepartamentos
 * 7. NONE / outros = somente uploader e admin (já cobertos acima)
 */
export function verificarPermissaoDocumento(
  documento: DocumentoPermissao,
  usuario: UsuarioPermissao
): boolean {
  try {
    const userId = Number(usuario.id);
    const userRole = String(usuario.role || '').toUpperCase();

    // 1. Uploader sempre pode ver
    if (documento.uploadPorId != null && documento.uploadPorId === userId) {
      return true;
    }

    // 2. Admin (incluindo admin com departamento) sempre pode ver
    if (userRole === 'ADMIN' || userRole === 'ADMIN_DEPARTAMENTO') {
      return true;
    }

    const vis = String(documento.visibility || 'PUBLIC').toUpperCase();

    // 3. Público = todos autenticados
    if (vis === 'PUBLIC') {
      return true;
    }

    const allowedRoles: string[] = Array.isArray(documento.allowedRoles)
      ? documento.allowedRoles.map((r) => String(r).toUpperCase())
      : [];
    const allowedUserIds: number[] = Array.isArray(documento.allowedUserIds)
      ? documento.allowedUserIds.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : [];

    // 4. Por roles
    if (vis === 'ROLES') {
      return allowedRoles.length > 0 && allowedRoles.includes(userRole);
    }

    // 5. Por usuários específicos
    if (vis === 'USERS') {
      return allowedUserIds.length > 0 && allowedUserIds.includes(userId);
    }

    // 6. Por departamentos
    if (vis === 'DEPARTAMENTOS') {
      const allowedDepts: number[] = Array.isArray(documento.allowedDepartamentos)
        ? documento.allowedDepartamentos.map((n) => Number(n)).filter((n) => Number.isFinite(n))
        : [];
      const userDeptId = usuario.departamentoId != null ? Number(usuario.departamentoId) : NaN;
      return allowedDepts.length > 0 && Number.isFinite(userDeptId) && allowedDepts.includes(userDeptId);
    }

    // 7. NONE ou qualquer outro valor = somente uploader/admin (já tratados)
    return false;
  } catch {
    return false;
  }
}
