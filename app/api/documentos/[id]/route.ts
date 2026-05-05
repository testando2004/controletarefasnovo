import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { deleteFile, generateSignedUrl } from '@/app/utils/supabase';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';
import { verificarPermissaoDocumento } from '@/app/utils/verificarPermissaoDocumento';
import { detectarMudancas, getIp, registrarLogsCampos } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// Dias para expiração na lixeira
const DIAS_EXPIRACAO_LIXEIRA = 15;

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

// DELETE /api/documentos/:id - Move para lixeira ao invés de excluir permanentemente
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    const idRaw = params.id;
    const docId = Number(idRaw);
    if (!Number.isFinite(docId) || Number.isNaN(docId)) {
      console.warn('DELETE /api/documentos/:id recebido com id inválido', idRaw);
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }

    // Buscar documento
    const documento = await prisma.documento.findUnique({
      where: { id: docId },
      include: {
        departamento: { select: { id: true, nome: true } },
      },
    });

    if (!documento) {
      console.warn(`Documento não encontrado ao excluir, id=${docId}`);
      return NextResponse.json(
        { error: 'Documento não encontrado', id: docId },
        { status: 404 }
      );
    }
    
    // Verificar permissão para excluir usando utilitário centralizado
    const userId = Number(user.id);
    const userRole = String((user as any).role || '').toUpperCase();

    const podeVer = verificarPermissaoDocumento(
      {
        visibility: (documento as any).visibility,
        allowedRoles: (documento as any).allowedRoles,
        allowedUserIds: (documento as any).allowedUserIds,
        uploadPorId: documento.uploadPorId,
        allowedDepartamentos: (documento as any).allowedDepartamentos || null,
      },
      { id: userId, role: userRole, departamentoId: Number((user as any).departamentoId) || null }
    );

    if (!podeVer) {
      return NextResponse.json(
        { error: 'Sem permissão para excluir este documento' },
        { status: 403 }
      );
    }
    
    // Calcular data de expiração (15 dias)
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + DIAS_EXPIRACAO_LIXEIRA);

    // Mover para lixeira ao invés de excluir
    try {
      const dadosOriginais = JSON.parse(JSON.stringify({
        id: documento.id,
        processoId: documento.processoId,
        nome: documento.nome,
        tipo: documento.tipo,
        tipoCategoria: (documento as any).tipoCategoria,
        tamanho: documento.tamanho.toString(),
        url: documento.url,
        path: documento.path,
        departamentoId: documento.departamentoId,
        perguntaId: documento.perguntaId,
        dataUpload: documento.dataUpload,
        uploadPorId: documento.uploadPorId,
        visibility: (documento as any).visibility,
        allowedRoles: (documento as any).allowedRoles,
        allowedUserIds: (documento as any).allowedUserIds,
      }));

      const docVis = String((documento as any).visibility || 'PUBLIC').toUpperCase();
      const docAllowedRoles: string[] = Array.isArray((documento as any).allowedRoles) ? (documento as any).allowedRoles.map((r: any) => String(r)) : [];
      const docAllowedUserIds: number[] = Array.isArray((documento as any).allowedUserIds) ? (documento as any).allowedUserIds.map((n: any) => Number(n)) : [];

      await prisma.itemLixeira.create({
        data: {
          tipoItem: 'DOCUMENTO',
          itemIdOriginal: documento.id,
          dadosOriginais,
          processoId: documento.processoId,
          departamentoId: documento.departamentoId,
          visibility: docVis,
          allowedRoles: docAllowedRoles.map(r => r.toLowerCase()),
          allowedUserIds: docAllowedUserIds,
          deletadoPorId: userId,
          expiraEm: dataExpiracao,
          nomeItem: documento.nome,
          descricaoItem: `Documento ${documento.tipo} do processo #${documento.processoId}`,
        },
      });
    } catch (e) {
      console.error('Erro ao criar ItemLixeira for documento:', e);
    }
    
    // Agora sim, excluir do banco (mas NÃO do storage - para permitir restauração)
    await prisma.documento.delete({
      where: { id: parseInt(params.id) },
    });
    
    // Criar evento no histórico
    await prisma.historicoEvento.create({
      data: {
        processoId: documento.processoId,
        tipo: 'DOCUMENTO',
        acao: `Documento "${documento.nome}" movido para lixeira`,
        responsavelId: user.id,
        dataTimestamp: BigInt(Date.now()),
      },
    });

    await registrarLogsCampos({
      usuarioId: user.id,
      acao: 'EXCLUIR',
      entidade: 'DOCUMENTO',
      entidadeId: documento.id,
      entidadeNome: documento.nome,
      processoId: documento.processoId,
      departamentoId: documento.departamentoId,
      ip: getIp(request),
      campos: [
        { campo: 'arquivo', valorAnterior: documento.nome, valorNovo: null, detalhes: 'Documento movido para lixeira.' },
        { campo: 'tipo', valorAnterior: documento.tipo, valorNovo: null },
        { campo: 'perguntaId', valorAnterior: documento.perguntaId, valorNovo: null },
      ],
    });
    
    return NextResponse.json({ 
      message: 'Documento movido para lixeira',
      diasParaExpiracao: DIAS_EXPIRACAO_LIXEIRA,
    });
  } catch (error) {
    console.error('Erro ao excluir documento:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir documento' },
      { status: 500 }
    );
  }
}

