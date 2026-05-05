import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { verificarPermissaoDocumento } from '@/app/utils/verificarPermissaoDocumento';
import { buildProcessReadWhere, getUserDepartmentId, isAdminLike } from '@/app/utils/processAccess';
import { ensureProcessInterligacaoSchema, normalizeInterligacaoTemplateIds } from '@/app/utils/processInterligacaoSchema';
import { getIp, registrarLog, registrarLogsCampos } from '@/app/utils/logAuditoria';
import { notificarDepartamentoPorEmail } from '@/app/utils/notificacaoEmail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

let tipoCampoEnumEnsured = false;

async function ensureTipoCampoEnum() {
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
}

function parseDateMaybe(value: any): Date | undefined {
  if (!value) return undefined;
  // Se for string no formato YYYY-MM-DD, adiciona horário ao meio-dia para evitar problemas de timezone
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value + 'T12:00:00');
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function sanitizeJson(value: any): any {
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeJson);
  }
  if (value && typeof value === 'object') {
    // Preserva Date
    if (value instanceof Date) return value;
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeJson(v);
    return out;
  }
  return value;
}

function toPrismaStatus(status: string) {
  const s = String(status).trim();
  if (!s) return s as any;
  // aceita 'em_andamento' e 'EM_ANDAMENTO'
  return s === s.toLowerCase() ? s.toUpperCase() : s;
}

async function buildChecklistInicialData(
  tx: any,
  fluxoFinal: number[],
  responsavelId: number | undefined,
  responsavelNome: string | undefined
) {
  const deptIdsParalelo = fluxoFinal
    .map((deptId: any) => Number(deptId))
    .filter((deptId: number) => Number.isFinite(deptId) && deptId > 0);

  if (deptIdsParalelo.length === 0) {
    return [];
  }

  const gerentesPorDept = await tx.usuario.findMany({
    where: {
      departamentoId: { in: deptIdsParalelo },
      role: 'GERENTE',
      ativo: true,
    },
    select: { id: true, nome: true, departamentoId: true },
  });

  const gerenteMap = new Map<number, { id: number; nome: string }>();
  for (const gerente of gerentesPorDept) {
    if (gerente.departamentoId && !gerenteMap.has(gerente.departamentoId)) {
      gerenteMap.set(gerente.departamentoId, { id: gerente.id, nome: gerente.nome });
    }
  }

  const deptsInfo = await tx.departamento.findMany({
    where: { id: { in: deptIdsParalelo } },
    select: { id: true, responsavel: true },
  });

  const deptResponsavelMap = new Map<number, string>();
  for (const dept of deptsInfo) {
    if (dept.responsavel) {
      deptResponsavelMap.set(dept.id, dept.responsavel);
    }
  }

  return deptIdsParalelo.map((deptId: number) => {
    const gerente = gerenteMap.get(deptId);
    return {
      departamentoId: deptId,
      concluido: false,
      responsavelId: gerente?.id || responsavelId || null,
      responsavelNome: gerente?.nome || deptResponsavelMap.get(deptId) || responsavelNome || null,
    };
  });
}

