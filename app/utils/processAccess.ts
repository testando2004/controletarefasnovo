import { Prisma, type Status } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import type { AuthUser } from '@/app/utils/routeAuth';

export type ProcessAccessAction =
  | 'read'
  | 'update'
  | 'delete'
  | 'advance'
  | 'manage_questionario'
  | 'answer_questionario'
  | 'comment'
  | 'checklist'
  | 'create_event';

type ProcessoAccessSnapshot = {
  id: number;
  status: Status | string;
  departamentoAtual: number;
  fluxoDepartamentos: number[];
  deptIndependente: boolean;
};

type ProcessAccessSuccess = {
  processo: ProcessoAccessSnapshot;
  roleUpper: string;
  userDeptId: number | null;
  visibleDepartmentIds: number[] | null;
  isAdminLike: boolean;
  error: null;
};

type ProcessAccessFailure = {
  processo: null;
  roleUpper: string;
  userDeptId: number | null;
  visibleDepartmentIds: null;
  isAdminLike: boolean;
  error: NextResponse;
};

type ProcessAccessResult = ProcessAccessSuccess | ProcessAccessFailure;

export function getRoleUpper(user: AuthUser | null | undefined) {
  return String((user as any)?.role || '').toUpperCase();
}

export function getUserDepartmentId(user: AuthUser | null | undefined) {
  const raw = (user as any)?.departamentoId ?? (user as any)?.departamento_id;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Retorna TODOS os departamentos que o usuário pertence (principal + extras).
 * Usado em toda checagem de permissão e visibilidade.
 */
export function getUserDepartmentIds(user: AuthUser | null | undefined): number[] {
  const ids = new Set<number>();
  const principal = getUserDepartmentId(user);
  if (principal !== null) ids.add(principal);
  const extras = (user as any)?.departamentosExtras;
  if (Array.isArray(extras)) {
    for (const raw of extras) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) ids.add(n);
    }
  }
  return Array.from(ids);
}

export function isAdminLike(user: AuthUser | null | undefined) {
  const roleUpper = getRoleUpper(user);
  return roleUpper === 'ADMIN' || roleUpper === 'ADMIN_DEPARTAMENTO';
}

export function canAccessDepartment(user: AuthUser | null | undefined, departamentoId: number) {
  if (isAdminLike(user)) return true;
  const depts = getUserDepartmentIds(user);
  return depts.includes(Number(departamentoId));
}

export function buildProcessReadWhere(user: AuthUser | null | undefined): Prisma.ProcessoWhereInput {
  if (isAdminLike(user)) {
    return {};
  }

  const roleUpper = getRoleUpper(user);
  const userDeptId = getUserDepartmentId(user);
  if ((roleUpper !== 'GERENTE' && roleUpper !== 'USUARIO') || typeof userDeptId !== 'number') {
    return { id: -1 };
  }

  // Gerentes e usuarios enxergam a fila completa; as acoes continuam restritas
  // ao proprio departamento em assertProcessAccess.
  return {};
}

function deny(
  message: string,
  status: number,
  roleUpper: string,
  userDeptId: number | null,
  isAdminLikeRole: boolean
): ProcessAccessFailure {
  return {
    processo: null,
    roleUpper,
    userDeptId,
    visibleDepartmentIds: null,
    isAdminLike: isAdminLikeRole,
    error: NextResponse.json({ error: message }, { status }),
  };
}

