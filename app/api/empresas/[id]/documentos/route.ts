import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { uploadFile, deleteFile } from '@/app/utils/supabase';
import { requireAuth } from '@/app/utils/routeAuth';
import { registrarLog, getIp } from '@/app/utils/logAuditoria';
import { verificarPermissaoDocumento } from '@/app/utils/verificarPermissaoDocumento';
import {
  createEmpresaDocumentoCompat,
  getEmpresaDocumentoQueryConfig,
  hasEmpresaDocumentoAclStorage,
  normalizeEmpresaDocumento,
} from '@/app/utils/empresaDocumentoCompat';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENTOS_POR_EMPRESA = 50;

function jsonBigInt(data: unknown, init?: { status?: number }) {
  return new NextResponse(
    JSON.stringify(data, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)),
    {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }
  );
}

function calcularStatusValidade(validadeAte: Date | null, alertarDiasAntes: number | null) {
  if (!validadeAte) return { status: 'sem_validade', dias: null };
  
  const hoje = new Date();
  const startOfDay = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const alvo = new Date(validadeAte.getFullYear(), validadeAte.getMonth(), validadeAte.getDate());
  const diffMs = alvo.getTime() - startOfDay.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return { status: 'vencido', dias: diffDias };

  const janela = Number.isFinite(Number(alertarDiasAntes)) ? Number(alertarDiasAntes) : 30;
  if (diffDias <= janela) return { status: 'vence_em_breve', dias: diffDias };
  
  return { status: 'ok', dias: diffDias };
}

// GET /api/empresas/:id/documentos
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const empresaId = Number(params.id);
    if (!Number.isFinite(empresaId)) {
      return NextResponse.json({ error: 'ID invÃ¡lido' }, { status: 400 });
    }

    const { select, acl } = await getEmpresaDocumentoQueryConfig();
    const documentosRaw = await prisma.empresaDocumento.findMany({
      where: { empresaId },
      orderBy: { dataUpload: 'desc' },
      select,
    });
    const documentos = documentosRaw.map((doc) => normalizeEmpresaDocumento(doc as any, acl));

    const userId = Number((user as any).id);
    const userRole = String((user as any).role || '').toUpperCase();

    const docsComStatus = documentos
      .filter((doc: any) =>
        verificarPermissaoDocumento(
          {
            visibility: doc.visibility,
            allowedRoles: doc.allowedRoles,
            allowedUserIds: doc.allowedUserIds,
            uploadPorId: doc.uploadPorId,
            allowedDepartamentos: doc.allowedDepartamentos || null,
          },
          { id: userId, role: userRole, departamentoId: Number((user as any).departamentoId) || null }
        )
      )
      .map((doc: any) => {
        const { status, dias } = calcularStatusValidade(doc.validadeAte, doc.alertarDiasAntes);
        return { ...doc, validadeStatus: status, validadeDias: dias };
      });

    return jsonBigInt(docsComStatus);
  } catch (e) {
    console.error('Erro ao buscar documentos da empresa:', e);
    return NextResponse.json({ error: 'Erro ao buscar documentos' }, { status: 500 });
  }
}