async function persistQuestionariosPorDepartamentoTx(
  tx: any,
  processoId: number,
  qpd: Record<string, any>,
  toTipoCampo: (tipo: any) => string
) {
  for (const [chaveRaw, perguntasRaw] of Object.entries(qpd)) {
    // Chave pode ser "8" (primeira etapa, retrocompatível) ou "8:2", "8:3" (etapas subsequentes).
    const partes = String(chaveRaw).split(':');
    const departamentoId = Number(partes[0]);
    const etapa = partes.length > 1 ? Math.max(1, Number(partes[1]) || 1) : 1;
    if (!Number.isFinite(departamentoId) || departamentoId <= 0) continue;

    const perguntas = Array.isArray(perguntasRaw) ? perguntasRaw : [];
    const idMap = new Map<number, number>();
    const pendentesCondicao: Array<{
      createdId: number;
      condicao: { perguntaId: number; operador?: string; valor?: string };
    }> = [];
    const pendentesControladoPor: Array<{
      createdId: number;
      controladoPorOriginal: number;
    }> = [];

    for (let i = 0; i < perguntas.length; i++) {
      const pergunta: any = perguntas[i] || {};
      const label = String(pergunta.label ?? '').trim();
      if (!label) continue;

      const opcoes = Array.isArray(pergunta.opcoes)
        ? pergunta.opcoes
            .map((opcao: any) => String(opcao ?? '').trim())
            .filter((opcao: string) => opcao.length > 0)
        : [];

      const ordem = Number.isFinite(Number(pergunta.ordem)) ? Number(pergunta.ordem) : i;
      const originalId = Number(pergunta.id);

      const created = await tx.questionarioDepartamento.create({
        data: {
          processoId,
          departamentoId,
          label,
          tipo: toTipoCampo(pergunta.tipo) as any,
          obrigatorio: Boolean(pergunta.obrigatorio),
          ordem,
          opcoes,
          condicaoPerguntaId: null,
          condicaoOperador: null,
          condicaoValor: null,
          modoRepeticao: pergunta.modoRepeticao || null,
          subPerguntas: pergunta.subPerguntas ? JSON.parse(JSON.stringify(pergunta.subPerguntas)) : undefined,
          controladoPor: null,
        },
      });

      // Aplica a etapa via SQL cru (compatível com Prisma client antigo).
      // A coluna tem default 1, então só atualizamos para etapas > 1.
      if (etapa > 1) {
        try {
          await tx.$executeRawUnsafe(
            `UPDATE "QuestionarioDepartamento" SET "etapa" = ${Number(etapa)} WHERE id = ${Number(created.id)}`
          );
        } catch {
          // Coluna "etapa" ainda não foi aplicada no banco — ignora silenciosamente.
        }
      }

      if (Number.isFinite(originalId)) {
        idMap.set(originalId, created.id);
      }

      if (pergunta?.condicao?.perguntaId) {
        pendentesCondicao.push({
          createdId: created.id,
          condicao: {
            perguntaId: Number(pergunta.condicao.perguntaId),
            operador: pergunta?.condicao?.operador ? String(pergunta.condicao.operador) : undefined,
            valor: pergunta?.condicao?.valor ? String(pergunta.condicao.valor) : undefined,
          },
        });
      }

      if (pergunta.controladoPor && Number.isFinite(Number(pergunta.controladoPor))) {
        pendentesControladoPor.push({
          createdId: created.id,
          controladoPorOriginal: Number(pergunta.controladoPor),
        });
      }
    }

    for (const item of pendentesCondicao) {
      const mapped = idMap.get(Number(item.condicao.perguntaId));
      await tx.questionarioDepartamento.update({
        where: { id: item.createdId },
        data: {
          condicaoPerguntaId: mapped ?? null,
          condicaoOperador: item.condicao.operador ?? null,
          condicaoValor: item.condicao.valor ?? null,
        },
      });
    }

    for (const item of pendentesControladoPor) {
      const mapped = idMap.get(item.controladoPorOriginal);
      if (mapped) {
        await tx.questionarioDepartamento.update({
          where: { id: item.createdId },
          data: { controladoPor: mapped },
        });
      }
    }
  }
}

async function persistInterligacaoProcessos(params: {
  processoOrigemId: number;
  processoDestino: {
    id: number;
    nomeServico?: string | null;
    nomeEmpresa?: string | null;
  };
  criadoPorId: number;
}) {
  const { processoOrigemId, processoDestino, criadoPorId } = params;

  if (!Number.isFinite(processoOrigemId) || processoOrigemId <= 0) return;
  if (processoOrigemId === processoDestino.id) return;

  const origem = await prisma.processo.findUnique({
    where: { id: processoOrigemId },
    select: { id: true, nomeServico: true, nomeEmpresa: true },
  });

  if (!origem) {
    console.warn(
      `[LOG] Processo origem #${processoOrigemId} não encontrado; interligação será ignorada sem abortar a criação.`
    );
    return;
  }

  const origemNome = origem.nomeServico || origem.nomeEmpresa || `#${origem.id}`;
  const destinoNome =
    processoDestino.nomeServico || processoDestino.nomeEmpresa || `#${processoDestino.id}`;

  try {
    await prisma.historicoEvento.create({
      data: {
        processoId: processoDestino.id,
        tipo: 'ALTERACAO',
        acao: `🔗 Solicitação interligada — continuação de: ${origemNome}`,
        responsavelId: criadoPorId,
        departamento: 'Sistema',
        dataTimestamp: BigInt(Date.now()),
      },
    });
  } catch (error) {
    console.warn(
      `Não foi possível criar histórico de interligação no processo #${processoDestino.id}:`,
      error
    );
  }

  try {
    await prisma.historicoEvento.create({
      data: {
        processoId: origem.id,
        tipo: 'ALTERACAO',
        acao: `🔗 Nova solicitação interligada criada: ${destinoNome} (#${processoDestino.id})`,
        responsavelId: criadoPorId,
        departamento: 'Sistema',
        dataTimestamp: BigInt(Date.now() + 1),
      },
    });
  } catch (error) {
    console.warn(`Não foi possível criar histórico no processo de origem #${origem.id}:`, error);
  }

  try {
    await (prisma as any).interligacaoProcesso.upsert({
      where: {
        processoOrigemId_processoDestinoId: {
          processoOrigemId: origem.id,
          processoDestinoId: processoDestino.id,
        },
      },
      update: {},
      create: {
        processoOrigemId: origem.id,
        processoDestinoId: processoDestino.id,
        criadoPorId,
        automatica: true,
      },
    });
    await registrarLog({
      usuarioId: criadoPorId,
      acao: 'INTERLIGAR',
      entidade: 'PROCESSO',
      entidadeId: processoDestino.id,
      entidadeNome: destinoNome,
      campo: 'processoOrigemId',
      valorAnterior: null,
      valorNovo: String(origem.id),
      detalhes: `Solicitacao #${processoDestino.id} criada como continuacao de #${origem.id}.`,
      processoId: processoDestino.id,
    });
  } catch (error) {
    console.warn(`Não foi possível criar interligação com processo #${origem.id}:`, error);
  }
}