// PATCH /api/documentos/:id -> atualizar permissões de visibilidade
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const docId = Number(params.id);
    if (!Number.isFinite(docId)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

    const documento = await prisma.documento.findUnique({ where: { id: docId } });
    if (!documento) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });

    // Apenas quem fez upload ou admin pode editar permissões
    const userId = Number((user as any).id);
    const userRole = String((user as any).role || '').toUpperCase();
    if (documento.uploadPorId !== userId && userRole !== 'ADMIN' && userRole !== 'ADMIN_DEPARTAMENTO') {
      return NextResponse.json({ error: 'Sem permissão para editar permissões deste documento' }, { status: 403 });
    }

    const body = await request.json();
    const { visibility, allowedRoles, allowedUserIds, allowedDepartamentos } = body;

    const updateData: any = {};
    if (visibility) {
      updateData.visibility = String(visibility).toUpperCase();
      // Ao mudar visibilidade, limpar arrays que não se aplicam ao novo tipo
      const vis = updateData.visibility;
      if (vis === 'PUBLIC' || vis === 'NONE') {
        updateData.allowedRoles = [];
        updateData.allowedUserIds = [];
        updateData.allowedDepartamentos = [];
      } else if (vis === 'ROLES') {
        updateData.allowedRoles = Array.isArray(allowedRoles) ? allowedRoles.map((r: any) => String(r)) : [];
        updateData.allowedUserIds = [];
        updateData.allowedDepartamentos = [];
      } else if (vis === 'USERS') {
        updateData.allowedRoles = [];
        updateData.allowedUserIds = Array.isArray(allowedUserIds) ? allowedUserIds.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n)) : [];
        updateData.allowedDepartamentos = [];
      } else if (vis === 'DEPARTAMENTOS') {
        updateData.allowedRoles = [];
        updateData.allowedUserIds = [];
        updateData.allowedDepartamentos = Array.isArray(allowedDepartamentos) ? allowedDepartamentos.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n)) : [];
      }
    } else {
      // Sem mudança de visibilidade, atualizar apenas os arrays enviados
      if (Array.isArray(allowedRoles)) updateData.allowedRoles = allowedRoles.map((r: any) => String(r));
      if (Array.isArray(allowedUserIds)) updateData.allowedUserIds = allowedUserIds.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n));
      if (Array.isArray(allowedDepartamentos)) updateData.allowedDepartamentos = allowedDepartamentos.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n));
    }

    const atualizado = await prisma.documento.update({
      where: { id: docId },
      data: updateData,
    });

    const mudancas = detectarMudancas(
      {
        visibility: (documento as any).visibility,
        allowedRoles: (documento as any).allowedRoles,
        allowedUserIds: (documento as any).allowedUserIds,
        allowedDepartamentos: (documento as any).allowedDepartamentos,
      },
      {
        visibility: (atualizado as any).visibility,
        allowedRoles: (atualizado as any).allowedRoles,
        allowedUserIds: (atualizado as any).allowedUserIds,
        allowedDepartamentos: (atualizado as any).allowedDepartamentos,
      }
    );

    await registrarLogsCampos({
      usuarioId: user.id,
      acao: 'EDITAR',
      entidade: 'DOCUMENTO',
      entidadeId: atualizado.id,
      entidadeNome: atualizado.nome,
      processoId: atualizado.processoId,
      departamentoId: atualizado.departamentoId,
      ip: getIp(request),
      campos: mudancas.map((mudanca) => ({
        campo: mudanca.campo,
        valorAnterior: mudanca.valorAnterior,
        valorNovo: mudanca.valorNovo,
      })),
    });

    return jsonBigInt(atualizado);
  } catch (error: any) {
    console.error('Erro no PATCH /api/documentos/:id', error);
    const msg = error instanceof Error ? error.message : 'Erro ao atualizar documento';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/documentos/:id -> retorna URL temporária (signed) se permitido
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const docId = Number(params.id);
    if (!Number.isFinite(docId)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

    const documento = await prisma.documento.findUnique({ where: { id: docId } });
    if (!documento) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });

    // Verificar permissão de visualização usando utilitário centralizado
    const userId = Number((user as any).id);
    const userRole = String((user as any).role || '').toUpperCase();

    const podeVer = verificarPermissaoDocumento(
      {
        visibility: (documento as any).visibility,
        allowedRoles: (documento as any).allowedRoles,
        allowedUserIds: (documento as any).allowedUserIds,
        uploadPorId: documento.uploadPorId,
        allowedDepartamentos: (documento as any).allowedDepartamentos || null,
      },
      { id: userId, role: userRole, departamentoId: Number((user as any).departamentoId) || null }
    );

    if (!podeVer) return NextResponse.json({ error: 'Sem permissão para visualizar este documento' }, { status: 403 });

    // Sempre gerar signed URL temporária (300s) — nunca expor URL pública
    if (!documento.path) {
      console.error('Documento não possui path armazenado, não é possível gerar signed URL', { id: documento.id });
      return NextResponse.json({ error: 'Documento sem arquivo disponível' }, { status: 400 });
    }

    const signedUrl = await generateSignedUrl(documento.path, 300);
    if (!signedUrl) {
      return NextResponse.json({ error: 'Erro ao gerar URL temporária' }, { status: 500 });
    }

    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error('Erro no GET /api/documentos/:id', error);
    return NextResponse.json({ error: 'Erro ao buscar documento' }, { status: 500 });
  }
}




