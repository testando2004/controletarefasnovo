import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';
export const fetchCache = 'force-no-store';

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// GET /api/analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoParam = searchParams.get('periodo') || '30'; // dias
    const periodo = Number.parseInt(periodoParam, 10);
    const periodoDias = Number.isFinite(periodo) && periodo > 0 ? periodo : 30;
    
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - periodoDias);
    
    // Total de processos
    const totalProcessos = await prisma.processo.count();
    
    // Processos por status
    const processosPorStatus = await prisma.processo.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    
    // Processos por departamento
    const processosPorDepartamento = await prisma.processo.groupBy({
      by: ['departamentoAtual'],
      _count: { id: true },
    });
    
    // Processos criados no período
    const processosCriadosPeriodo = await prisma.processo.count({
      where: {
        dataCriacao: {
          gte: dataInicio,
        },
      },
    });
    
    // Processos finalizados no período
    const processosFinalizadosPeriodo = await prisma.processo.count({
      where: {
        status: 'FINALIZADO',
        dataFinalizacao: {
          gte: dataInicio,
        },
      },
    });

    // Processos criados no período e finalizados no período (taxa não passa de 100%)
    const processosFinalizadosCriadosPeriodo = await prisma.processo.count({
      where: {
        status: 'FINALIZADO',
        dataCriacao: {
          gte: dataInicio,
        },
        dataFinalizacao: {
          gte: dataInicio,
        },
      },
    });
    
    // Tempo médio por departamento
    const historicosFluxo = await prisma.historicoFluxo.findMany({
      where: {
        entradaEm: {
          gte: dataInicio,
        },
        saidaEm: {
          not: null,
        },
      },
      include: {
        departamento: true,
      },
    });
    
    const tempoPorDepartamento: Record<string, number[]> = {};
    historicosFluxo.forEach((hf) => {
      if (hf.saidaEm && hf.departamento) {
        const tempo = hf.saidaEm.getTime() - hf.entradaEm.getTime();
        const dias = tempo / (1000 * 60 * 60 * 24);
        
        if (!tempoPorDepartamento[hf.departamento.nome]) {
          tempoPorDepartamento[hf.departamento.nome] = [];
        }
        tempoPorDepartamento[hf.departamento.nome].push(dias);
      }
    });
    
    const tempoMedioPorDepartamento = Object.entries(tempoPorDepartamento).map(
      ([nome, tempos]) => ({
        departamento: nome,
        tempoMedioDias: tempos.reduce((a, b) => a + b, 0) / tempos.length,
        totalProcessos: tempos.length,
      })
    );

    const todosTempos = Object.values(tempoPorDepartamento).flat();
    const tempoMedioTotalDias =
      todosTempos.length > 0
        ? todosTempos.reduce((a, b) => a + b, 0) / todosTempos.length
        : 0;
    
    // Taxa de conclusão
    const taxaConclusao =
      processosCriadosPeriodo > 0
        ? (processosFinalizadosCriadosPeriodo / processosCriadosPeriodo) * 100
        : 0;

    // ========== ANALYTICS DE EXCLUSÕES ==========
    // Filtros específicos de exclusão
    const excPeriodo = searchParams.get('excPeriodo'); // dias
    const excDeptId = searchParams.get('excDeptId');
    const excUsuarioId = searchParams.get('excUsuarioId');
    const excMotivo = searchParams.get('excMotivo');

    const excWhere: any = { tipoItem: 'PROCESSO' };
    if (excPeriodo && Number(excPeriodo) > 0) {
      const excDataInicio = new Date();
      excDataInicio.setDate(excDataInicio.getDate() - Number(excPeriodo));
      excWhere.deletadoEm = { gte: excDataInicio };
    }
    if (excDeptId && excDeptId !== 'todos') {
      excWhere.departamentoId = Number(excDeptId);
    }
    if (excUsuarioId && excUsuarioId !== 'todos') {
      excWhere.deletadoPorId = Number(excUsuarioId);
    }
    if (excMotivo && excMotivo !== 'todos') {
      if (excMotivo === 'Não informado') {
        excWhere.motivoExclusao = null;
      } else {
        excWhere.OR = [
          { motivoExclusao: excMotivo },
          { motivoExclusaoCustom: excMotivo },
        ];
      }
    }

    let exclusoesData: any = {
      totalExcluidos: 0,
      motivosExclusao: [],
      exclusoesPorMes: [],
      usuarios: [],
    };
    try {
      const totalExcluidos = await prisma.itemLixeira.count({
        where: excWhere,
      });

      // Motivos de exclusão agrupados
      let motivosExclusao: any[] = [];
      try {
        const itensLixeira = await prisma.itemLixeira.findMany({
          where: excWhere,
          select: {
            motivoExclusao: true,
            motivoExclusaoCustom: true,
            deletadoEm: true,
            deletadoPorId: true,
            empresaId: true,
            nomeItem: true,
          },
        });

        // Mapa empresaId -> razao_social (uma única consulta para todos)
        const empresaIds = Array.from(
          new Set(itensLixeira.map((i: any) => i.empresaId).filter((id: any) => Number.isFinite(id))),
        );
        const empresaNomePorId: Record<number, string> = {};
        if (empresaIds.length > 0) {
          try {
            const empresas = await prisma.empresa.findMany({
              where: { id: { in: empresaIds as number[] } },
              select: { id: true, razao_social: true, apelido: true },
            });
            for (const e of empresas) {
              empresaNomePorId[e.id] = e.razao_social || e.apelido || `Empresa ${e.id}`;
            }
          } catch {
            // segue sem nomes de empresa
          }
        }

        const motivoCount: Record<string, number> = {};
        const motivoItens: Record<string, Array<{ processoNome: string; empresaNome: string | null; deletadoEm: string }>> = {};
        itensLixeira.forEach((item: any) => {
          // Prioriza motivoExclusaoCustom quando motivo é "Outro", senão usa motivoExclusao diretamente
          let motivo = item.motivoExclusao || 'Não informado';
          if (motivo === 'Outro' && item.motivoExclusaoCustom) {
            motivo = item.motivoExclusaoCustom;
          }
          motivoCount[motivo] = (motivoCount[motivo] || 0) + 1;
          if (!motivoItens[motivo]) motivoItens[motivo] = [];
          motivoItens[motivo].push({
            processoNome: item.nomeItem || 'Sem nome',
            empresaNome: item.empresaId ? (empresaNomePorId[item.empresaId] || null) : null,
            deletadoEm: item.deletadoEm,
          });
        });
        motivosExclusao = Object.entries(motivoCount)
          .map(([motivo, count]) => ({ motivo, count, itens: motivoItens[motivo] || [] }))
          .sort((a, b) => b.count - a.count);

        // Exclusões por mês (últimos 12 meses)
        const exclusoesPorMes: { mes: string; count: number }[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const mesInicio = new Date(d.getFullYear(), d.getMonth(), 1);
          const mesFim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
          const count = itensLixeira.filter((item: any) => {
            const del = new Date(item.deletadoEm);
            return del >= mesInicio && del <= mesFim;
          }).length;
          exclusoesPorMes.push({
            mes: mesInicio.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
            count,
          });
        }

        // Usuários que excluíram (para preencher filtro)
        const usuarioIds = [...new Set(itensLixeira.map((i: any) => i.deletadoPorId))];

        exclusoesData = { totalExcluidos, motivosExclusao, exclusoesPorMes };
      } catch {
        exclusoesData.totalExcluidos = totalExcluidos;
      }

      // Buscar todos os usuários que já excluíram algo (sem filtro) para popular dropdown
      try {
        const todosItens = await prisma.itemLixeira.findMany({
          where: { tipoItem: 'PROCESSO' },
          select: { deletadoPorId: true },
          distinct: ['deletadoPorId'],
        });
        const userIds = todosItens.map((i: any) => i.deletadoPorId);
        if (userIds.length > 0) {
          const usuarios = await prisma.usuario.findMany({
            where: { id: { in: userIds } },
            select: { id: true, nome: true },
          });
          exclusoesData.usuarios = usuarios;
        }
      } catch {
        // silencioso
      }

      // Buscar departamentos que tiveram exclusões para popular dropdown
      try {
        const todosItensDept = await prisma.itemLixeira.findMany({
          where: { tipoItem: 'PROCESSO', departamentoId: { not: null } },
          select: { departamentoId: true },
          distinct: ['departamentoId'],
        });
        const deptIds = todosItensDept.map((i: any) => i.departamentoId).filter(Boolean);
        if (deptIds.length > 0) {
          const depts = await prisma.departamento.findMany({
            where: { id: { in: deptIds } },
            select: { id: true, nome: true },
          });
          exclusoesData.departamentos = depts;
        } else {
          exclusoesData.departamentos = [];
        }
      } catch {
        exclusoesData.departamentos = [];
      }

      // Listar motivos únicos para filtro
      exclusoesData.motivosUnicos = exclusoesData.motivosExclusao.map((m: any) => m.motivo);
    } catch {
      // Tabela pode não existir — campo motivoExclusao pode não existir
    }

    return NextResponse.json({
      totalProcessos,
      processosPorStatus: processosPorStatus.map((p) => ({
        status: typeof p.status === 'string' ? p.status.toLowerCase() : p.status,
        quantidade: p._count.id,
      })),
      processosPorDepartamento: processosPorDepartamento.map((p) => ({
        departamentoId: p.departamentoAtual,
        quantidade: p._count.id,
      })),
      processosCriadosPeriodo,
      processosFinalizadosPeriodo,
      processosFinalizadosCriadosPeriodo,
      tempoMedioPorDepartamento,
      tempoMedioTotalDias: round2(tempoMedioTotalDias),
      taxaConclusao: round2(taxaConclusao),
      periodo: periodoDias,
      exclusoes: exclusoesData,
    });
  } catch (error) {
    console.error('Erro ao buscar analytics:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar analytics' },
      { status: 500 }
    );
  }
}