// GET /api/processos
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    await ensureProcessInterligacaoSchema();

    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status');
    const departamentoId = searchParams.get('departamentoId');
    const empresaId = searchParams.get('empresaId');
    const liteParam = searchParams.get('lite');
    const lite = liteParam === null ? true : !(liteParam === '0' || liteParam.toLowerCase() === 'false');
    
    const baseWhere = {
      ...(status && { status: toPrismaStatus(status) as any }),
      ...(departamentoId && { departamentoAtual: parseInt(departamentoId) }),
      ...(empresaId && { empresaId: parseInt(empresaId) }),
    };
    const readWhere = buildProcessReadWhere(user);
    const where = Object.keys(readWhere).length > 0
      ? { AND: [baseWhere, readWhere] }
      : baseWhere;

    const processos = await prisma.processo.findMany({
      where,
      include: lite
        ? {
            empresa: true,
            ...({ responsavel: { select: { id: true, nome: true, email: true } } } as any),
            tags: { include: { tag: true } },
            _count: { select: { comentarios: true, documentos: true } },
            criadoPor: { select: { id: true, nome: true, email: true } },
          }
        : {
            empresa: true,
            // `responsavel` é um campo recém-adicionado; em alguns ambientes o TS pode resolver um Prisma Client antigo.
            // O cast mantém o runtime correto e evita erro de "excess property".
            ...({ responsavel: { select: { id: true, nome: true, email: true } } } as any),
            tags: {
              include: { tag: true },
            },
            comentarios: {
              include: { autor: { select: { id: true, nome: true, email: true } } },
              orderBy: { criadoEm: 'desc' },
              take: 5,
            },
            documentos: {
              take: 5,
            },
            historicoEventos: {
              include: { responsavel: { select: { id: true, nome: true } } },
              orderBy: { data: 'desc' },
              take: 10,
            },
            criadoPor: {
              select: { id: true, nome: true, email: true },
            },
          },
      orderBy: { dataCriacao: 'desc' },
    });

    // Filtrar documentos por visibilidade usando utilitário centralizado
    const userId = Number((user as any).id);
    const userRole = String((user as any).role || '').toUpperCase();
    const userDeptId = getUserDepartmentId(user);
    const usuarioPermissao = { id: userId, role: userRole, departamentoId: userDeptId };
    const visibleDepartmentIds = isAdminLike(user)
      ? null
      : (typeof userDeptId === 'number' ? [userDeptId] : []);

    for (const p of processos) {
      if (Array.isArray((p as any).documentos)) {
        (p as any).documentos = (p as any).documentos.filter((d: any) =>
          verificarPermissaoDocumento(
            {
              visibility: d.visibility,
              allowedRoles: d.allowedRoles,
              allowedUserIds: d.allowedUserIds,
              uploadPorId: d.uploadPorId,
              allowedDepartamentos: d.allowedDepartamentos || null,
            },
            usuarioPermissao
          ) && (
            !visibleDepartmentIds ||
            !Number.isFinite(Number(d?.departamentoId ?? d?.departamento_id)) ||
            visibleDepartmentIds.includes(Number(d?.departamentoId ?? d?.departamento_id))
          )
        );
      }

      if (visibleDepartmentIds && Array.isArray((p as any).comentarios)) {
        (p as any).comentarios = (p as any).comentarios.filter((comentario: any) => {
          const departamentoComentario = Number(comentario?.departamentoId ?? comentario?.departamento_id);
          if (!Number.isFinite(departamentoComentario)) return true;
          return visibleDepartmentIds.includes(departamentoComentario);
        });
      }

    }

    // No modo lite, _count.documentos vem do Prisma sem filtro de visibilidade.
    // Sobrescrever com a contagem real de documentos visíveis para o usuário.
    if (lite) {
      try {
        const processoIds = processos.map((p: any) => p.id);
        const allDocs = await prisma.documento.findMany({
          where: { processoId: { in: processoIds } },
          select: { id: true, processoId: true, visibility: true, allowedRoles: true, allowedUserIds: true, allowedDepartamentos: true, uploadPorId: true },
        });
        // Contar documentos visíveis por processo
        const countPorProcesso: Record<number, number> = {};
        for (const d of allDocs) {
          if (verificarPermissaoDocumento(
            {
              visibility: (d as any).visibility,
              allowedRoles: (d as any).allowedRoles,
              allowedUserIds: (d as any).allowedUserIds,
              uploadPorId: d.uploadPorId,
              allowedDepartamentos: (d as any).allowedDepartamentos || null,
            },
            usuarioPermissao
          ) && (
            !visibleDepartmentIds ||
            !Number.isFinite(Number((d as any)?.departamentoId ?? (d as any)?.departamento_id)) ||
            visibleDepartmentIds.includes(Number((d as any)?.departamentoId ?? (d as any)?.departamento_id))
          )) {
            countPorProcesso[d.processoId] = (countPorProcesso[d.processoId] || 0) + 1;
          }
        }
        for (const p of processos) {
          if ((p as any)._count) {
            (p as any)._count.documentos = countPorProcesso[p.id] || 0;
          }
        }
      } catch {
        // manter contagens originais se falhar
      }
    }

    // NextResponse.json usa JSON.stringify internamente e quebra com BigInt.
    // Replacer garante serialização segura (ex.: documentos.tamanho, historicoEventos.dataTimestamp).
    const body = JSON.stringify(processos, (_key, value) =>
      typeof value === 'bigint'
        ? (value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString())
        : value
    );
    return new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao buscar processos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar processos' },
      { status: 500 }
    );
  }
}

