import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { assertProcessAccess } from '@/app/utils/processAccess';
import { coletarProcessosInterligados } from '@/app/utils/processChain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

type AgregadoItem = {
  departamentoId: number;
  departamentoNome: string;
  total: number;
  concluidos: number;
  progresso: number; // 0-100
  detalhes: Array<{
    processoId: number;
    processoNome: string;
    concluido: boolean;
    concluidoEm: string | null;
    atual: boolean;
  }>;
};

// GET /api/processos/[id]/checklist-agregado
// Retorna o progresso por departamento considerando TODAS as solicitações interligadas
// (ancestrais, descendentes e interligações laterais) à solicitação indicada.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const processoId = parseInt(params.id);
    if (!Number.isFinite(processoId) || processoId <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const access = await assertProcessAccess(user, processoId, 'read');
    if (access.error) return access.error;

    // Coleta todos os IDs de processos interligados (grafo completo)
    const { ids: processoIds, processos: mapaProcessos } = await coletarProcessosInterligados(processoId);

    if (processoIds.length === 0) {
      return NextResponse.json({ processos: [], agregado: [] });
    }

    // Busca dados completos (fluxo + dept atual) de todos os processos
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

    // Busca os checklists de todos de uma vez
    let checklists: Array<{
      processoId: number;
      departamentoId: number;
      concluido: boolean;
      concluidoEm: Date | null;
    }> = [];
    try {
      checklists = await (prisma as any).checklistDepartamento.findMany({
        where: { processoId: { in: processoIds } },
        select: {
          processoId: true,
          departamentoId: true,
          concluido: true,
          concluidoEm: true,
        },
      });
    } catch {
      checklists = [];
    }

    // Busca nomes dos departamentos envolvidos
    const deptIdsEnvolvidos = new Set<number>();
    for (const p of processos) {
      for (const d of (p.fluxoDepartamentos || [])) {
        const n = Number(d);
        if (Number.isFinite(n) && n > 0) deptIdsEnvolvidos.add(n);
      }
    }
    const deptsMap = new Map<number, { id: number; nome: string }>();
    if (deptIdsEnvolvidos.size > 0) {
      const depts = await prisma.departamento.findMany({
        where: { id: { in: Array.from(deptIdsEnvolvidos) } },
        select: { id: true, nome: true },
      });
      depts.forEach((d) => deptsMap.set(d.id, { id: d.id, nome: d.nome }));
    }

    // Agrega por departamento
    const agregadoMap = new Map<number, AgregadoItem>();

    for (const p of processos) {
      const fluxo = (p.fluxoDepartamentos || [])
        .map((x: any) => Number(x))
        .filter((x: any) => Number.isFinite(x) && x > 0);

      const nomeProcesso = p.nomeServico || p.nomeEmpresa || `#${p.id}`;
      const idxAtual = Number(p.departamentoAtualIndex ?? 0);
      const finalizado = String(p.status || '').toLowerCase() === 'finalizado';
      const paralelo = Boolean((p as any).deptIndependente);

      // Itera por posição no fluxo (suporta mesmo dept aparecendo várias vezes)
      fluxo.forEach((deptId, idxNoFluxo) => {
        if (!agregadoMap.has(deptId)) {
          const dept = deptsMap.get(deptId);
          agregadoMap.set(deptId, {
            departamentoId: deptId,
            departamentoNome: dept?.nome || `Dept #${deptId}`,
            total: 0,
            concluidos: 0,
            progresso: 0,
            detalhes: [],
          });
        }
        const agg = agregadoMap.get(deptId)!;
        const checklistEntry = checklists.find(
          (c) => c.processoId === p.id && c.departamentoId === deptId
        );
        // "Concluído" se:
        //   (a) há entrada explícita no ChecklistDepartamento com concluido=true; OU
        //   (b) o processo está FINALIZADO (todas as etapas valem como concluídas); OU
        //   (c) o processo já PASSOU desta etapa (idxAtual > idxNoFluxo), salvo quando é processo paralelo
        //       — em paralelo só conta quando há check explícito.
        let isConcluido = Boolean(checklistEntry?.concluido);
        if (!isConcluido) {
          if (finalizado) {
            isConcluido = true;
          } else if (!paralelo && idxAtual > idxNoFluxo) {
            // Modo sequencial: se já passou desta posição no fluxo, considera
            // concluída implicitamente. Em paralelo, só conta com check explícito.
            isConcluido = true;
          }
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
          concluidoEm: checklistEntry?.concluidoEm ? new Date(checklistEntry.concluidoEm).toISOString() : null,
          atual: ehEtapaAtual,
        });
      });
    }

    const agregado = Array.from(agregadoMap.values())
      .map((item) => ({
        ...item,
        progresso: item.total > 0 ? Math.round((item.concluidos / item.total) * 100) : 0,
      }))
      .sort((a, b) => a.departamentoNome.localeCompare(b.departamentoNome, 'pt-BR'));

    const listaProcessos = processoIds.map((id) => {
      const p = mapaProcessos.get(id);
      return { id, nome: p?.nomeServico || p?.nomeEmpresa || `#${id}` };
    });

    return NextResponse.json({ processos: listaProcessos, agregado });
  } catch (error) {
    console.error('Erro ao calcular checklist agregado:', error);
    return NextResponse.json({ error: 'Erro ao calcular progresso agregado' }, { status: 500 });
  }
}
