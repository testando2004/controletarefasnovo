import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';
import { assertProcessAccess, canAccessDepartment } from '@/app/utils/processAccess';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

let tipoCampoEnumEnsured = false;

const ensureTipoCampoEnum = async () => {
  if (tipoCampoEnumEnsured) return;
  try {
    const valores = ['CHECKBOX', 'CPF', 'CNPJ', 'CEP', 'MONEY', 'GRUPO_REPETIVEL', 'TITULO'];
    for (const valor of valores) {
      await prisma.$executeRawUnsafe(`ALTER TYPE "TipoCampo" ADD VALUE IF NOT EXISTS '${valor}'`);
    }
    tipoCampoEnumEnsured = true;
  } catch (error) {
    console.warn('Aviso: nao foi possivel garantir valores do enum TipoCampo:', error);
  }
};

const toTipoCampo = (tipo: any) => {
  const t = String(tipo || '').trim().toUpperCase();
  switch (t) {
    case 'TEXT':
    case 'TEXTAREA':
    case 'NUMBER':
    case 'DATE':
    case 'BOOLEAN':
    case 'SELECT':
    case 'CHECKBOX':
    case 'FILE':
    case 'PHONE':
    case 'EMAIL':
    case 'CPF':
    case 'CNPJ':
    case 'CEP':
    case 'MONEY':
    case 'GRUPO_REPETIVEL':
    case 'TITULO':
      return t;
    default: {
      const low = String(tipo || '').trim().toLowerCase();
      switch (low) {
        case 'text':
          return 'TEXT';
        case 'textarea':
          return 'TEXTAREA';
        case 'number':
          return 'NUMBER';
        case 'date':
          return 'DATE';
        case 'boolean':
          return 'BOOLEAN';
        case 'select':
          return 'SELECT';
        case 'checkbox':
        case 'checklist':
          return 'CHECKBOX';
        case 'file':
          return 'FILE';
        case 'phone':
          return 'PHONE';
        case 'email':
          return 'EMAIL';
        case 'cpf':
          return 'CPF';
        case 'cpj':
        case 'cnpj':
          return 'CNPJ';
        case 'cep':
          return 'CEP';
        case 'money':
          return 'MONEY';
        case 'grupo_repetivel':
          return 'GRUPO_REPETIVEL';
        case 'titulo':
        case 'title':
        case 'titulo_secao':
        case 'heading':
          return 'TITULO';
        default:
          return 'TEXT';
      }
    }
  }
};

// GET /api/questionarios?departamentoId=123&processoId=456
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const { searchParams } = new URL(request.url);
    const departamentoId = searchParams.get('departamentoId');
    const processoId = searchParams.get('processoId');
    
    if (!departamentoId) {
      return NextResponse.json(
        { error: 'departamentoId é obrigatório' },
        { status: 400 }
      );
    }
    
    const did = parseInt(departamentoId);
    if (processoId) {
      const access = await assertProcessAccess(user, parseInt(processoId), 'read', { departamentoId: did });
      if (access.error) return access.error;
    } else if (!canAccessDepartment(user, did)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const questionarios = await prisma.questionarioDepartamento.findMany({
      where: {
        departamentoId: did,
        ...(processoId ? { processoId: parseInt(processoId) } : { processoId: null }),
      },
      orderBy: { ordem: 'asc' },
      include: {
        respostas: {
          include: {
            respondidoPor: {
              select: { id: true, nome: true },
            },
          },
        },
      },
    });
    
    return NextResponse.json(questionarios);
  } catch (error) {
    console.error('Erro ao buscar questionários:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar questionários' },
      { status: 500 }
    );
  }
}

