import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { uploadFile, deleteFile } from '@/app/utils/supabase';
import { requireAuth } from '@/app/utils/routeAuth';
import { verificarPermissaoDocumento } from '@/app/utils/verificarPermissaoDocumento';
import { registrarLog, getIp, registrarLogsCampos } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENTOS_POR_PROCESSO = 50;

function jsonBigInt(data: unknown, init?: { status?: number }) {
  return new NextResponse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ),
    {
      status: init?.status ?? 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    }
  );
}

// GET /api/documentos?processoId=123
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const { searchParams } = new URL(request.url);
    const processoId = searchParams.get('processoId');
    const departamentoId = searchParams.get('departamentoId');
    
    if (!processoId) {
      return NextResponse.json(
        { error: 'processoId é obrigatório' },
        { status: 400 }
      );
    }
    
    const documentos = await prisma.documento.findMany({
      where: {
        processoId: parseInt(processoId),
        ...(departamentoId && { departamentoId: parseInt(departamentoId) }),
      },
      include: {
        departamento: {
          select: { id: true, nome: true },
        },
      },
      orderBy: { dataUpload: 'desc' },
    });

    const userId = Number((user as any).id);
    const userRole = String((user as any).role || '').toUpperCase();

    const filtrados = documentos.filter(d =>
      verificarPermissaoDocumento(
        {
          visibility: (d as any).visibility,
          allowedRoles: (d as any).allowedRoles,
          allowedUserIds: (d as any).allowedUserIds,
          uploadPorId: d.uploadPorId,
          allowedDepartamentos: (d as any).allowedDepartamentos || null,
        },
        { id: userId, role: userRole, departamentoId: Number((user as any).departamentoId) || null }
      )
    );
    return jsonBigInt(filtrados);
  } catch (error) {
    console.error('Erro ao buscar documentos:', error);
    return jsonBigInt({ error: 'Erro ao buscar documentos' }, { status: 500 });
  }
}

