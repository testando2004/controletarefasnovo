import { prisma } from '@/app/utils/prisma';
import { ensureProcessInterligacaoSchema } from '@/app/utils/processInterligacaoSchema';

type ProcessoBasico = {
  id: number;
  nomeServico: string | null;
  nomeEmpresa: string;
  processoOrigemId: number | null;
};

function nomeProcesso(processo: Pick<ProcessoBasico, 'id' | 'nomeServico' | 'nomeEmpresa'>) {
  return processo.nomeServico || processo.nomeEmpresa || `#${processo.id}`;
}

export async function coletarProcessosInterligados(processoInicialId: number) {
  await ensureProcessInterligacaoSchema();

  const processos = new Map<number, ProcessoBasico>();
  const fila = [processoInicialId];
  const inspecionados = new Set<number>();

  while (fila.length > 0) {
    const atualId = Number(fila.shift());
    if (!Number.isFinite(atualId) || atualId <= 0 || inspecionados.has(atualId)) continue;
    inspecionados.add(atualId);

    const atual = await prisma.processo.findUnique({
      where: { id: atualId },
      select: {
        id: true,
        nomeServico: true,
        nomeEmpresa: true,
        processoOrigemId: true,
      } as any,
    }) as ProcessoBasico | null;

    if (!atual) continue;

    processos.set(atual.id, atual);

    if (Number.isFinite(Number(atual.processoOrigemId)) && Number(atual.processoOrigemId) > 0) {
      fila.push(Number(atual.processoOrigemId));
    }

    const filhos = await prisma.processo.findMany({
      where: { processoOrigemId: atual.id } as any,
      select: {
        id: true,
        nomeServico: true,
        nomeEmpresa: true,
        processoOrigemId: true,
      } as any,
    }) as unknown as ProcessoBasico[];

    for (const filho of filhos) {
      processos.set(filho.id, filho);
      fila.push(filho.id);
    }

    try {
      const interligacoes = await (prisma as any).interligacaoProcesso.findMany({
        where: {
          OR: [
            { processoOrigemId: atual.id },
            { processoDestinoId: atual.id },
          ],
        },
      });

      for (const interligacao of interligacoes) {
        const outroId = Number(
          interligacao.processoOrigemId === atual.id
            ? interligacao.processoDestinoId
            : interligacao.processoOrigemId
        );
        if (Number.isFinite(outroId) && outroId > 0) {
          fila.push(outroId);
        }
      }
    } catch {
      // A tabela pode nao existir em ambientes antigos.
    }
  }

  const ids = Array.from(processos.keys()).sort((a, b) => a - b);
  const nomes: Record<number, string> = {};

  for (const processo of processos.values()) {
    nomes[processo.id] = nomeProcesso(processo);
  }

  return {
    ids,
    processos,
    nomes,
  };
}
