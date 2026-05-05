import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';
import { verificarPermissaoDocumento } from '@/app/utils/verificarPermissaoDocumento';
import { assertProcessAccess, getUserDepartmentId } from '@/app/utils/processAccess';
import { validarProcessoParaFinalizacao } from '@/app/utils/processValidation';
import { registrarLog, detectarMudancas, getIp, registrarLogsCampos } from '@/app/utils/logAuditoria';
import { ensureProcessInterligacaoSchema, normalizeInterligacaoTemplateIds } from '@/app/utils/processInterligacaoSchema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// Dias para expiração na lixeira
const DIAS_EXPIRACAO_LIXEIRA = 15;

function parseDateMaybe(value: any): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function jsonBigInt(data: unknown, init?: { status?: number }) {
  return new NextResponse(
    JSON.stringify(data, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)),
    {
      status: init?.status ?? 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    }
  );
}

// GET /api/processos/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    await ensureProcessInterligacaoSchema();
    const processoId = parseInt(params.id);
    const access = await assertProcessAccess(user, processoId, 'read');
    if (access.error) return access.error;
    const visibleDepartmentIds = access.visibleDepartmentIds;

    const processo = await prisma.processo.findUnique({
      where: { id: processoId },
      include: {
        empresa: true,
        tags: { include: { tag: true } },
        ...({ responsavel: { select: { id: true, nome: true, email: true } } } as any),
        comentarios: {
          include: { 
            autor: { select: { id: true, nome: true, email: true } },
            departamento: { select: { id: true, nome: true } },
          },
          orderBy: { criadoEm: 'desc' },
        },
        documentos: {
          orderBy: { dataUpload: 'desc' },
        },
        historicoEventos: {
          include: { responsavel: { select: { id: true, nome: true } } },
          orderBy: { data: 'desc' },
        },
        historicoFluxos: {
          include: { departamento: true },
          orderBy: { ordem: 'asc' },
        },
        questionarios: {
          include: {
            respostas: {
              include: { respondidoPor: { select: { id: true, nome: true } } },
            },
          },
          orderBy: { ordem: 'asc' },
        },
        criadoPor: {
          select: { id: true, nome: true, email: true },
        },
      },
    });

    if (!processo) {
      return jsonBigInt({ error: 'Processo não encontrado' }, { status: 404 });
    }

    // Filtrar documentos pelo nível de visibilidade usando utilitário centralizado
    const userId = Number((user as any).id);
    const userRole = String((user as any).role || '').toUpperCase();
    const userDeptId = getUserDepartmentId(user);
    const usuarioPermissao = { id: userId, role: userRole, departamentoId: userDeptId };
    const visibleDepartmentSet = visibleDepartmentIds ? new Set(visibleDepartmentIds) : null;
    const canViewDocumento = (doc: any) =>
      verificarPermissaoDocumento(
        {
          visibility: doc?.visibility,
          allowedRoles: doc?.allowedRoles,
          allowedUserIds: doc?.allowedUserIds,
          uploadPorId: doc?.uploadPorId,
          allowedDepartamentos: doc?.allowedDepartamentos || null,
        },
        usuarioPermissao
      ) && (
        !visibleDepartmentSet ||
        !Number.isFinite(Number(doc?.departamentoId ?? doc?.departamento_id)) ||
        visibleDepartmentSet.has(Number(doc?.departamentoId ?? doc?.departamento_id))
      );

    // Montar mapa de contagem de anexos por perguntaId e por departamento (inclui total por pergunta)
    // IMPORTANTE: filtra por permissão do usuário para não expor contagens de documentos restritos
    try {
      const allDocs = await prisma.documento.findMany({
        where: { processoId: processo.id },
        select: { id: true, perguntaId: true, departamentoId: true, visibility: true, allowedRoles: true, allowedUserIds: true, allowedDepartamentos: true, uploadPorId: true },
      });
      const docsVisiveis = allDocs.filter((d: any) => canViewDocumento(d));
      const documentosCounts: Record<string, number> = {};
      for (const d of docsVisiveis) {
        const pid = Number((d as any)?.perguntaId ?? (d as any)?.pergunta_id ?? 0) || 0;
        const dept = Number((d as any)?.departamentoId ?? (d as any)?.departamento_id ?? 0) || 0;
        const keySpecific = `${pid}:${dept}`;
        const keyAny = `${pid}:0`;
        documentosCounts[keySpecific] = (documentosCounts[keySpecific] || 0) + 1;
        documentosCounts[keyAny] = (documentosCounts[keyAny] || 0) + 1;
      }
      (processo as any).documentosCounts = documentosCounts;
    } catch (e) {
      // não bloquear a resposta caso a consulta falhe; apenas seguir sem contagens
      (processo as any).documentosCounts = {};
    }
    if (Array.isArray((processo as any).documentos)) {
      (processo as any).documentos = (processo as any).documentos.filter((d: any) => canViewDocumento(d));
    }

    // Buscar todos os questionários por departamento vinculados a este processo
    if (visibleDepartmentSet) {
      (processo as any).comentarios = ((processo as any).comentarios || []).filter((comentario: any) => {
        const departamentoComentario = Number(comentario?.departamentoId ?? comentario?.departamento_id);
        if (!Number.isFinite(departamentoComentario)) return true;
        return visibleDepartmentSet.has(departamentoComentario);
      });

      (processo as any).historicoFluxos = ((processo as any).historicoFluxos || []).filter((fluxo: any) =>
        visibleDepartmentSet.has(Number(fluxo?.departamentoId))
      );

      (processo as any).questionarios = ((processo as any).questionarios || []).filter((questionario: any) =>
        visibleDepartmentSet.has(Number(questionario?.departamentoId))
      );
    }

    const questionariosPorDepartamento = await prisma.questionarioDepartamento.findMany({
      where: {
        processoId: processo.id,
        ...(visibleDepartmentIds ? { departamentoId: { in: visibleDepartmentIds } } : {}),
      },
      orderBy: { ordem: 'asc' },
    });

    // Montar objeto agrupado por (departamentoId + etapa).
    // Quando o mesmo dept aparece mais de uma vez no fluxo, cada ocorrência
    // tem etapa = 1, 2, 3..., e deve ter seu próprio questionário separado.
    // Chaves: "8" (etapa 1, retrocompatível) ou "8:2", "8:3"... (etapas seguintes).
    const questionariosPorDeptObj = {};
    for (const q of questionariosPorDepartamento) {
      const etapaQ = Number((q as any).etapa) || 1;
      const chave = etapaQ === 1 ? String(q.departamentoId) : `${q.departamentoId}:${etapaQ}`;
      if (!questionariosPorDeptObj[chave]) questionariosPorDeptObj[chave] = [];
      questionariosPorDeptObj[chave].push(q);
    }

    // Adicionar ao processo
    (processo as any).questionariosPorDepartamento = questionariosPorDeptObj;

    // ========== MERGE QUESTIONÁRIOS DE PROCESSOS INTERLIGADOS ==========
    // Percorrer TODA a cadeia de interligações usando AMBAS as fontes:
    // 1. Campo interligadoComId (cadeia pai)
    // 2. Tabela InterligacaoProcesso (relações origem/destino)
    try {
      const processosInterligadosIds: number[] = [];
      const processosInterligadosInfo: Record<number, { nomeServico: string; nomeEmpresa: string }> = {};
      const visitados = new Set<number>([processo.id]);

      // Percorrer toda a cadeia de ancestrais via interligadoComId (pai, avô, bisavô...)
      const ancestraisIds: number[] = [];
      let ancestralId: number | null = processo.interligadoComId;
      while (ancestralId && !visitados.has(ancestralId)) {
        visitados.add(ancestralId);
        ancestraisIds.push(ancestralId);
        const ancestral = await prisma.processo.findUnique({
          where: { id: ancestralId },
          select: { id: true, nomeServico: true, nomeEmpresa: true, interligadoComId: true, interligadoNome: true },
        });
        if (!ancestral) break;
        processosInterligadosInfo[ancestral.id] = {
          nomeServico: ancestral.nomeServico || ancestral.interligadoNome || `#${ancestral.id}`,
          nomeEmpresa: ancestral.nomeEmpresa || '',
        };
        ancestralId = ancestral.interligadoComId;
      }
      // Inverter: mais antigo primeiro (bisavô, avô, pai)
      ancestraisIds.reverse();
      processosInterligadosIds.push(...ancestraisIds);

      // Percorrer todos os descendentes via interligadoComId (filhos, netos...) via BFS
      const fila: number[] = [processo.id];
      while (fila.length > 0) {
        const parentId = fila.shift()!;
        const filhos = await prisma.processo.findMany({
          where: { interligadoComId: parentId },
          select: { id: true, nomeServico: true, nomeEmpresa: true },
        });
        for (const f of filhos) {
          if (visitados.has(f.id)) continue;
          visitados.add(f.id);
          processosInterligadosIds.push(f.id);
          processosInterligadosInfo[f.id] = {
            nomeServico: f.nomeServico || `#${f.id}`,
            nomeEmpresa: f.nomeEmpresa || '',
          };
          fila.push(f.id);
        }
      }

      // Percorrer TODA a cadeia via tabela InterligacaoProcesso (BFS)
      // Isso cobre processos antigos que não têm interligadoComId preenchido
      try {
        const filaInterligacao = [processo.id, ...processosInterligadosIds];
        const jaConsultados = new Set<number>();
        while (filaInterligacao.length > 0) {
          const currentId = filaInterligacao.shift()!;
          if (jaConsultados.has(currentId)) continue;
          jaConsultados.add(currentId);

          const interligacoes = await (prisma as any).interligacaoProcesso.findMany({
            where: {
              OR: [
                { processoOrigemId: currentId },
                { processoDestinoId: currentId },
              ],
            },
          });
          for (const inter of interligacoes) {
            const outroId = inter.processoOrigemId === currentId ? inter.processoDestinoId : inter.processoOrigemId;
            if (!visitados.has(outroId)) {
              visitados.add(outroId);
              processosInterligadosIds.push(outroId);
              filaInterligacao.push(outroId);
            }
          }
        }
      } catch { /* tabela pode não existir */ }

      if (processosInterligadosIds.length > 0) {
        // Buscar info dos que faltam
        const idsSemInfo = processosInterligadosIds.filter(id => !processosInterligadosInfo[id]);
        if (idsSemInfo.length > 0) {
          const extras = await prisma.processo.findMany({
            where: { id: { in: idsSemInfo } },
            select: { id: true, nomeServico: true, nomeEmpresa: true },
          });
          for (const e of extras) {
            processosInterligadosInfo[e.id] = {
              nomeServico: e.nomeServico || `#${e.id}`,
              nomeEmpresa: e.nomeEmpresa || '',
            };
          }
        }

        // Buscar questionários com respostas dos processos interligados
        const questionariosInterligados = await prisma.questionarioDepartamento.findMany({
          where: {
            processoId: { in: processosInterligadosIds },
            ...(visibleDepartmentIds ? { departamentoId: { in: visibleDepartmentIds } } : {}),
          },
          include: {
            respostas: {
              include: { respondidoPor: { select: { id: true, nome: true } } },
            },
          },
          orderBy: { ordem: 'asc' },
        });

        // Agrupar por processoId -> departamentoId
        const respostasInterligadas: Record<number, any> = {};
        for (const q of questionariosInterligados) {
          const pId = q.processoId as number | null;
          if (pId == null) continue;
          if (!respostasInterligadas[pId]) {
            const info = processosInterligadosInfo[pId] || { nomeServico: `#${pId}`, nomeEmpresa: '' };
            respostasInterligadas[pId] = {
              processoId: pId,
              processoNome: info.nomeServico,
              processoEmpresa: info.nomeEmpresa,
              departamentos: {} as Record<number, any>,
            };
          }
          const deptId = q.departamentoId;
          if (!respostasInterligadas[pId].departamentos[deptId]) {
            respostasInterligadas[pId].departamentos[deptId] = {
              questionario: [] as any[],
              respostas: {} as Record<string, any>,
            };
          }
          respostasInterligadas[pId].departamentos[deptId].questionario.push({
            id: q.id,
            label: q.label,
            tipo: q.tipo,
            obrigatorio: q.obrigatorio,
            opcoes: q.opcoes,
            ordem: q.ordem,
          });

          // Mapear respostas
          if (q.respostas && q.respostas.length > 0) {
            const sorted = [...q.respostas].sort((a, b) =>
              new Date(b.respondidoEm).getTime() - new Date(a.respondidoEm).getTime()
            );
            const latest = sorted[0];
            let valor: any = latest.resposta;
            if (typeof valor === 'string') {
              try { valor = JSON.parse(valor); } catch { /* keep string */ }
            }
            respostasInterligadas[pId].departamentos[deptId].respostas[String(q.id)] = valor;
            if (!respostasInterligadas[pId].departamentos[deptId].respondidoEm ||
              new Date(latest.respondidoEm).getTime() > new Date(respostasInterligadas[pId].departamentos[deptId].respondidoEm).getTime()) {
              respostasInterligadas[pId].departamentos[deptId].respondidoEm = latest.respondidoEm;
              respostasInterligadas[pId].departamentos[deptId].respondidoPor = latest.respondidoPor?.nome ?? undefined;
            }
          }
        }

        // Buscar documentos dos processos interligados para exibir arquivos anexados
        const documentosInterligados = await prisma.documento.findMany({
          where: { processoId: { in: processosInterligadosIds } },
          select: {
            id: true,
            processoId: true,
            nome: true,
            tipo: true,
            tipoCategoria: true,
            url: true,
            perguntaId: true,
            departamentoId: true,
            dataUpload: true,
            visibility: true,
            allowedRoles: true,
            allowedUserIds: true,
            allowedDepartamentos: true,
            uploadPorId: true,
          },
        });

        // Agrupar documentos por processoId
        for (const doc of documentosInterligados) {
          if (!canViewDocumento(doc)) continue;
          const pId = doc.processoId;
          if (!respostasInterligadas[pId]) continue;
          if (!respostasInterligadas[pId].documentos) {
            respostasInterligadas[pId].documentos = [];
          }
          respostasInterligadas[pId].documentos.push({
            id: doc.id,
            processoId: doc.processoId,
            nome: doc.nome,
            tipo: doc.tipo,
            tipoCategoria: doc.tipoCategoria,
            url: doc.url,
            perguntaId: doc.perguntaId,
            departamentoId: doc.departamentoId,
            dataUpload: doc.dataUpload,
          });
        }

        // Ordenar por ID do processo (mais antigo = menor ID primeiro) para exibir cronologicamente
        const interligadasOrdenadas = processosInterligadosIds
          .filter(id => respostasInterligadas[id])
          .map(id => respostasInterligadas[id]);
        (processo as any).respostasInterligadas = interligadasOrdenadas;
      }
    } catch (e) {
      console.error('Erro ao buscar questionários interligados:', e);
      (processo as any).respostasInterligadas = [];
    }

    // Anexa projetoId / interligacaoGrupos / dependenciasDept via raw SQL — compatível com Prisma client antigo
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{
        projetoId: number | null;
        interligacaoGrupos: any;
        dependenciasDept: any;
      }>>(
        `SELECT "projetoId", "interligacaoGrupos", "dependenciasDept" FROM "Processo" WHERE id = ${Number(processoId)}`
      );
      if (rows && rows.length > 0) {
        (processo as any).projetoId = rows[0].projetoId ?? null;
        (processo as any).interligacaoGrupos = Array.isArray(rows[0].interligacaoGrupos)
          ? rows[0].interligacaoGrupos
          : [];
        (processo as any).dependenciasDept = rows[0].dependenciasDept && typeof rows[0].dependenciasDept === 'object' && !Array.isArray(rows[0].dependenciasDept)
          ? rows[0].dependenciasDept
          : {};
      }
    } catch {
      // coluna ainda não aplicada — ignora
    }

    return jsonBigInt(processo);
  } catch (error) {
    console.error('Erro ao buscar processo:', error);
    return jsonBigInt({ error: 'Erro ao buscar processo' }, { status: 500 });
  }
}

