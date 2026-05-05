import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

type AgregadoItem = {
  departamentoId: number;
  departamentoNome: string;
  total: number;
  concluidos: number;
  progresso: number;
  detalhes: Array<{
    processoId: number;
    processoNome: string;
    concluido: boolean;
    concluidoEm: string | null;
    atual: boolean;
  }>;
};

// GET /api/projetos/[id]/checklist-agregado
// Agrega o progresso por departamento considerando TODAS as solicitações
// vinculadas ao projeto (projetoId = id).
// Diferentemente do checklist-agregado de processo (que segue interligações),
// aqui o escopo é o conjunto explícito de solicitações do projeto.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const projetoId = Number(params.id);
    if (!Number.isFinite(projetoId) || projetoId <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Busca IDs dos processos do projeto + observações por departamento
    const procRows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM "Processo" WHERE "projetoId" = ${projetoId}`
    );
    const processoIds = (procRows || []).map((r) => Number(r.id)).filter((n) => Number.isFinite(n));

    const projRows = await prisma.$queryRawUnsafe<Array<{ observacoesDepartamentos: any }>>(
      `SELECT "observacoesDepartamentos" FROM "Projeto" WHERE id = ${projetoId}`
    );
    const observacoesMap: Record<string, string> =
      projRows?.[0]?.observacoesDepartamentos && typeof projRows[0].observacoesDepartamentos === 'object'
        ? projRows[0].observacoesDepartamentos
        : {};

    if (processoIds.length === 0) {
      return NextResponse.json({ processos: [], agregado: [], observacoesDepartamentos: observacoesMap });
    }

    const processos = await prisma.processo.findMany({
      where: { id: { in: processoIds } },
      select: {
        id: true,
        nomeServico: true,
        nomeEmpresa: true,
        fluxoDepartamentos: true,
        departamentoAtual: true,
        departamentoAtualIndex: true,
        status: true,
        deptIndependente: true,
      },
    });

    // Checklists em batch
    let checklists: Array<{
      processoId: number;
      departamentoId: number;
      concluido: boolean;
      concluidoEm: Date | null;
    }> = [];
    try {
      checklists = await (prisma as any).checklistDepartamento.findMany({
        where: { processoId: { in: processoIds } },
        select: { processoId: true, departamentoId: true, concluido: true, concluidoEm: true },
      });
    } catch {
      checklists = [];
    }

    // Mapa de nomes de departamentos
    const deptIds = new Set<number>();
    for (const p of processos) {
      for (const d of (p.fluxoDepartamentos || [])) {
        const n = Number(d);
        if (Number.isFinite(n) && n > 0) deptIds.add(n);
      }
    }
    const deptsMap = new Map<number, { id: number; nome: string }>();
    if (deptIds.size > 0) {
      const depts = await prisma.departamento.findMany({
        where: { id: { in: Array.from(deptIds) } },
        select: { id: true, nome: true },
      });
      depts.forEach((d) => deptsMap.set(d.id, { id: d.id, nome: d.nome }));
    }

    // Agregação
    const agregadoMap = new Map<number, AgregadoItem>();
    for (const p of processos) {
      const fluxo = (p.fluxoDepartamentos || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
      const nomeProcesso = p.nomeServico || p.nomeEmpresa || `#${p.id}`;
      const idxAtual = Number((p as any).departamentoAtualIndex ?? 0);
      const finalizado = String(p.status || '').toLowerCase() === 'finalizado';
      const paralelo = Boolean((p as any).deptIndependente);

      fluxo.forEach((deptId, idxNoFluxo) => {
        if (!agregadoMap.has(deptId)) {
          const d = deptsMap.get(deptId);
          agregadoMap.set(deptId, {
            departamentoId: deptId,
            departamentoNome: d?.nome || `Dept #${deptId}`,
            total: 0,
            concluidos: 0,
            progresso: 0,
            detalhes: [],
          });
        }
        const agg = agregadoMap.get(deptId)!;
        const entry = checklists.find((c) => c.processoId === p.id && c.departamentoId === deptId);
        let isConcluido = Boolean(entry?.concluido);
        if (!isConcluido) {
          if (finalizado) isConcluido = true;
          // No modo paralelo, departamentoAtualIndex não indica que depts anteriores
          // foram concluídos — cada dept conclui independentemente. Só usamos o
          // atalho de índice no modo sequencial.
          else if (!paralelo && idxAtual > idxNoFluxo) isConcluido = true;
        }
        const ehEtapaAtual = !finalizado
          && !paralelo
          && Number(p.departamentoAtual) === deptId
          && idxAtual === idxNoFluxo;

        agg.total += 1;
        if (isConcluido) agg.concluidos += 1;
        agg.detalhes.push({
          processoId: p.id,
          processoNome: nomeProcesso,
          concluido: isConcluido,
          concluidoEm: entry?.concluidoEm ? new Date(entry.concluidoEm).toISOString() : null,
          atual: ehEtapaAtual,
        });
      });
    }

    const agregado = Array.from(agregadoMap.values())
      .map((item) => ({
        ...item,
        progresso: item.total > 0 ? Math.round((item.concluidos / item.total) * 100) : 0,
        observacao: observacoesMap[String(item.departamentoId)] || null,
      }))
      .sort((a, b) => a.departamentoNome.localeCompare(b.departamentoNome, 'pt-BR'));

    return NextResponse.json({
      processos: processos.map((p) => ({ id: p.id, nome: p.nomeServico || p.nomeEmpresa || `#${p.id}` })),
      agregado,
      observacoesDepartamentos: observacoesMap,
    });
  } catch (error) {
    console.error('Erro ao calcular checklist agregado do projeto:', error);
    return NextResponse.json({ error: 'Erro ao calcular progresso do projeto' }, { status: 500 });
  }
}