// POST /api/questionarios - Criar pergunta
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    if (!requireRole(user, ['ADMIN', 'GERENTE'])) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const data = await request.json();
    await ensureTipoCampoEnum();

    if (data?.processoId) {
      const access = await assertProcessAccess(user, Number(data.processoId), 'manage_questionario', {
        departamentoId: Number(data.departamentoId),
      });
      if (access.error) return access.error;
    } else if (!canAccessDepartment(user, Number(data?.departamentoId))) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    
    const questionario = await prisma.questionarioDepartamento.create({
      data: {
        departamentoId: data.departamentoId,
        processoId: data.processoId || null,
        label: data.label,
        tipo: toTipoCampo(data.tipo) as any,
        obrigatorio: data.obrigatorio || false,
        ordem: data.ordem || 0,
        opcoes: data.opcoes || [],
        placeholder: data.placeholder,
        descricao: data.descricao,
        condicaoPerguntaId: data.condicaoPerguntaId,
        condicaoOperador: data.condicaoOperador,
        condicaoValor: data.condicaoValor,
      },
    });
    
    return NextResponse.json(questionario, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar pergunta:', error);
    return NextResponse.json(
      { error: 'Erro ao criar pergunta' },
      { status: 500 }
    );
  }
}

// PUT /api/questionarios - sincronizar perguntas de um processo+departamento
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    await ensureTipoCampoEnum();

    // Permite admin/gerente editar questionários
    if (!requireRole(user, ['ADMIN', 'GERENTE'])) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const { processoId, departamentoId, perguntas, etapa: etapaRaw } = await request.json();
    const pid = Number(processoId);
    const did = Number(departamentoId);
    const etapa = Number.isFinite(Number(etapaRaw)) && Number(etapaRaw) >= 1 ? Number(etapaRaw) : 1;

    if (!Number.isFinite(pid) || !Number.isFinite(did) || did <= 0 || pid <= 0) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const access = await assertProcessAccess(user, pid, 'manage_questionario', { departamentoId: did });
    if (access.error) return access.error;

    const list = Array.isArray(perguntas) ? perguntas : [];

    const result = await prisma.$transaction(async (tx) => {
      // Busca IDs existentes filtrando por etapa via SQL cru (compatível com Prisma client antigo).
      let idsExistentesDesta: number[] = [];
      try {
        const rows = await tx.$queryRawUnsafe<Array<{ id: number }>>(
          `SELECT id FROM "QuestionarioDepartamento" WHERE "processoId" = ${Number(pid)} AND "departamentoId" = ${Number(did)} AND "etapa" = ${Number(etapa)}`
        );
        idsExistentesDesta = (rows || []).map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
      } catch {
        // Fallback: coluna "etapa" ainda não aplicada — usa todos da combinação (etapa = 1 implícita)
        const fallback = await tx.questionarioDepartamento.findMany({
          where: { processoId: pid, departamentoId: did },
          select: { id: true },
        });
        idsExistentesDesta = fallback.map((e) => e.id);
      }
      const existentes = idsExistentesDesta.map((id) => ({ id }));
      const existentesIds = new Set(existentes.map((e) => e.id));

      const idMap = new Map<number, number>();
      const keptIds: number[] = [];
      const pendentesCondicao: Array<{ id: number; condicao: any }> = [];

      // 1) create/update sem condição (resolveremos depois)
      for (let i = 0; i < list.length; i++) {
        const p: any = list[i] || {};
        const originalId = Number(p.id);
        const label = String(p.label ?? '').trim();
        if (!label) continue;

        const opcoes = Array.isArray(p.opcoes)
          ? p.opcoes.map((x: any) => String(x ?? '').trim()).filter((x: string) => x.length > 0)
          : [];
        const ordem = Number.isFinite(Number(p.ordem)) ? Number(p.ordem) : i;
        const tipo = toTipoCampo(p.tipo);
        const obrigatorio = Boolean(p.obrigatorio);

        // Campos do grupo_repetivel
        const isGrupoRepetivel = tipo === 'GRUPO_REPETIVEL';
        const modoRepeticao = isGrupoRepetivel ? (p.modoRepeticao || 'manual') : null;
        const subPerguntas = isGrupoRepetivel && Array.isArray(p.subPerguntas) ? p.subPerguntas : undefined;

        if (Number.isFinite(originalId) && existentesIds.has(originalId)) {
          await tx.questionarioDepartamento.update({
            where: { id: originalId },
            data: {
              label,
              tipo: tipo as any,
              obrigatorio,
              ordem,
              opcoes,
              condicaoPerguntaId: null,
              condicaoOperador: null,
              condicaoValor: null,
              modoRepeticao,
              subPerguntas: subPerguntas !== undefined ? JSON.parse(JSON.stringify(subPerguntas)) : undefined,
              controladoPor: null, // será resolvido depois do mapeamento de IDs
            },
          });
          idMap.set(originalId, originalId);
          keptIds.push(originalId);
          if (p?.condicao?.perguntaId) pendentesCondicao.push({ id: originalId, condicao: p.condicao });
        } else {
          const created = await tx.questionarioDepartamento.create({
            data: {
              processoId: pid,
              departamentoId: did,
              label,
              tipo: tipo as any,
              obrigatorio,
              ordem,
              opcoes,
              condicaoPerguntaId: null,
              condicaoOperador: null,
              condicaoValor: null,
              modoRepeticao,
              subPerguntas: subPerguntas !== undefined ? JSON.parse(JSON.stringify(subPerguntas)) : undefined,
              controladoPor: null,
            },
          });
          if (etapa > 1) {
            try {
              await tx.$executeRawUnsafe(
                `UPDATE "QuestionarioDepartamento" SET "etapa" = ${Number(etapa)} WHERE id = ${Number(created.id)}`
              );
            } catch {
              // coluna ainda não aplicada — segue sem etapa
            }
          }
          if (Number.isFinite(originalId)) idMap.set(originalId, created.id);
          keptIds.push(created.id);
          if (p?.condicao?.perguntaId) pendentesCondicao.push({ id: created.id, condicao: p.condicao });
        }
      }

      // 2) aplicar condições (convertendo ids temporários -> ids reais)
      for (const item of pendentesCondicao) {
        const perguntaIdOrig = Number(item.condicao?.perguntaId);
        const mapped = idMap.get(perguntaIdOrig);
        await tx.questionarioDepartamento.update({
          where: { id: item.id },
          data: {
            condicaoPerguntaId: mapped ?? null,
            condicaoOperador: item.condicao?.operador ? String(item.condicao.operador) : null,
            condicaoValor: item.condicao?.valor ? String(item.condicao.valor) : null,
          },
        });
      }

      // 2b) aplicar controladoPor para grupo_repetivel (convertendo ids temporários -> ids reais)
      for (let i = 0; i < list.length; i++) {
        const p: any = list[i] || {};
        if (p.tipo?.toLowerCase() !== 'grupo_repetivel' && p.tipo?.toUpperCase() !== 'GRUPO_REPETIVEL') continue;
        if (!p.controladoPor) continue;
        const originalId = Number(p.id);
        const realId = idMap.get(originalId) ?? originalId;
        const controladoPorOrig = Number(p.controladoPor);
        const mappedControladoPor = idMap.get(controladoPorOrig) ?? controladoPorOrig;
        if (keptIds.includes(realId)) {
          await tx.questionarioDepartamento.update({
            where: { id: realId },
            data: { controladoPor: mappedControladoPor },
          });
        }
      }

      // 3) remover perguntas que não estão mais na lista (somente desta etapa!)
      try {
        const notInClause = keptIds.length > 0
          ? `AND id NOT IN (${keptIds.map((n) => Number(n)).join(',')})`
          : '';
        await tx.$executeRawUnsafe(
          `DELETE FROM "QuestionarioDepartamento" WHERE "processoId" = ${Number(pid)} AND "departamentoId" = ${Number(did)} AND "etapa" = ${Number(etapa)} ${notInClause}`
        );
      } catch {
        // Fallback (coluna etapa não aplicada): usa deleteMany sem etapa
        await tx.questionarioDepartamento.deleteMany({
          where: {
            processoId: pid,
            departamentoId: did,
            ...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}),
          },
        });
      }

      // Lê a lista final desta etapa
      let atualizado: any[] = [];
      try {
        atualizado = await tx.$queryRawUnsafe<any[]>(
          `SELECT * FROM "QuestionarioDepartamento" WHERE "processoId" = ${Number(pid)} AND "departamentoId" = ${Number(did)} AND "etapa" = ${Number(etapa)} ORDER BY ordem ASC`
        );
      } catch {
        atualizado = await tx.questionarioDepartamento.findMany({
          where: { processoId: pid, departamentoId: did },
          orderBy: { ordem: 'asc' },
        });
      }
      return atualizado;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao sincronizar questionários:', error);
    return NextResponse.json({ error: 'Erro ao salvar questionários' }, { status: 500 });
  }
}