// POST /api/processos
export async function POST(request: NextRequest) {

  try {
    const t0 = Date.now();
    console.log('[LOG] INÍCIO POST /api/processos', t0);

    const { user, error } = await requireAuth(request);
    if (!user) return error;
    await ensureProcessInterligacaoSchema();
    console.log('[LOG] requireAuth:', Date.now() - t0, 'ms');

    const data = await request.json();
    console.log('[LOG] request.json:', Date.now() - t0, 'ms');

    // Compatibilidade com bancos antigos que ainda nao possuem todos os valores atuais de TipoCampo.
    await ensureTipoCampoEnum();

    const roleUpper = String((user as any).role || '').toUpperCase();
    const departamentoUsuarioRaw = (user as any).departamentoId ?? (user as any).departamento_id;
    const departamentoUsuario = Number.isFinite(Number(departamentoUsuarioRaw)) ? Number(departamentoUsuarioRaw) : undefined;

    const fluxoRaw: any[] = Array.isArray(data?.fluxoDepartamentos) ? data.fluxoDepartamentos : [];
    const fluxoParsed: number[] = fluxoRaw.map((x: any) => Number(x)).filter((x: any) => Number.isFinite(x));

    const departamentoAtualParsed = Number(data?.departamentoAtual);
    const departamentoAtualNum = Number.isFinite(departamentoAtualParsed) ? departamentoAtualParsed : undefined;

    // Garante que o processo sempre nasce em um departamento ATIVO e existente.
    // Isso evita casos em que o template tem ids antigos/inválidos e a solicitação "some" do kanban.
    // Paraleliza busca de departamentos e gerentes (se possível)
    const departamentosPromise = prisma.departamento.findMany({
      where: { ativo: true },
      select: { id: true },
      orderBy: { ordem: 'asc' },
    });

    // Só pode buscar gerentes depois de saber o departamentoInicial, então paralelização só é possível para departamentos
    const departamentosAtivos = await departamentosPromise;
    console.log('[LOG] prisma.departamento.findMany:', Date.now() - t0, 'ms');
    const deptIds = new Set<number>(departamentosAtivos.map((d) => d.id));

    const fluxo = fluxoParsed.filter((id) => deptIds.has(id));
    const departamentoInicial =
      (typeof departamentoAtualNum === 'number' && deptIds.has(departamentoAtualNum)
        ? departamentoAtualNum
        : fluxo[0] ?? departamentosAtivos[0]?.id);

    if (!departamentoInicial || !Number.isFinite(departamentoInicial)) {
      console.log('[LOG] Departamento inicial inválido:', Date.now() - t0, 'ms');
      return NextResponse.json({ error: 'Departamento inicial inválido' }, { status: 400 });
    }

    const fluxoFinal = fluxo.length > 0 ? fluxo : [departamentoInicial];
    const idxInicial = Math.max(0, fluxoFinal.indexOf(departamentoInicial));

    const personalizado = Boolean(data?.personalizado);

    // Usuário normal NÃO pode criar solicitação personalizada
    if (personalizado && roleUpper === 'USUARIO') {
      console.log('[LOG] Sem permissão para criar solicitação personalizada:', Date.now() - t0, 'ms');
      return NextResponse.json(
        { error: 'Sem permissão para criar solicitação personalizada' },
        { status: 403 }
      );
    }

    // Usuário comum pode criar solicitação (inclusive personalizada) desde que o fluxo comece no dept dele
    // (a validação por departamento acontece abaixo).

    // Usuário comum e gerente devem ter departamento definido
    if ((roleUpper === 'USUARIO' || roleUpper === 'GERENTE') && typeof departamentoUsuario !== 'number') {
      console.log('[LOG] Usuário sem departamento definido:', Date.now() - t0, 'ms');
      return NextResponse.json({ error: 'Usuário sem departamento definido' }, { status: 403 });
    }

    // Usuário comum e gerente: só podem criar solicitação cujo primeiro dept seja um dos deptos dele
    // (principal ou qualquer um dos extras).
    if (roleUpper === 'USUARIO' || roleUpper === 'GERENTE') {
      const { getUserDepartmentIds } = await import('@/app/utils/processAccess');
      const deptosDoUsuario = getUserDepartmentIds(user as any);
      if (!deptosDoUsuario.includes(Number(departamentoInicial))) {
        console.log('[LOG] Sem permissão para criar solicitação para outro departamento:', Date.now() - t0, 'ms');
        return NextResponse.json({ error: 'Sem permissão para criar solicitação para outro departamento' }, { status: 403 });
      }
    }

    const toTipoCampo = (tipo: any) => {
      const t = String(tipo || '').trim().toLowerCase();
      switch (t) {
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
        default: {
          // Pode vir ja em uppercase (enum do Prisma)
          const upper = String(tipo || '').trim().toUpperCase();
          const validos = ['TEXT','TEXTAREA','NUMBER','DATE','BOOLEAN','SELECT','CHECKBOX','FILE','PHONE','EMAIL','CPF','CNPJ','CEP','MONEY','GRUPO_REPETIVEL','TITULO'];
          if (validos.includes(upper)) return upper;
          return 'TEXT';
        }
      }
    };
    
    const dataInicio = parseDateMaybe(data?.dataInicio) ?? new Date();
    const dataEntrega = parseDateMaybe(data?.dataEntrega) ?? addDays(dataInicio, 15);
    const processoOrigemIdParsed = Number(data?.processoOrigemId);
    const processoOrigemId = Number.isFinite(processoOrigemIdParsed) ? processoOrigemIdParsed : undefined;
    const interligacaoTemplateIds = normalizeInterligacaoTemplateIds(data?.interligacaoTemplateIds);

    // Grupos (sequencial/paralelo) — opcional, tem precedência sobre a fila plana
    const interligacaoGruposSanitizados: Array<{ modo: 'sequencial' | 'paralelo'; templateIds: number[] }> =
      Array.isArray(data?.interligacaoGrupos)
        ? data.interligacaoGrupos
            .map((g: any) => ({
              modo: (g?.modo === 'paralelo' ? 'paralelo' : 'sequencial') as 'sequencial' | 'paralelo',
              templateIds: Array.isArray(g?.templateIds)
                ? g.templateIds.map((x: any) => Number(x)).filter((x: any) => Number.isFinite(x) && x > 0)
                : [],
            }))
            .filter((g: any) => g.templateIds.length > 0)
        : [];

    // Dependências entre etapas do fluxo (formato { "chaveEtapa": ["depende1", "depende2"] })
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

    const responsavelIdRaw = data?.responsavelId;
    let responsavelId = Number.isFinite(Number(responsavelIdRaw)) ? Number(responsavelIdRaw) : undefined;

    let responsavelNome: string | undefined;
    let responsavelAtivoId: number | undefined;

    // Se veio responsavelId, valida se existe e está ativo
    if (typeof responsavelId === 'number') {
      const tResp = Date.now();
      const resp = await prisma.usuario.findUnique({ where: { id: responsavelId }, select: { id: true, ativo: true, nome: true } });
      console.log('[LOG] prisma.usuario.findUnique:', Date.now() - t0, 'ms');
      if (!resp || !resp.ativo) {
        console.log('[LOG] Responsável inválido:', Date.now() - t0, 'ms');
        return NextResponse.json({ error: 'Responsável inválido' }, { status: 400 });
      }
      responsavelNome = resp.nome;
      responsavelAtivoId = resp.id;
    } else {
      // Auto-assign: busca o gerente do departamento inicial
      try {
        let candidato = await prisma.usuario.findFirst({
          where: {
            departamentoId: departamentoInicial,
            role: 'GERENTE',
            ativo: true,
          },
          select: { id: true, nome: true },
        });

        // Fallback: usuário definido como "responsavel" no cadastro do departamento
        if (!candidato) {
          const dept = await prisma.departamento.findUnique({
            where: { id: departamentoInicial },
            select: { responsavel: true },
          });
          if (dept?.responsavel) {
            candidato = await prisma.usuario.findFirst({
              where: {
                ativo: true,
                nome: { equals: dept.responsavel, mode: 'insensitive' },
              },
              select: { id: true, nome: true },
            });
          }
        }

        // Fallback final: qualquer usuário ativo no departamento
        if (!candidato) {
          candidato = await prisma.usuario.findFirst({
            where: {
              ativo: true,
              departamentoId: departamentoInicial,
            },
            orderBy: { role: 'asc' },
            select: { id: true, nome: true },
          });
        }

        if (candidato) {
          responsavelId = candidato.id;
          responsavelNome = candidato.nome;
          responsavelAtivoId = candidato.id;
          console.log('[LOG] Auto-assign responsável do departamento inicial:', candidato.nome);
        }
      } catch (e) {
        console.log('[LOG] Erro ao buscar responsável para auto-assign:', e);
      }
    }

    const qpd = data?.questionariosPorDepartamento;
    const projetoIdParsed = Number(data?.projetoId);
    let projetoId: number | null = Number.isFinite(projetoIdParsed) && projetoIdParsed > 0 ? projetoIdParsed : null;

    // Projeto automático: se o usuário não escolheu um projeto e a solicitação NÃO é filha
    // de outra (processoOrigemId ausente), cria um Projeto sozinho. Vale tanto pra solicitações
    // solo quanto pra que iniciam cadeias — em ambos os casos é o "dossiê" da empresa,
    // ajudando a organizar tudo sob um mesmo guarda-chuva.
    const deveCriarProjetoAuto = projetoId === null
      && !processoOrigemId;
    if (deveCriarProjetoAuto) {
      try {
        // Nome = "{nome da solicitação} - {nome da empresa}"
        const nomeSolic = String(data?.nomeServico || data?.nome || 'Solicitação').trim();
        const nomeEmp = String(data?.nomeEmpresa || '').trim();
        const nomeProjeto = nomeEmp ? `${nomeSolic} - ${nomeEmp}` : nomeSolic;

        // Garante que o enum/tabela existem (idempotente)
        await prisma.$executeRawUnsafe(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusProjeto') THEN
              CREATE TYPE "StatusProjeto" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDO', 'PAUSADO', 'CANCELADO');
            END IF;
          END$$;
        `);

        const empresaIdProjeto = data.empresaId != null && Number.isFinite(Number(data.empresaId)) ? Number(data.empresaId) : null;
        const respIdProjeto = typeof responsavelId === 'number' ? responsavelId : null;
        const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
          `INSERT INTO "Projeto" ("nome", "empresaId", "status", "responsavelId", "criadoPorId", "atualizadoEm")
           VALUES ($1,
             ${empresaIdProjeto === null ? 'NULL' : Number(empresaIdProjeto)},
             'EM_ANDAMENTO'::"StatusProjeto",
             ${respIdProjeto === null ? 'NULL' : Number(respIdProjeto)},
             ${Number(user.id)},
             CURRENT_TIMESTAMP)
           RETURNING id`,
          nomeProjeto
        );
        const novoProjetoId = rows?.[0]?.id;
        if (novoProjetoId && Number.isFinite(Number(novoProjetoId))) {
          projetoId = Number(novoProjetoId);
          console.log('[LOG] Projeto automático criado:', novoProjetoId, '-', nomeProjeto);
        }
      } catch (err) {
        console.warn('[LOG] Não foi possível criar projeto automático:', err);
        // Não bloqueia a criação da solicitação — apenas segue sem projeto
      }
    }

    const tProcesso = Date.now();
    const processo = await prisma.$transaction(async (tx) => {
      const proc = await tx.processo.create({
        data: {
          nome: data.nome || null,
          nomeServico: data.nomeServico || null,
          nomeEmpresa: data.nomeEmpresa,
          cliente: String(data.cliente || '').trim() || responsavelNome || null,
          email: data.email || null,
          telefone: data.telefone || null,
          ...(typeof responsavelId === 'number' ? { responsavelId } : {}),
          ...(data.empresaId != null ? { empresaId: data.empresaId } : {}),
          status: data.status || 'EM_ANDAMENTO',
          prioridade: data.prioridade || 'MEDIA',
          departamentoAtual: departamentoInicial,
          departamentoAtualIndex: Number.isFinite(Number(data?.departamentoAtualIndex)) ? Number(data.departamentoAtualIndex) : idxInicial,
          fluxoDepartamentos: fluxoFinal,
          descricao: data.descricao || null,
          notasCriador: data.notasCriador || null,
          criadoPorId: user.id,
          progresso: data.progresso || 0,
          dataInicio,
          dataEntrega,
          ...(typeof processoOrigemId === 'number' ? { processoOrigemId } : {}),
          ...(data.interligadoComId ? { interligadoComId: Number(data.interligadoComId) } : {}),
          ...(data.interligadoNome ? { interligadoNome: String(data.interligadoNome) } : {}),
          ...(data.interligadoParalelo != null ? { interligadoParalelo: Boolean(data.interligadoParalelo) } : {}),
          ...(interligacaoTemplateIds.length > 0 ? { interligacaoTemplateIds } : {}),
          ...(data.deptIndependente != null ? { deptIndependente: Boolean(data.deptIndependente) } : {}),
        },
        select: {
          id: true,
          nome: true,
          nomeServico: true,
          nomeEmpresa: true,
          cliente: true,
          email: true,
          telefone: true,
          responsavelId: true,
          empresaId: true,
          status: true,
          prioridade: true,
          departamentoAtual: true,
          departamentoAtualIndex: true,
          fluxoDepartamentos: true,
          descricao: true,
          notasCriador: true,
          criadoPorId: true,
          progresso: true,
          dataInicio: true,
          dataEntrega: true,
          processoOrigemId: true,
          interligadoComId: true,
          interligadoNome: true,
          interligadoParalelo: true,
          interligacaoTemplateIds: true,
          deptIndependente: true,
        },
      });

      // Vincula projetoId via raw SQL (compatível com Prisma client antigo e migração aplicada)
      if (projetoId !== null) {
        try {
          await tx.$executeRawUnsafe(
            `UPDATE "Processo" SET "projetoId" = ${Number(projetoId)} WHERE id = ${Number(proc.id)}`
          );
        } catch {
          // coluna projetoId ainda não aplicada — ignora silenciosamente
        }
      }

      // Persiste interligacaoGrupos via raw (se passado)
      if (interligacaoGruposSanitizados.length > 0) {
        try {
          await tx.$executeRawUnsafe(
            `UPDATE "Processo" SET "interligacaoGrupos" = $1::jsonb WHERE id = ${Number(proc.id)}`,
            JSON.stringify(interligacaoGruposSanitizados)
          );
        } catch {
          // coluna ainda não aplicada — segue sem grupos (fica só a fila plana)
        }
      }

      // Persiste dependenciasDept via raw (se passado)
      if (Object.keys(dependenciasDeptSanitizadas).length > 0) {
        try {
          await tx.$executeRawUnsafe(
            `UPDATE "Processo" SET "dependenciasDept" = $1::jsonb WHERE id = ${Number(proc.id)}`,
            JSON.stringify(dependenciasDeptSanitizadas)
          );
        } catch {
          // coluna ainda não aplicada — segue sem dependências
        }
      }

      if (data.deptIndependente && Array.isArray(fluxoFinal) && fluxoFinal.length > 1) {
        const checklistInicial = await buildChecklistInicialData(
          tx,
          fluxoFinal,
          responsavelId,
          responsavelNome
        );

        if (checklistInicial.length > 0) {
          await (tx as any).checklistDepartamento.createMany({
            data: checklistInicial.map((item: any) => ({
              processoId: proc.id,
              ...item,
            })),
            skipDuplicates: true,
          });
          console.log('[LOG] Checklist paralelo criado com responsáveis por departamento');
        }
      }

      if (qpd && typeof qpd === 'object') {
        await persistQuestionariosPorDepartamentoTx(
          tx,
          proc.id,
          qpd as Record<string, any>,
          toTipoCampo
        );
      }

      await tx.historicoEvento.create({
        data: {
          processoId: proc.id,
          tipo: 'INICIO',
          acao: `Solicitação criada: ${proc.nomeServico || 'Solicitação'}`,
          responsavelId: user.id,
          departamento: 'Sistema',
          dataTimestamp: BigInt(Date.now()),
        },
      });

      await tx.historicoFluxo.create({
        data: {
          processoId: proc.id,
          departamentoId: proc.departamentoAtual,
          ordem: proc.departamentoAtualIndex,
          status: 'em_andamento',
          entradaEm: new Date(),
        },
      });

      return proc;
    });
    console.log('[LOG] prisma.$transaction (processo):', Date.now() - tProcesso, 'ms');

    const ip = getIp(request as any);
    const entidadeNome = processo.nomeServico || processo.nomeEmpresa || `#${processo.id}`;

    await registrarLog({
      usuarioId: user.id,
      acao: 'CRIAR',
      entidade: 'PROCESSO',
      entidadeId: processo.id,
      entidadeNome,
      processoId: processo.id,
      empresaId: processo.empresaId ?? null,
      detalhes: `Solicitacao criada${processoOrigemId ? ` como continuacao de #${processoOrigemId}` : ''}.`,
      ip,
    });

    await registrarLogsCampos({
      usuarioId: user.id,
      acao: 'CRIAR',
      entidade: 'PROCESSO',
      entidadeId: processo.id,
      entidadeNome,
      processoId: processo.id,
      empresaId: processo.empresaId ?? null,
      ip,
      campos: [
        { campo: 'nome', valorNovo: processo.nome },
        { campo: 'nomeServico', valorNovo: processo.nomeServico },
        { campo: 'nomeEmpresa', valorNovo: processo.nomeEmpresa },
        { campo: 'cliente', valorNovo: processo.cliente },
        { campo: 'email', valorNovo: processo.email },
        { campo: 'telefone', valorNovo: processo.telefone },
        { campo: 'responsavelId', valorNovo: processo.responsavelId },
        { campo: 'status', valorNovo: processo.status },
        { campo: 'prioridade', valorNovo: processo.prioridade },
        { campo: 'departamentoAtual', valorNovo: processo.departamentoAtual },
        { campo: 'fluxoDepartamentos', valorNovo: processo.fluxoDepartamentos },
        { campo: 'descricao', valorNovo: processo.descricao },
        { campo: 'notasCriador', valorNovo: processo.notasCriador },
        { campo: 'dataInicio', valorNovo: processo.dataInicio },
        { campo: 'dataEntrega', valorNovo: processo.dataEntrega },
        { campo: 'processoOrigemId', valorNovo: processo.processoOrigemId },
        { campo: 'interligadoComId', valorNovo: processo.interligadoComId },
        { campo: 'interligadoNome', valorNovo: processo.interligadoNome },
        { campo: 'interligacaoTemplateIds', valorNovo: processo.interligacaoTemplateIds },
        { campo: 'interligadoParalelo', valorNovo: processo.interligadoParalelo },
        { campo: 'deptIndependente', valorNovo: processo.deptIndependente },
      ],
    });

    if (typeof processoOrigemId === 'number') {
      await persistInterligacaoProcessos({
        processoOrigemId,
        processoDestino: processo,
        criadoPorId: user.id,
      });
    }

    // Notificação persistida: somente gerentes do departamento e responsável (se definido)
    try {
      // gerentes do dept inicial
      const gerentes = await prisma.usuario.findMany({
        where: {
          ativo: true,
          role: 'GERENTE',
          departamentoId: departamentoInicial,
        },
        select: { id: true },
      });
      console.log('[LOG] prisma.usuario.findMany (gerentes):', Date.now() - t0, 'ms');

      const ids = new Set<number>(gerentes.map((g) => g.id));

      // responsável escolhido (já validado acima)
      if (typeof responsavelAtivoId === 'number') ids.add(responsavelAtivoId);

      // não notifica o próprio criador
      ids.delete(user.id);
      const destinatarios = Array.from(ids).map((id) => ({ id }));

      if (destinatarios.length > 0) {
        const nomeEmpresa = processo.nomeEmpresa || 'Empresa';
        const nomeServico = processo.nomeServico ? ` - ${processo.nomeServico}` : '';
        const mensagem = `Nova solicitação criada: ${nomeEmpresa}${nomeServico}`;

        await prisma.notificacao.createMany({
          data: destinatarios.map((u) => ({
            usuarioId: u.id,
            mensagem,
            tipo: 'INFO',
            processoId: processo.id,
            link: `/`,
          })),
        });
        console.log('[LOG] prisma.notificacao.createMany:', Date.now() - t0, 'ms');
      }
    } catch (e) {
      console.error('Erro ao criar notificações de criação:', e);
    }

    try {
      const departamentoInicialInfo = await prisma.departamento.findUnique({
        where: { id: departamentoInicial },
        select: { nome: true },
      });

      void notificarDepartamentoPorEmail({
        processoId: processo.id,
        departamentoId: departamentoInicial,
        departamentoNome: departamentoInicialInfo?.nome || 'Departamento',
        empresaNome: processo.nomeEmpresa || 'Empresa',
        servicoNome: processo.nomeServico || null,
        responsavelAnteriorNome: null,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || null,
      }).catch((err) => console.error('Erro ao enviar email de notificação na criação:', err));
    } catch (error) {
      console.error('Erro ao preparar email de notificação na criação:', error);
    }

    console.log('[LOG] FIM POST /api/processos:', Date.now() - t0, 'ms');
    return NextResponse.json(processo, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar processo:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Erro ao criar processo: ${errorMsg}` },
      { status: 500 }
    );
  }
}