// PUT /api/processos/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    await ensureProcessInterligacaoSchema();

    const processoId = parseInt(params.id);
    const roleUpper = String((user as any).role || '').toUpperCase();
    const data = await request.json();
    const access = await assertProcessAccess(user, processoId, 'update');
    if (access.error) return access.error;

    // Buscar processo atual para comparar mudanças
    const processoAntigo = await prisma.processo.findUnique({
      where: { id: processoId },
    });

    if (!processoAntigo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 });
    }

    // Usuário normal: permitir apenas alteração de prioridade em um dos seus departamentos
    if (roleUpper === 'USUARIO') {
      const { getUserDepartmentIds } = await import('@/app/utils/processAccess');
      const deptosUsuario = getUserDepartmentIds(user);
      if (deptosUsuario.length === 0) {
        return NextResponse.json({ error: 'Usuário sem departamento definido' }, { status: 403 });
      }
      if (!deptosUsuario.includes(Number(processoAntigo.departamentoAtual))) {
        return NextResponse.json({ error: 'Sem permissão para editar processo de outro departamento' }, { status: 403 });
      }

      // Permite somente alteração de prioridade por usuário normal
      const allowedKeys = ['prioridade'];
      const sentKeys = Object.keys(data ?? {});
      if (sentKeys.some((k) => !allowedKeys.includes(k))) {
        return NextResponse.json({ error: 'Alteração não permitida para seu nível de acesso' }, { status: 403 });
      }
    }

    // Gerente/admin seguem validações abaixo
    if (roleUpper === 'GERENTE' || roleUpper === 'ADMIN' || roleUpper === 'ADMIN_DEPARTAMENTO') {
      // gerente validations continue below
    } else if (roleUpper !== 'GERENTE' && roleUpper !== 'ADMIN' && roleUpper !== 'ADMIN_DEPARTAMENTO' && roleUpper !== 'USUARIO') {
      // any other role not handled above is forbidden
      return NextResponse.json({ error: 'Sem permissão para editar processo' }, { status: 403 });
    }

    const statusNovo = typeof data?.status === 'string' ? data.status.toUpperCase() : undefined;

    if (roleUpper === 'GERENTE') {
      const { getUserDepartmentIds } = await import('@/app/utils/processAccess');
      const deptosUsuario = getUserDepartmentIds(user);
      if (deptosUsuario.length === 0) {
        return NextResponse.json({ error: 'Usuário sem departamento definido' }, { status: 403 });
      }
      if (!deptosUsuario.includes(Number(processoAntigo.departamentoAtual))) {
        return NextResponse.json({ error: 'Sem permissão para editar processo de outro departamento' }, { status: 403 });
      }

      // gerente não pode "mover" via PUT (use /avancar)
      if (data?.departamentoAtual !== undefined && data.departamentoAtual !== processoAntigo.departamentoAtual) {
        return NextResponse.json({ error: 'Movimentação de departamento não permitida por esta ação' }, { status: 403 });
      }
      if (data?.departamentoAtualIndex !== undefined && data.departamentoAtualIndex !== processoAntigo.departamentoAtualIndex) {
        return NextResponse.json({ error: 'Movimentação de departamento não permitida por esta ação' }, { status: 403 });
      }
      if (data?.fluxoDepartamentos !== undefined) {
        return NextResponse.json({ error: 'Alteração do fluxo não permitida' }, { status: 403 });
      }

      // gerente só finaliza no último departamento
      if (statusNovo === 'FINALIZADO' || statusNovo === 'FINALIZACAO') {
        const idx = Number(processoAntigo.departamentoAtualIndex ?? 0);
        const len = Array.isArray(processoAntigo.fluxoDepartamentos) ? processoAntigo.fluxoDepartamentos.length : 0;
        const isUltimo = len > 0 ? idx >= len - 1 : true;
        if (!isUltimo) {
          return NextResponse.json({ error: 'Só é possível finalizar no último departamento' }, { status: 403 });
        }
      }
    }
    
    const novoInicio = parseDateMaybe(data?.dataInicio);
    const interligacaoTemplateIdsAtualizados =
      data?.interligacaoTemplateIds !== undefined
        ? normalizeInterligacaoTemplateIds(data.interligacaoTemplateIds)
        : undefined;

    const dataEntregaFoiEnviada = Object.prototype.hasOwnProperty.call(data ?? {}, 'dataEntrega');
    const entregaParsed = parseDateMaybe(data?.dataEntrega);
    const entregaVaziaOuNula = dataEntregaFoiEnviada && (data?.dataEntrega === null || data?.dataEntrega === '');

    const inicioBaseParaPrazo =
      novoInicio ?? processoAntigo.dataInicio ?? processoAntigo.criadoEm ?? new Date();

    const entregaCalculada = entregaVaziaOuNula ? addDays(inicioBaseParaPrazo, 15) : undefined;
    const oldStatus = String(processoAntigo.status || '').toUpperCase();
    const isFinalizando =
      !!statusNovo &&
      statusNovo !== oldStatus &&
      (statusNovo === 'FINALIZADO' || statusNovo === 'FINALIZACAO');

    if (isFinalizando) {
      const validacaoFinalizacao = await validarProcessoParaFinalizacao(processoId);

      if (!validacaoFinalizacao.encontrado) {
        return NextResponse.json(
          { error: validacaoFinalizacao.detalhes[0] || 'Processo nÃ£o encontrado' },
          { status: validacaoFinalizacao.status }
        );
      }

      if (!validacaoFinalizacao.valido) {
        return NextResponse.json(
          {
            error: 'Requisitos obrigatÃ³rios nÃ£o preenchidos',
            detalhes: validacaoFinalizacao.detalhes,
            validacao: validacaoFinalizacao.erros,
          },
          { status: 400 }
        );
      }
    }

    const processo = await prisma.processo.update({
      where: { id: processoId },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.nomeServico !== undefined && { nomeServico: data.nomeServico }),
        ...(data.nomeEmpresa !== undefined && { nomeEmpresa: data.nomeEmpresa }),
        ...(data.responsavelId !== undefined && { responsavelId: data.responsavelId }),
        ...(data.cliente !== undefined && { cliente: data.cliente }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.telefone !== undefined && { telefone: data.telefone }),
        ...(data.empresaId !== undefined && { empresaId: data.empresaId }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.prioridade !== undefined && { prioridade: data.prioridade }),
        ...(data.departamentoAtual !== undefined && { departamentoAtual: data.departamentoAtual }),
        ...(data.departamentoAtualIndex !== undefined && { departamentoAtualIndex: data.departamentoAtualIndex }),
        ...(data.fluxoDepartamentos !== undefined && { fluxoDepartamentos: data.fluxoDepartamentos }),
        ...(data.descricao !== undefined && { descricao: data.descricao }),
        ...(data.notasCriador !== undefined && { notasCriador: data.notasCriador }),
        ...(data.progresso !== undefined && { progresso: data.progresso }),
        ...(novoInicio !== undefined && { dataInicio: novoInicio }),
        ...(dataEntregaFoiEnviada && entregaParsed !== undefined && { dataEntrega: entregaParsed }),
        ...(entregaCalculada !== undefined && { dataEntrega: entregaCalculada }),
        ...(data.processoOrigemId !== undefined && { processoOrigemId: data.processoOrigemId }),
        ...(data.interligadoComId !== undefined && { interligadoComId: data.interligadoComId }),
        ...(data.interligadoNome !== undefined && { interligadoNome: data.interligadoNome }),
        ...(data.interligadoParalelo !== undefined && { interligadoParalelo: Boolean(data.interligadoParalelo) }),
        ...(interligacaoTemplateIdsAtualizados !== undefined && { interligacaoTemplateIds: interligacaoTemplateIdsAtualizados }),
        ...(data.deptIndependente !== undefined && { deptIndependente: Boolean(data.deptIndependente) }),
        dataAtualizacao: new Date(),
      },
      include: {
        empresa: true,
        tags: { include: { tag: true } },
        ...({ responsavel: { select: { id: true, nome: true, email: true } } } as any),
        criadoPor: {
          select: { id: true, nome: true, email: true },
        },
      },
    });
    
    // Logging campo-a-campo detalhado (LogAuditoria)
    if (processoAntigo) {
      const camposAntes: Record<string, any> = {
        nome: processoAntigo.nome,
        nomeServico: processoAntigo.nomeServico,
        nomeEmpresa: processoAntigo.nomeEmpresa,
        cliente: processoAntigo.cliente,
        email: processoAntigo.email,
        telefone: processoAntigo.telefone,
        status: processoAntigo.status,
        prioridade: processoAntigo.prioridade,
        descricao: processoAntigo.descricao,
        notasCriador: processoAntigo.notasCriador,
        responsavelId: processoAntigo.responsavelId,
        empresaId: processoAntigo.empresaId,
        departamentoAtual: processoAntigo.departamentoAtual,
        departamentoAtualIndex: processoAntigo.departamentoAtualIndex,
        progresso: processoAntigo.progresso,
        processoOrigemId: (processoAntigo as any).processoOrigemId,
        interligadoComId: processoAntigo.interligadoComId,
        interligadoNome: processoAntigo.interligadoNome,
        interligadoParalelo: (processoAntigo as any).interligadoParalelo,
        interligacaoTemplateIds: (processoAntigo as any).interligacaoTemplateIds,
        deptIndependente: (processoAntigo as any).deptIndependente,
      };
      const camposDepois: Record<string, any> = {
        nome: processo.nome,
        nomeServico: processo.nomeServico,
        nomeEmpresa: processo.nomeEmpresa,
        cliente: processo.cliente,
        email: processo.email,
        telefone: processo.telefone,
        status: processo.status,
        prioridade: processo.prioridade,
        descricao: processo.descricao,
        notasCriador: processo.notasCriador,
        responsavelId: processo.responsavelId,
        empresaId: processo.empresaId,
        departamentoAtual: processo.departamentoAtual,
        departamentoAtualIndex: processo.departamentoAtualIndex,
        progresso: processo.progresso,
        processoOrigemId: (processo as any).processoOrigemId,
        interligadoComId: processo.interligadoComId,
        interligadoNome: processo.interligadoNome,
        interligadoParalelo: (processo as any).interligadoParalelo,
        interligacaoTemplateIds: (processo as any).interligacaoTemplateIds,
        deptIndependente: (processo as any).deptIndependente,
      };
      const mudancasDetalhadas = detectarMudancas(camposAntes, camposDepois);
      const ip = getIp(request);

      await registrarLogsCampos({
        usuarioId: user.id,
        acao: 'EDITAR',
        entidade: 'PROCESSO',
        entidadeId: processo.id,
        entidadeNome: processo.nomeServico || processo.nomeEmpresa || `#${processo.id}`,
        processoId: processo.id,
        empresaId: processo.empresaId,
        ip,
        campos: mudancasDetalhadas.map((mudanca) => ({
          campo: mudanca.campo,
          valorAnterior: mudanca.valorAnterior,
          valorNovo: mudanca.valorNovo,
        })),
      });

      // Criar evento de alteração (HistoricoEvento - resumo)
      const mudancasResumo: string[] = [];
      if (processoAntigo.status !== processo.status) {
        mudancasResumo.push(`Status: ${processoAntigo.status} → ${processo.status}`);
      }
      if (processoAntigo.prioridade !== processo.prioridade) {
        mudancasResumo.push(`Prioridade: ${processoAntigo.prioridade} → ${processo.prioridade}`);
      }
      if (processoAntigo.departamentoAtual !== processo.departamentoAtual) {
        mudancasResumo.push(`Departamento alterado`);
      }
      if (mudancasDetalhadas.length > 0 && mudancasResumo.length === 0) {
        mudancasResumo.push(`${mudancasDetalhadas.length} campo(s) alterado(s): ${mudancasDetalhadas.map(m => m.campo).join(', ')}`);
      }

      if (mudancasResumo.length > 0) {
        try {
          await prisma.historicoEvento.create({
            data: {
              processoId: processo.id,
              tipo: 'ALTERACAO',
              acao: mudancasResumo.join(', '),
              responsavelId: user.id,
              dataTimestamp: BigInt(Date.now()),
            },
          });
        } catch (e) {
          console.warn('Falha ao criar histórico de alteração:', e);
        }
      }

      const newStatus = String(processo.status || '').toUpperCase();
      if (oldStatus !== newStatus && (newStatus === 'FINALIZADO' || newStatus === 'FINALIZACAO')) {
        try {
          await prisma.historicoEvento.create({
            data: {
              processoId: processo.id,
              tipo: 'FINALIZACAO',
              acao: 'Processo finalizado',
              responsavelId: user.id,
              departamento: 'Sistema',
              dataTimestamp: BigInt(Date.now()),
            },
          });
        } catch (e) {
          console.warn('Falha ao criar histórico de finalização:', e);
        }

        // Notificação persistida para o criador
        try {
          if (processoAntigo.criadoPorId) {
            const nomeEmpresa = processo.nomeEmpresa || 'Empresa';
            const nomeServico = processo.nomeServico ? ` - ${processo.nomeServico}` : '';
            await prisma.notificacao.create({
              data: {
                usuarioId: processoAntigo.criadoPorId,
                mensagem: `Seu processo foi finalizado: ${nomeEmpresa}${nomeServico}`,
                tipo: 'SUCESSO',
                processoId: processo.id,
                link: `/`,
              },
            });
          }
        } catch (e) {
          console.error('Erro ao criar notificação de finalização:', e);
        }
      }
    }
    
    return NextResponse.json(processo);
  } catch (error) {
    console.error('Erro ao atualizar processo:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar processo' },
      { status: 500 }
    );
  }
}

