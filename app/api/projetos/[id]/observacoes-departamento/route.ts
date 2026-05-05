import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { getIp, registrarLog } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// PATCH /api/projetos/[id]/observacoes-departamento
// Body: { departamentoId: number, observacao: string | null }
// Atualiza apenas a chave do departamento dentro do JSON observacoesDepartamentos.
// Passar observacao = null ou string vazia remove a entrada do departamento.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const projetoId = Number(params.id);
    if (!Number.isFinite(projetoId) || projetoId <= 0) {
      return NextResponse.json({ error: 'ID do projeto inválido' }, { status: 400 });
    }

    const data = await request.json();
    const departamentoId = Number(data?.departamentoId);
    if (!Number.isFinite(departamentoId) || departamentoId <= 0) {
      return NextResponse.json({ error: 'departamentoId inválido' }, { status: 400 });
    }

    const observacaoRaw = data?.observacao;
    const observacao = typeof observacaoRaw === 'string' ? observacaoRaw.trim() : null;

    const rows = await prisma.$queryRawUnsafe<Array<{ id: number; nome: string; observacoesDepartamentos: any }>>(
      `SELECT id, nome, "observacoesDepartamentos" FROM "Projeto" WHERE id = ${projetoId}`
    );
    const projeto = rows?.[0];
    if (!projeto) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    const atual: Record<string, string> =
      projeto.observacoesDepartamentos && typeof projeto.observacoesDepartamentos === 'object'
        ? { ...projeto.observacoesDepartamentos }
        : {};

    if (observacao && observacao.length > 0) {
      atual[String(departamentoId)] = observacao;
    } else {
      delete atual[String(departamentoId)];
    }

    const novoJson = Object.keys(atual).length > 0 ? JSON.stringify(atual) : null;

    if (novoJson === null) {
      await prisma.$executeRawUnsafe(
        `UPDATE "Projeto" SET "observacoesDepartamentos" = NULL, "atualizadoEm" = CURRENT_TIMESTAMP WHERE id = ${projetoId}`
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE "Projeto" SET "observacoesDepartamentos" = $1::jsonb, "atualizadoEm" = CURRENT_TIMESTAMP WHERE id = ${projetoId}`,
        novoJson
      );
    }

    await registrarLog({
      usuarioId: user.id,
      acao: 'EDITAR',
      entidade: 'PROJETO',
      entidadeId: projetoId,
      entidadeNome: projeto.nome,
      detalhes: observacao
        ? `Observação do departamento #${departamentoId} atualizada`
        : `Observação do departamento #${departamentoId} removida`,
      ip: getIp(request),
    });

    return NextResponse.json({
      ok: true,
      observacoesDepartamentos: atual,
    });
  } catch (error) {
    console.error('Erro ao atualizar observação do departamento:', error);
    return NextResponse.json({ error: 'Erro ao atualizar observação' }, { status: 500 });
  }
}
