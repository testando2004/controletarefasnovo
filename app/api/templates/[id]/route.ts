import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';
import { registrarLog, getIp } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/templates/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const template = await prisma.template.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        criadoPor: {
          select: { id: true, nome: true, email: true },
        },
      },
    });
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template não encontrado' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(template);
  } catch (error) {
    console.error('Erro ao buscar template:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar template' },
      { status: 500 }
    );
  }
}

// PUT /api/templates/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const id = parseInt(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existente = await prisma.template.findUnique({ where: { id } });
    if (!existente) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    const data = await request.json();

    const interligacaoTemplateIds = Array.isArray(data.interligacaoTemplateIds)
      ? data.interligacaoTemplateIds
          .map((x: any) => Number(x))
          .filter((x: any) => Number.isFinite(x) && x > 0)
      : [];
    const interligacaoParalelo = Boolean(data.interligacaoParalelo);

    const interligacaoGruposSanitizados: Array<{ modo: 'sequencial' | 'paralelo'; templateIds: number[] }> =
      Array.isArray(data.interligacaoGrupos)
        ? data.interligacaoGrupos
            .map((g: any) => ({
              modo: g?.modo === 'paralelo' ? 'paralelo' : 'sequencial',
              templateIds: Array.isArray(g?.templateIds)
                ? g.templateIds.map((x: any) => Number(x)).filter((x: any) => Number.isFinite(x) && x > 0)
                : [],
            }))
            .filter((g: any) => g.templateIds.length > 0)
        : [];

    const dependenciasDeptSanitizadas: Record<string, string[]> = (() => {
      const raw = data?.dependenciasDept;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      const out: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (Array.isArray(v)) {
          const lista = v.map(String).filter((s) => s.trim() !== '');
          if (lista.length > 0) out[String(k)] = Array.from(new Set(lista));
        }
      }
      return out;
    })();

    const template = await prisma.template.update({
      where: { id },
      data: {
        nome: typeof data.nome === 'string' && data.nome.trim() ? data.nome : existente.nome,
        descricao: typeof data.descricao === 'string' ? data.descricao : existente.descricao,
        fluxoDepartamentos: data.fluxoDepartamentos ?? existente.fluxoDepartamentos,
        questionariosPorDepartamento: data.questionariosPorDepartamento ?? existente.questionariosPorDepartamento,
      },
      include: {
        criadoPor: {
          select: { id: true, nome: true, email: true },
        },
      },
    });

    try {
      const idsArrayLiteral = interligacaoTemplateIds.length > 0
        ? `ARRAY[${interligacaoTemplateIds.map((n) => Number(n)).join(',')}]::INTEGER[]`
        : `ARRAY[]::INTEGER[]`;
      const gruposJson = JSON.stringify(interligacaoGruposSanitizados);
      const depsJson = JSON.stringify(dependenciasDeptSanitizadas);
      await prisma.$executeRawUnsafe(
        `UPDATE "Template" SET "interligacaoTemplateIds" = ${idsArrayLiteral}, "interligacaoParalelo" = ${interligacaoParalelo}, "interligacaoGrupos" = $1::jsonb, "dependenciasDept" = $2::jsonb WHERE id = ${Number(id)}`,
        gruposJson,
        depsJson
      );
      (template as any).interligacaoTemplateIds = interligacaoTemplateIds;
      (template as any).interligacaoParalelo = interligacaoParalelo;
      (template as any).interligacaoGrupos = interligacaoGruposSanitizados;
      (template as any).dependenciasDept = dependenciasDeptSanitizadas;
    } catch (err) {
      console.warn('Não foi possível salvar campos de interligação do template:', err);
    }

    await registrarLog({
      usuarioId: user.id,
      acao: 'ATUALIZAR',
      entidade: 'TEMPLATE',
      entidadeId: template.id,
      entidadeNome: template.nome,
      ip: getIp(request),
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Erro ao atualizar template:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar template' },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    if (!requireRole(user, ['ADMIN'])) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const template = await prisma.template.findUnique({ where: { id: parseInt(params.id) } });
    if (!template) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });

    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 15);

    try {
      const dadosOriginais = JSON.parse(JSON.stringify(template));
      await prisma.itemLixeira.create({
        data: {
          tipoItem: 'TEMPLATE',
          itemIdOriginal: template.id,
          dadosOriginais,
          visibility: 'PUBLIC',
          allowedRoles: [],
          allowedUserIds: [],
          deletadoPorId: user.id as number,
          expiraEm: dataExpiracao,
          nomeItem: template.nome,
          descricaoItem: template.descricao || null,
        }
      });
    } catch (e) {
      console.error('Erro ao criar ItemLixeira for template:', e);
    }

    // Antes de deletar, limpa referências deste template em outros templates
    // (interligacaoTemplateIds e interligacaoGrupos) — evita IDs órfãos.
    try {
      // 1) Remove o id do array interligacaoTemplateIds em todos os templates
      await prisma.$executeRawUnsafe(
        `UPDATE "Template"
           SET "interligacaoTemplateIds" = COALESCE(array_remove("interligacaoTemplateIds", $1), ARRAY[]::INTEGER[])
         WHERE $1 = ANY("interligacaoTemplateIds")`,
        template.id
      );

      // 2) Busca templates cujos interligacaoGrupos referenciam o id e atualiza um a um
      const afetados = await prisma.$queryRawUnsafe<Array<{ id: number; interligacaoGrupos: any }>>(
        `SELECT id, "interligacaoGrupos"
           FROM "Template"
          WHERE "interligacaoGrupos" IS NOT NULL
            AND EXISTS (
              SELECT 1
                FROM jsonb_array_elements("interligacaoGrupos") AS g
               WHERE g->'templateIds' @> to_jsonb($1::int)
            )`,
        template.id
      );

      for (const t of afetados || []) {
        const gruposAtuais: Array<{ modo: string; templateIds: any[] }> = Array.isArray(t.interligacaoGrupos)
          ? t.interligacaoGrupos
          : [];
        const gruposLimpos = gruposAtuais
          .map((g) => ({
            modo: g?.modo === 'paralelo' ? 'paralelo' : 'sequencial',
            templateIds: (Array.isArray(g?.templateIds) ? g.templateIds : [])
              .map((x: any) => Number(x))
              .filter((x: number) => Number.isFinite(x) && x !== template.id),
          }))
          .filter((g) => g.templateIds.length > 0);
        await prisma.$executeRawUnsafe(
          `UPDATE "Template" SET "interligacaoGrupos" = $1::jsonb WHERE id = $2`,
          JSON.stringify(gruposLimpos),
          t.id
        );
      }
    } catch (cleanupErr) {
      console.error('Erro ao limpar referências do template em outros templates:', cleanupErr);
    }

    await prisma.template.delete({ where: { id: template.id } });

    await registrarLog({
      usuarioId: user.id,
      acao: 'EXCLUIR',
      entidade: 'TEMPLATE',
      entidadeId: template.id,
      entidadeNome: template.nome,
      ip: getIp(request),
    });

    return NextResponse.json({ message: 'Template movido para lixeira' });
  } catch (error) {
    console.error('Erro ao excluir template:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir template' },
      { status: 500 }
    );
  }
}