// DELETE /api/processos/:id - Move para lixeira ao invés de excluir permanentemente
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    await ensureProcessInterligacaoSchema();

    const roleUpper = String((user as any).role || '').toUpperCase();
    const processoId = parseInt(params.id);
    const userId = Number(user.id);
    const access = await assertProcessAccess(user, processoId, 'delete');
    if (access.error) return access.error;

    if (roleUpper === 'USUARIO') {
      return NextResponse.json({ error: 'Sem permissão para excluir' }, { status: 403 });
    }

    // Ler motivo de exclusão do body (se enviado)
    let motivoExclusao: string | null = null;
    let motivoExclusaoCustom: string | null = null;
    try {
      const body = await request.json();
      motivoExclusao = body?.motivoExclusao || null;
      motivoExclusaoCustom = body?.motivoExclusaoCustom || null;
    } catch {
      // body vazio, sem motivo
    }

    // Buscar processo completo para salvar na lixeira (incluindo TODOS os dados relacionados)
    const processo = await prisma.processo.findUnique({ 
      where: { id: processoId },
      include: {
        empresa: true,
        tags: { include: { tag: true } },
        respostasQuestionario: true,
        questionarios: true, // Questionários vinculados ao processo
        comentarios: true,
        documentos: true,
        historicoEventos: true,
        historicoFluxos: true,
      },
    });
    
    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 });
    }

    if (roleUpper === 'GERENTE') {
      const { getUserDepartmentIds } = await import('@/app/utils/processAccess');
      const deptosUsuario = getUserDepartmentIds(user);
      if (deptosUsuario.length === 0) {
        return NextResponse.json({ error: 'Usuário sem departamento definido' }, { status: 403 });
      }
      if (!deptosUsuario.includes(Number(processo.departamentoAtual))) {
        return NextResponse.json({ error: 'Sem permissão para excluir processo de outro departamento' }, { status: 403 });
      }
    } else if (!requireRole(user, ['ADMIN', 'ADMIN_DEPARTAMENTO'])) {
      return NextResponse.json({ error: 'Sem permissão para excluir' }, { status: 403 });
    }

    // Calcular data de expiração (15 dias)
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + DIAS_EXPIRACAO_LIXEIRA);

    // Mover para lixeira (serializa dados e não bloqueia em caso de falha)
    try {
      const dadosOriginais = JSON.parse(JSON.stringify({
        id: processo.id,
        nome: processo.nome,
        nomeServico: processo.nomeServico,
        nomeEmpresa: processo.nomeEmpresa,
        cliente: processo.cliente,
        email: processo.email,
        telefone: processo.telefone,
        empresaId: processo.empresaId,
        status: processo.status,
        prioridade: processo.prioridade,
        departamentoAtual: processo.departamentoAtual,
        departamentoAtualIndex: processo.departamentoAtualIndex,
        fluxoDepartamentos: processo.fluxoDepartamentos,
        descricao: processo.descricao,
        notasCriador: processo.notasCriador,
        criadoPorId: processo.criadoPorId,
        responsavelId: processo.responsavelId,
        criadoEm: processo.criadoEm,
        dataCriacao: processo.dataCriacao,
        dataInicio: processo.dataInicio,
        dataEntrega: processo.dataEntrega,
        progresso: processo.progresso,
        tags: processo.tags?.map(t => ({ tagId: t.tagId, tagNome: t.tag?.nome })),
        questionarios: (processo as any).questionarios?.map((q: any) => ({
          id: q.id,
          departamentoId: q.departamentoId,
          label: q.label,
          tipo: q.tipo,
          obrigatorio: q.obrigatorio,
          ordem: q.ordem,
          opcoes: q.opcoes,
          placeholder: q.placeholder,
          descricao: q.descricao,
          condicaoPerguntaId: q.condicaoPerguntaId,
          condicaoOperador: q.condicaoOperador,
          condicaoValor: q.condicaoValor,
        })),
        respostasQuestionario: processo.respostasQuestionario?.map(r => ({
          questionarioId: r.questionarioId,
          resposta: r.resposta,
          respondidoPorId: r.respondidoPorId,
          respondidoEm: r.respondidoEm,
        })),
        comentarios: processo.comentarios?.map(c => ({
          texto: c.texto || '',
          autorId: c.autorId,
          departamentoId: c.departamentoId,
          criadoEm: c.criadoEm,
          mencoes: c.mencoes,
        })),
        historicoEventos: processo.historicoEventos?.map(h => ({
          tipo: h.tipo,
          acao: h.acao,
          responsavelId: h.responsavelId,
          departamento: h.departamento,
          data: h.data,
          dataTimestamp: h.dataTimestamp?.toString(),
        })),
        historicoFluxos: processo.historicoFluxos?.map(f => ({
          departamentoOrigemId: (f as any).departamentoOrigemId,
          departamentoDestinoId: (f as any).departamentoDestinoId,
          movidoPorId: (f as any).movidoPorId,
          movidoEm: (f as any).movidoEm,
          observacao: (f as any).observacao,
        })),
        documentos: processo.documentos?.map(d => ({
          nome: d.nome,
          tipo: d.tipo,
          tipoCategoria: d.tipoCategoria,
          tamanho: d.tamanho?.toString(),
          url: d.url,
          path: d.path,
          departamentoId: d.departamentoId,
          perguntaId: d.perguntaId,
          dataUpload: d.dataUpload,
          uploadPorId: d.uploadPorId,
          visibility: d.visibility,
          allowedRoles: d.allowedRoles,
          allowedUserIds: d.allowedUserIds,
        })),
      }));

      await prisma.itemLixeira.create({
        data: {
          tipoItem: 'PROCESSO',
          itemIdOriginal: processo.id,
          dadosOriginais,
          empresaId: processo.empresaId,
          departamentoId: processo.departamentoAtual,
          visibility: 'PUBLIC',
          deletadoPorId: userId,
          expiraEm: dataExpiracao,
          nomeItem: processo.nomeEmpresa || processo.nome || `Processo #${processo.id}`,
          descricaoItem: processo.nomeServico || processo.descricao || null,
          ...(motivoExclusao ? { motivoExclusao } : {}),
          ...(motivoExclusaoCustom ? { motivoExclusaoCustom } : {}),
        },
      });
    } catch (e) {
      console.error('Erro ao criar ItemLixeira for processo:', e);
      // não bloquear exclusão do processo
    }

    // Agora excluir do banco (cascade vai excluir comentários, documentos relacionados, etc.)
    await prisma.processo.delete({ where: { id: processoId } });
    
    return NextResponse.json({ 
      message: 'Processo movido para lixeira',
      diasParaExpiracao: DIAS_EXPIRACAO_LIXEIRA,
    });
  } catch (error) {
    console.error('Erro ao excluir processo:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir processo' },
      { status: 500 }
    );
  }
}