// POST /api/documentos - Upload de documento
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    
    const formData = await request.formData();
    const file = formData.get('arquivo') as File;
    const processoId = parseInt(formData.get('processoId') as string);
    const tipo = formData.get('tipo') as string;
    const departamentoId = formData.get('departamentoId')
      ? parseInt(formData.get('departamentoId') as string)
      : null;
    const perguntaIdStr = formData.get('perguntaId') as string | null;
    // IDs de sub-perguntas de grupos repetíveis são gerados como Date.now() + Math.random(),
    // podendo ser floats grandes (ex: 1740870000000.56). Usamos Math.trunc para obter o inteiro
    // e BigInt para suportar valores acima do limite Int (2147483647).
    const perguntaId = perguntaIdStr ? BigInt(Math.trunc(parseFloat(perguntaIdStr))) : null;
    
    if (!file || !processoId || !tipo) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Arquivo excede o limite de ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB` },
        { status: 400 }
      );
    }

    const documentosExistentes = await prisma.documento.count({
      where: { processoId },
    });
    if (documentosExistentes >= MAX_DOCUMENTOS_POR_PROCESSO) {
      return NextResponse.json(
        { error: `Limite de ${MAX_DOCUMENTOS_POR_PROCESSO} documentos por processo atingido` },
        { status: 400 }
      );
    }
    
    // Upload para Supabase Storage
    const { url, path } = await uploadFile(file, `processos/${processoId}`);
    
    // Salvar no banco
    // parse visibility metadata (optional)
    const visibilityRaw = (formData.get('visibility') as string) || undefined;
    const allowedRolesRaw = (formData.get('allowedRoles') as string) || undefined; // comma-separated
    const allowedUserIdsRaw = (formData.get('allowedUserIds') as string) || undefined; // comma-separated

    const allowedRolesArr = allowedRolesRaw ? allowedRolesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const allowedUserIdsArr = allowedUserIdsRaw ? allowedUserIdsRaw.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n)) : [];

    const allowedDepartamentosRaw = (formData.get('allowedDepartamentos') as string) || undefined;
    const allowedDepartamentosArr = allowedDepartamentosRaw ? allowedDepartamentosRaw.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n)) : [];

    // Normaliza visibility para o enum aceito pelo Prisma
    const visibilityRawUpper = visibilityRaw ? String(visibilityRaw).toUpperCase() : undefined;
    const visibilityNormalized = visibilityRawUpper && ['PUBLIC', 'ROLES', 'USERS', 'DEPARTAMENTOS', 'NONE'].includes(visibilityRawUpper)
      ? (visibilityRawUpper as 'PUBLIC' | 'ROLES' | 'USERS' | 'DEPARTAMENTOS' | 'NONE')
      : undefined;

    // Garantir que o uploader esteja incluido em allowedUserIds quando visibility=USERS
    if (visibilityNormalized === 'USERS' && !allowedUserIdsArr.includes(user.id)) {
      allowedUserIdsArr.push(user.id);
    }

    // Nunca expor URL publica — tudo via signed URL
    const storedUrl = '';

    const documento = await prisma.documento.create({
      data: {
        processoId,
        nome: file.name,
        tipo,
        tipoCategoria: (formData.get('tipoCategoria') as string) || null,
        tamanho: BigInt(file.size),
        url: storedUrl,
        path,
        departamentoId,
        perguntaId,
        uploadPorId: user.id,
        ...(visibilityNormalized && { visibility: visibilityNormalized as any }),
        ...(allowedRolesArr.length > 0 && { allowedRoles: allowedRolesArr }),
        ...(allowedUserIdsArr.length > 0 && { allowedUserIds: allowedUserIdsArr }),
        ...(allowedDepartamentosArr.length > 0 && { allowedDepartamentos: allowedDepartamentosArr }),
      },
      include: {
        departamento: {
          select: { id: true, nome: true },
        },
      },
    });
    
    // Criar evento no histórico
    await prisma.historicoEvento.create({
      data: {
        processoId,
        tipo: 'DOCUMENTO',
        acao: `Documento "${file.name}" adicionado`,
        responsavelId: user.id,
        dataTimestamp: BigInt(Date.now()),
      },
    });

    // Log detalhado de upload
    const ip = getIp(request);
    await registrarLog({
      usuarioId: user.id,
      acao: 'ANEXAR',
      entidade: 'DOCUMENTO',
      entidadeId: documento.id,
      entidadeNome: file.name,
      campo: 'arquivo',
      valorAnterior: null,
      valorNovo: file.name,
      processoId,
      departamentoId: departamentoId || undefined,
      ip,
    });

    await registrarLogsCampos({
      usuarioId: user.id,
      acao: 'ANEXAR',
      entidade: 'DOCUMENTO',
      entidadeId: documento.id,
      entidadeNome: file.name,
      processoId,
      departamentoId: departamentoId || undefined,
      ip,
      campos: [
        { campo: 'nome', valorNovo: documento.nome },
        { campo: 'tipo', valorNovo: documento.tipo },
        { campo: 'tipoCategoria', valorNovo: documento.tipoCategoria },
        { campo: 'tamanho', valorNovo: documento.tamanho },
        { campo: 'departamentoId', valorNovo: documento.departamentoId },
        { campo: 'perguntaId', valorNovo: documento.perguntaId },
        { campo: 'visibility', valorNovo: (documento as any).visibility },
        { campo: 'allowedRoles', valorNovo: (documento as any).allowedRoles },
        { campo: 'allowedUserIds', valorNovo: (documento as any).allowedUserIds },
        { campo: 'allowedDepartamentos', valorNovo: (documento as any).allowedDepartamentos },
      ],
    });

    return jsonBigInt(documento, { status: 201 });
  } catch (error) {
    console.error('Erro no upload:', error);
    const message = error instanceof Error ? error.message : 'Erro ao fazer upload';
    return jsonBigInt({ error: message }, { status: 500 });
  }
}




