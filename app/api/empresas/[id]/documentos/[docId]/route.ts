import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { deleteFile } from '@/app/utils/supabase';
import { requireAuth } from '@/app/utils/routeAuth';
import { registrarLog, getIp } from '@/app/utils/logAuditoria';
import { verificarPermissaoDocumento } from '@/app/utils/verificarPermissaoDocumento';
import {
  getEmpresaDocumentoQueryConfig,
  hasEmpresaDocumentoAclStorage,
  normalizeEmpresaDocumento,
} from '@/app/utils/empresaDocumentoCompat';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonBigInt(data: unknown, init?: { status?: number }) {
  return new NextResponse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ),
    {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }
  );
}

// DELETE /api/empresas/:id/documentos/:docId
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const empresaId = Number(params.id);
    const docId = Number(params.docId);

    if (!Number.isFinite(empresaId) || !Number.isFinite(docId)) {
      return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 });
    }

    const { select, acl } = await getEmpresaDocumentoQueryConfig();
    const documentoRaw = await prisma.empresaDocumento.findFirst({
      where: { id: docId, empresaId },
      select,
    });
    const documento = documentoRaw ? normalizeEmpresaDocumento(documentoRaw as any, acl) : null;

    if (!documento) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    // Verificar permissão antes de permitir exclusão
    const userId = Number(user.id);
    const userRole = String((user as any).role || '').toUpperCase();
    const podeVer = verificarPermissaoDocumento(
      {
        visibility: (documento as any).visibility,
        allowedRoles: (documento as any).allowedRoles,
        allowedUserIds: (documento as any).allowedUserIds,
        uploadPorId: (documento as any).uploadPorId,
        allowedDepartamentos: (documento as any).allowedDepartamentos || null,
      },
      { id: userId, role: userRole, departamentoId: Number((user as any).departamentoId) || null }
    );

    if (!podeVer) {
      return NextResponse.json({ error: 'Sem permissão para excluir este documento' }, { status: 403 });
    }

    // Excluir do storage
    if ((documento as any).path) {
      try {
        await deleteFile((documento as any).path);
      } catch (e) {
        console.error('Erro ao excluir arquivo do storage:', e);
      }
    }

    // Salvar na lixeira antes de excluir
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 15);

    try {
      const dadosOriginais = JSON.parse(
        JSON.stringify(documento, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )
      );
      await prisma.itemLixeira.create({
        data: {
          tipoItem: 'EMPRESA_DOCUMENTO',
          itemIdOriginal: documento.id,
          dadosOriginais,
          empresaId: empresaId,
          departamentoId: null,
          visibility: String((documento as any).visibility || 'PUBLIC').toUpperCase(),
          allowedRoles: Array.isArray((documento as any).allowedRoles) ? (documento as any).allowedRoles : [],
          allowedUserIds: Array.isArray((documento as any).allowedUserIds) ? (documento as any).allowedUserIds : [],
          deletadoPorId: userId,
          expiraEm: dataExpiracao,
          nomeItem: documento.nome,
          descricaoItem: documento.tipo || null,
        }
      });
    } catch (e) {
      console.error('Erro ao criar ItemLixeira for empresaDocumento:', e);
    }

    // Excluir do banco
    await prisma.empresaDocumento.delete({
      where: { id: docId },
      select: { id: true },
    });

    // Log de auditoria para exclusão de documento
    await registrarLog({
      usuarioId: user.id as number,
      acao: 'EXCLUIR',
      entidade: 'DOCUMENTO',
      entidadeId: documento.id,
      entidadeNome: documento.nome,
      empresaId,
      ip: getIp(request),
    });

    return NextResponse.json({ message: 'Documento movido para lixeira' });
  } catch (e) {
    console.error('Erro ao excluir documento da empresa:', e);
    return NextResponse.json({ error: 'Erro ao excluir documento' }, { status: 500 });
  }
}

// PATCH /api/empresas/:id/documentos/:docId -> atualizar permissões de visibilidade
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const empresaId = Number(params.id);
    const docId = Number(params.docId);

    if (!Number.isFinite(empresaId) || !Number.isFinite(docId)) {
      return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 });
    }

    const { select, acl } = await getEmpresaDocumentoQueryConfig();
    const documentoRaw = await prisma.empresaDocumento.findFirst({
      where: { id: docId, empresaId },
      select,
    });
    const documento = documentoRaw ? normalizeEmpresaDocumento(documentoRaw as any, acl) : null;

    if (!documento) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    // Apenas quem fez upload ou admin pode editar permissões
    const userId = Number(user.id);
    const userRole = String((user as any).role || '').toUpperCase();
    if ((documento as any).uploadPorId !== userId && userRole !== 'ADMIN' && userRole !== 'ADMIN_DEPARTAMENTO') {
      return NextResponse.json({ error: 'Sem permissão para editar permissões deste documento' }, { status: 403 });
    }

    const body = await request.json();
    const { visibility, allowedRoles, allowedUserIds, allowedDepartamentos } = body;
    const nextVisibility = visibility !== undefined ? String(visibility).toUpperCase() : undefined;
    const nextAllowedRoles = Array.isArray(allowedRoles) ? allowedRoles.map((r: any) => String(r)) : undefined;
    const nextAllowedUserIds = Array.isArray(allowedUserIds) ? allowedUserIds.map((n: any) => Number(n)) : undefined;
    const nextAllowedDepartamentos = Array.isArray(allowedDepartamentos)
      ? allowedDepartamentos.map((n: any) => Number(n))
      : undefined;
    const aclRequested =
      (nextVisibility && nextVisibility !== 'PUBLIC') ||
      (nextAllowedRoles?.length ?? 0) > 0 ||
      (nextAllowedUserIds?.length ?? 0) > 0 ||
      (nextAllowedDepartamentos?.length ?? 0) > 0;

    if (aclRequested && !hasEmpresaDocumentoAclStorage(acl)) {
      return NextResponse.json(
        { error: 'O banco atual ainda nao suporta permissoes por documento da empresa. Execute as migrations pendentes.' },
        { status: 409 }
      );
    }

    const updateData: any = {};
    if (acl.visibility && nextVisibility !== undefined) updateData.visibility = nextVisibility;
    if (acl.allowedRoles && nextAllowedRoles) updateData.allowedRoles = nextAllowedRoles;
    if (acl.allowedUserIds && nextAllowedUserIds) updateData.allowedUserIds = nextAllowedUserIds;
    if (acl.allowedDepartamentos && nextAllowedDepartamentos) updateData.allowedDepartamentos = nextAllowedDepartamentos;

    if (Object.keys(updateData).length === 0) {
      return jsonBigInt(documento);
    }

    const atualizadoRaw = await prisma.empresaDocumento.update({
      where: { id: docId },
      data: updateData,
      select,
    });
    const atualizado = normalizeEmpresaDocumento(atualizadoRaw as any, acl);

    // Log de auditoria
    await registrarLog({
      usuarioId: userId,
      acao: 'EDITAR',
      entidade: 'DOCUMENTO',
      entidadeId: docId,
      entidadeNome: documento.nome,
      empresaId,
      campo: 'visibility',
      valorAnterior: String(documento.visibility || 'PUBLIC'),
      valorNovo: String(updateData.visibility || documento.visibility || 'PUBLIC'),
      ip: getIp(request),
    });

    return jsonBigInt(atualizado);
  } catch (e) {
    console.error('Erro no PATCH /api/empresas/:id/documentos/:docId', e);
    return NextResponse.json({ error: 'Erro ao atualizar documento' }, { status: 500 });
  }
}
