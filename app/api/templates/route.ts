import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { registrarLog, getIp } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/templates
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const templates = await prisma.template.findMany({
      include: {
        criadoPor: {
          select: { id: true, nome: true, email: true },
        },
      },
      orderBy: { criado_em: 'desc' },
    });

    // Enriquece com colunas que o Prisma client antigo pode não conhecer
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{
        id: number;
        interligacaoTemplateIds: number[] | null;
        interligacaoParalelo: boolean | null;
        interligacaoGrupos: any;
        dependenciasDept: any;
      }>>(
        `SELECT id, "interligacaoTemplateIds", "interligacaoParalelo", "interligacaoGrupos", "dependenciasDept" FROM "Template"`
      );
      const mapa = new Map<number, { ids: number[]; paralelo: boolean; grupos: any; deps: any }>();
      for (const r of rows || []) {
        mapa.set(Number(r.id), {
          ids: Array.isArray(r.interligacaoTemplateIds) ? r.interligacaoTemplateIds.map(Number) : [],
          paralelo: Boolean(r.interligacaoParalelo),
          grupos: r.interligacaoGrupos ?? [],
          deps: r.dependenciasDept ?? {},
        });
      }
      for (const t of templates as any[]) {
        const extra = mapa.get(Number(t.id));
        if (extra) {
          (t as any).interligacaoTemplateIds = extra.ids;
          (t as any).interligacaoParalelo = extra.paralelo;
          (t as any).interligacaoGrupos = extra.grupos;
          (t as any).dependenciasDept = extra.deps;
        } else {
          (t as any).interligacaoTemplateIds = (t as any).interligacaoTemplateIds ?? [];
          (t as any).interligacaoParalelo = (t as any).interligacaoParalelo ?? false;
          (t as any).interligacaoGrupos = (t as any).interligacaoGrupos ?? [];
          (t as any).dependenciasDept = (t as any).dependenciasDept ?? {};
        }
      }
    } catch {
      // Colunas ainda não aplicadas no banco — segue sem os campos
    }

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Erro ao buscar templates:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar templates' },
      { status: 500 }
    );
  }
}

// POST /api/templates
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    
    const data = await request.json();
    
    const interligacaoTemplateIds = Array.isArray(data.interligacaoTemplateIds)
      ? data.interligacaoTemplateIds
          .map((x: any) => Number(x))
          .filter((x: any) => Number.isFinite(x) && x > 0)
      : [];
    const interligacaoParalelo = Boolean(data.interligacaoParalelo);

    // Grupos com modo sequencial/paralelo (opcional — prevalece sobre a fila flat)
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

    // Dependências entre etapas do fluxo (para deptIndependente): mapa chave -> lista de chaves
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

    const template = await prisma.template.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        fluxoDepartamentos: data.fluxoDepartamentos || [],
        questionariosPorDepartamento: data.questionariosPorDepartamento || {},
        criadoPorId: user.id,
      },
      include: {
        criadoPor: {
          select: { id: true, nome: true, email: true },
        },
      },
    });

    // Salva os campos de interligação via SQL cru (compatível com Prisma client antigo)
    if (
      interligacaoTemplateIds.length > 0 ||
      interligacaoParalelo ||
      interligacaoGruposSanitizados.length > 0 ||
      Object.keys(dependenciasDeptSanitizadas).length > 0
    ) {
      try {
        const idsArrayLiteral = interligacaoTemplateIds.length > 0
          ? `ARRAY[${interligacaoTemplateIds.map((n) => Number(n)).join(',')}]::INTEGER[]`
          : `ARRAY[]::INTEGER[]`;
        const gruposJson = JSON.stringify(interligacaoGruposSanitizados);
        const depsJson = JSON.stringify(dependenciasDeptSanitizadas);
        await prisma.$executeRawUnsafe(
          `UPDATE "Template" SET "interligacaoTemplateIds" = ${idsArrayLiteral}, "interligacaoParalelo" = ${interligacaoParalelo}, "interligacaoGrupos" = $1::jsonb, "dependenciasDept" = $2::jsonb WHERE id = ${Number(template.id)}`,
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
    }

    await registrarLog({
      usuarioId: user.id,
      acao: 'CRIAR',
      entidade: 'TEMPLATE',
      entidadeId: template.id,
      entidadeNome: template.nome,
      ip: getIp(request),
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar template:', error);
    return NextResponse.json(
      { error: 'Erro ao criar template' },
      { status: 500 }
    );
  }
}