// POST /api/empresas/:id/documentos
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const empresaId = Number(params.id);
    if (!Number.isFinite(empresaId)) {
      return NextResponse.json({ error: 'ID invÃ¡lido' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('arquivo') as File;
    const tipo = String(formData.get('tipo') || '').trim();
    const descricao = (formData.get('descricao') as string) || undefined;
    const validadeAteRaw = (formData.get('validadeAte') as string) || '';
    const alertarDiasAntesRaw = (formData.get('alertarDiasAntes') as string) || '';

    if (!file || !tipo) {
      return NextResponse.json({ error: 'Arquivo e tipo sÃ£o obrigatÃ³rios' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Arquivo excede o limite de ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB` },
        { status: 400 }
      );
    }

    const documentosExistentes = await prisma.empresaDocumento.count({
      where: { empresaId },
    });
    if (documentosExistentes >= MAX_DOCUMENTOS_POR_EMPRESA) {
      return NextResponse.json(
        { error: `Limite de ${MAX_DOCUMENTOS_POR_EMPRESA} documentos por empresa atingido` },
        { status: 400 }
      );
    }

    // Parse validade (opcional)
    let validadeAte: Date | undefined;
    if (validadeAteRaw) {
      const parsed = new Date(validadeAteRaw);
      if (!Number.isNaN(parsed.getTime())) validadeAte = parsed;
    }

    // Parse alerta (opcional)
    let alertarDiasAntes: number | undefined;
    if (alertarDiasAntesRaw) {
      const n = Number(alertarDiasAntesRaw);
      if (Number.isFinite(n) && n >= 0) alertarDiasAntes = n;
    }

    // Parse visibilidade (opcional)
    const visibilityRaw = (formData.get('visibility') as string) || '';
    const allowedRolesRaw = (formData.get('allowedRoles') as string) || '';
    const allowedUserIdsRaw = (formData.get('allowedUserIds') as string) || '';
    const allowedDepartamentosRaw = (formData.get('allowedDepartamentos') as string) || '';
    const allowedRolesArr = allowedRolesRaw ? allowedRolesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const allowedUserIdsArr = allowedUserIdsRaw ? allowedUserIdsRaw.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n)) : [];
    const allowedDepartamentosArr = allowedDepartamentosRaw ? allowedDepartamentosRaw.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n)) : [];
    const visUpper = visibilityRaw ? String(visibilityRaw).toUpperCase() : undefined;
    const visNormalized = visUpper && ['PUBLIC', 'ROLES', 'USERS', 'DEPARTAMENTOS', 'NONE'].includes(visUpper)
      ? (visUpper as 'PUBLIC' | 'ROLES' | 'USERS' | 'DEPARTAMENTOS' | 'NONE')
      : undefined;
    const { select, acl } = await getEmpresaDocumentoQueryConfig();
    const aclRequested =
      (visNormalized && visNormalized !== 'PUBLIC') ||
      allowedRolesArr.length > 0 ||
      allowedUserIdsArr.length > 0 ||
      allowedDepartamentosArr.length > 0;

    if (aclRequested && !hasEmpresaDocumentoAclStorage(acl)) {
      return NextResponse.json(
        { error: 'O banco atual ainda nao suporta permissoes por documento da empresa. Execute as migrations pendentes.' },
        { status: 409 }
      );
    }

    // Garantir que uploader esteja incluido quando visibility=USERS
    if (visNormalized === 'USERS' && !allowedUserIdsArr.includes(user.id)) {
      allowedUserIdsArr.push(user.id);
    }

    // Upload para Supabase
    const { url, path } = await uploadFile(file, `empresas/${empresaId}`);

    const documento = await createEmpresaDocumentoCompat(
      prisma,
      {
        empresaId,
        nome: file.name,
        tipo,
        descricao: descricao || null,
        tamanho: BigInt(file.size),
        url: '', // Nunca armazenar URL publica - tudo via signed URL
        path,
        uploadPorId: user.id,
        validadeAte: validadeAte || null,
        alertarDiasAntes: alertarDiasAntes ?? 30,
        ...(acl.visibility && visNormalized && { visibility: visNormalized as any }),
        ...(acl.allowedRoles && allowedRolesArr.length > 0 && { allowedRoles: allowedRolesArr }),
        ...(acl.allowedUserIds && allowedUserIdsArr.length > 0 && { allowedUserIds: allowedUserIdsArr }),
        ...(acl.allowedDepartamentos && allowedDepartamentosArr.length > 0 && { allowedDepartamentos: allowedDepartamentosArr }),
      },
      select
    );

    const { status, dias } = calcularStatusValidade(
      (documento as any).validadeAte,
      (documento as any).alertarDiasAntes
    );

    // Log de auditoria para anexaÃ§Ã£o de documento
    await registrarLog({
      usuarioId: user.id as number,
      acao: 'ANEXAR',
      entidade: 'DOCUMENTO',
      entidadeId: documento.id,
      entidadeNome: documento.nome,
      empresaId,
      detalhes: `Tipo: ${tipo}`,
      ip: getIp(request),
    });

    return jsonBigInt({ ...documento, validadeStatus: status, validadeDias: dias }, { status: 201 });
  } catch (e: any) {
    console.error('Erro ao fazer upload de documento da empresa:', e);
    return NextResponse.json({ error: e.message || 'Erro ao fazer upload' }, { status: 500 });
  }
}