function normalizeFlow(processo: Pick<ProcessoAccessSnapshot, 'fluxoDepartamentos'>) {
  return (Array.isArray(processo.fluxoDepartamentos) ? processo.fluxoDepartamentos : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function canReadProcessInScope(processo: ProcessoAccessSnapshot, userDeptIds: number[]) {
  // Se o usuário é responsável por qualquer um dos deptos envolvidos, pode ler.
  if (userDeptIds.includes(Number(processo.departamentoAtual))) return true;

  const flow = normalizeFlow(processo);
  const qualquer = userDeptIds.some((id) => flow.includes(id));
  if (processo.deptIndependente && qualquer) return true;

  return String(processo.status).toUpperCase() === 'FINALIZADO' && qualquer;
}

function canWorkOnDepartment(
  processo: ProcessoAccessSnapshot,
  userDeptIds: number[],
  targetDeptId: number
) {
  if (!userDeptIds.includes(Number(targetDeptId))) return false;
  if (Number(processo.departamentoAtual) === Number(targetDeptId)) return true;

  const flow = normalizeFlow(processo);
  return processo.deptIndependente && flow.includes(Number(targetDeptId));
}

function resolveVisibleDepartmentIdsForRead(
  processo: ProcessoAccessSnapshot,
  userDeptIds: number[]
) {
  const flow = normalizeFlow(processo);

  // Em fluxo paralelo, mantemos isolamento — só os deptos do usuário.
  if (processo.deptIndependente) return [...userDeptIds];
  if (flow.length === 0) return [...userDeptIds];

  // Para cada depto do usuário presente no fluxo, inclui todos os deptos até o dele (ou até o atual)
  const currentIdx = flow.indexOf(Number(processo.departamentoAtual));
  const visibleSet = new Set<number>(userDeptIds);
  for (const ud of userDeptIds) {
    const userIdx = flow.indexOf(ud);
    if (userIdx < 0) continue;
    const cutoff = currentIdx >= 0 ? Math.min(userIdx, currentIdx) : userIdx;
    for (let i = 0; i <= cutoff; i++) visibleSet.add(flow[i]);
  }
  return Array.from(visibleSet);
}

export async function assertProcessAccess(
  user: AuthUser,
  processoId: number,
  action: ProcessAccessAction,
  options: { departamentoId?: number | null } = {}
): Promise<ProcessAccessResult> {
  const roleUpper = getRoleUpper(user);
  const userDeptId = getUserDepartmentId(user);
  const userDeptIds = getUserDepartmentIds(user);
  const isAdminLikeRole = roleUpper === 'ADMIN' || roleUpper === 'ADMIN_DEPARTAMENTO';

  if (!Number.isFinite(Number(processoId)) || Number(processoId) <= 0) {
    return deny('Processo inválido', 400, roleUpper, userDeptId, isAdminLikeRole);
  }

  const processo = await prisma.processo.findUnique({
    where: { id: Number(processoId) },
    select: {
      id: true,
      status: true,
      departamentoAtual: true,
      fluxoDepartamentos: true,
      deptIndependente: true,
    },
  });

  if (!processo) {
    return deny('Processo não encontrado', 404, roleUpper, userDeptId, isAdminLikeRole);
  }

  if (isAdminLikeRole) {
    return {
      processo,
      roleUpper,
      userDeptId,
      visibleDepartmentIds: null,
      isAdminLike: true,
      error: null,
    };
  }

  if (roleUpper !== 'GERENTE' && roleUpper !== 'USUARIO') {
    return deny('Sem permissão', 403, roleUpper, userDeptId, false);
  }

  if (userDeptIds.length === 0) {
    return deny('Usuário sem departamento definido', 403, roleUpper, userDeptId, false);
  }

  const targetDeptId = Number.isFinite(Number(options.departamentoId))
    ? Number(options.departamentoId)
    : null;
  const canRead = canReadProcessInScope(processo, userDeptIds);
  const usuarioNoAtual = userDeptIds.includes(Number(processo.departamentoAtual));
  const targetEstaNosDeptos = targetDeptId !== null && userDeptIds.includes(Number(targetDeptId));

  let allowed = false;

  switch (action) {
    case 'read':
      allowed = true;
      if (targetDeptId !== null) {
        allowed = targetEstaNosDeptos;
      }
      break;
    case 'create_event':
      allowed = canRead;
      if (allowed && targetDeptId !== null) {
        allowed = targetEstaNosDeptos;
      }
      break;
    case 'update':
      allowed = canRead && usuarioNoAtual;
      break;
    case 'delete':
    case 'advance':
      allowed = roleUpper === 'GERENTE' && usuarioNoAtual;
      break;
    case 'manage_questionario':
      allowed =
        roleUpper === 'GERENTE' &&
        targetDeptId !== null &&
        canWorkOnDepartment(processo, userDeptIds, targetDeptId);
      break;
    case 'answer_questionario':
      allowed =
        targetDeptId !== null &&
        canWorkOnDepartment(processo, userDeptIds, targetDeptId);
      break;
    case 'comment':
      allowed = canRead;
      if (allowed && targetDeptId !== null) {
        allowed = targetEstaNosDeptos;
      }
      break;
    case 'checklist':
      allowed =
        roleUpper === 'GERENTE' &&
        targetDeptId !== null &&
        canWorkOnDepartment(processo, userDeptIds, targetDeptId);
      break;
    default:
      allowed = false;
      break;
  }

  if (!allowed) {
    return deny('Sem permissão para acessar este processo', 403, roleUpper, userDeptId, false);
  }

  return {
    processo,
    roleUpper,
    userDeptId,
    visibleDepartmentIds:
      action === 'read'
        ? resolveVisibleDepartmentIdsForRead(processo, userDeptIds)
        : [...userDeptIds],
    isAdminLike: false,
    error: null,
  };
}
