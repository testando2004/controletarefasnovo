import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { assertProcessAccess } from '@/app/utils/processAccess';
import { validarDepartamentoProcesso } from '@/app/utils/processValidation';
import { getIp, registrarLog } from '@/app/utils/logAuditoria';
import { notificarDepartamentoPorEmail } from '@/app/utils/notificacaoEmail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// POST /api/processos/:id/avancar
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const roleUpper = String((user as any).role || '').toUpperCase();
    if (roleUpper === 'USUARIO') {
      return NextResponse.json({ error: 'Sem permissao para avancar processo' }, { status: 403 });
    }

    const processoId = parseInt(params.id);
    const access = await assertProcessAccess(user, processoId, 'advance');
    if (access.error) return access.error;

    const processo = await prisma.processo.findUnique({
      where: { id: processoId },
      include: {
        historicoFluxos: {
          orderBy: { ordem: 'desc' },
          take: 1,
        },
        documentos: true,
        questionarios: {
          include: {
            respostas: true,
          },
        },
      },
    });

    if (!processo) {
      return NextResponse.json({ error: 'Processo nao encontrado' }, { status: 404 });
    }

    if (roleUpper === 'GERENTE') {
      const { getUserDepartmentIds } = await import('@/app/utils/processAccess');
      const deptosUsuario = getUserDepartmentIds(user);

      if (deptosUsuario.length === 0) {
        return NextResponse.json({ error: 'Usuario sem departamento definido' }, { status: 403 });
      }

      if (!deptosUsuario.includes(Number(processo.departamentoAtual))) {
        return NextResponse.json(
          { error: 'Sem permissao para mover processo de outro departamento' },
          { status: 403 }
        );
      }
    }

    const proximoIndex = processo.departamentoAtualIndex + 1;
    if (!processo.fluxoDepartamentos || proximoIndex >= processo.fluxoDepartamentos.length) {
      return NextResponse.json({ error: 'Processo ja esta no ultimo departamento' }, { status: 400 });
    }

    const proximoDepartamentoId = processo.fluxoDepartamentos[proximoIndex];
    const departamentoAtual = await prisma.departamento.findUnique({
      where: { id: processo.departamentoAtual },
      include: {
        documentosObrigatorios: true,
      },
    });
    const proximoDepartamento = await prisma.departamento.findUnique({
      where: { id: proximoDepartamentoId },
    });

    if (!proximoDepartamento || !departamentoAtual) {
      return NextResponse.json({ error: 'Departamento nao encontrado' }, { status: 404 });
    }

    try {
      // Calcula a etapa atual (ocorrência do dept no fluxo até departamentoAtualIndex)
      const fluxoArr = (processo.fluxoDepartamentos || []).map(Number).filter((x: any) => Number.isFinite(x));
      const idxAtual = Number(processo.departamentoAtualIndex ?? 0);
      let etapaAtual = 0;
      for (let i = 0; i <= idxAtual && i < fluxoArr.length; i++) {
        if (fluxoArr[i] === departamentoAtual.id) etapaAtual++;
      }
      const resultadoValidacao = await validarDepartamentoProcesso(processoId, departamentoAtual.id, null, etapaAtual || 1);

      if (!resultadoValidacao.encontrado) {
        return NextResponse.json(
          { error: resultadoValidacao.validacao.erros[0]?.mensagem || 'Departamento nao encontrado' },
          { status: resultadoValidacao.status }
        );
      }

      if (!resultadoValidacao.valido) {
        const errosCriticos = resultadoValidacao.validacao.erros.filter((erro) => erro.tipo === 'erro');
        return NextResponse.json(
          {
            error: 'Requisitos obrigatorios nao preenchidos',
            detalhes: errosCriticos.map((erro) => erro.mensagem),
            validacao: resultadoValidacao.validacao.erros,
          },
          { status: 400 }
        );
      }
    } catch (validacaoError) {
      console.error('Erro na validacao do avanco:', validacaoError);
      return NextResponse.json(
        { error: 'Nao foi possivel validar os requisitos obrigatorios com seguranca' },
        { status: 503 }
      );
    }

    const processoAtualizado = await prisma.$transaction(async (tx) => {
      const proc = await tx.processo.update({
        where: { id: processoId },
        data: {
          departamentoAtual: proximoDepartamentoId,
          departamentoAtualIndex: proximoIndex,
          progresso: Math.round(((proximoIndex + 1) / processo.fluxoDepartamentos.length) * 100),
          dataAtualizacao: new Date(),
        },
        include: {
          empresa: true,
          tags: { include: { tag: true } },
        },
      });

      const ultimoFluxo = processo.historicoFluxos[0];
      if (ultimoFluxo) {
        await tx.historicoFluxo.update({
          where: { id: ultimoFluxo.id },
          data: {
            status: 'concluido',
            saidaEm: new Date(),
          },
        });
      }

      await tx.historicoFluxo.create({
        data: {
          processoId,
          departamentoId: proximoDepartamentoId,
          ordem: proximoIndex,
          status: 'em_andamento',
          entradaEm: new Date(),
        },
      });

      await tx.historicoEvento.create({
        data: {
          processoId,
          tipo: 'MOVIMENTACAO',
          acao: `Processo movido de "${departamentoAtual?.nome || 'N/A'}" para "${proximoDepartamento.nome}"`,
          responsavelId: user.id,
          departamento: proximoDepartamento.nome,
          dataTimestamp: BigInt(Date.now()),
        },
      });

      return proc;
    });

    await registrarLog({
      usuarioId: user.id,
      acao: 'AVANCAR',
      entidade: 'PROCESSO',
      entidadeId: processoId,
      entidadeNome: (processoAtualizado as any).nomeServico || (processoAtualizado as any).nomeEmpresa || `#${processoId}`,
      campo: 'departamentoAtual',
      valorAnterior: departamentoAtual.nome,
      valorNovo: proximoDepartamento.nome,
      detalhes: `Processo avancado de "${departamentoAtual.nome}" para "${proximoDepartamento.nome}".`,
      processoId,
      departamentoId: proximoDepartamentoId,
      ip: getIp(request),
    });

    try {
      let novoResponsavel = await prisma.usuario.findFirst({
        where: {
          ativo: true,
          role: 'GERENTE',
          departamentoId: proximoDepartamentoId,
        },
        select: { id: true, nome: true },
      });

      if (!novoResponsavel && proximoDepartamento.responsavel) {
        novoResponsavel = await prisma.usuario.findFirst({
          where: {
            ativo: true,
            nome: { equals: proximoDepartamento.responsavel, mode: 'insensitive' },
          },
          select: { id: true, nome: true },
        });
      }

      if (!novoResponsavel) {
        novoResponsavel = await prisma.usuario.findFirst({
          where: {
            ativo: true,
            departamentoId: proximoDepartamentoId,
          },
          orderBy: { role: 'asc' },
          select: { id: true, nome: true },
        });
      }

      if (novoResponsavel) {
        await prisma.processo.update({
          where: { id: processoId },
          data: { responsavelId: novoResponsavel.id },
        });
      }
    } catch {
      // Nao bloquear avancao se falhar.
    }

    try {
      const gerentesDestino = await prisma.usuario.findMany({
        where: {
          ativo: true,
          role: 'GERENTE',
          departamentoId: proximoDepartamentoId,
        },
        select: { id: true },
      });

      const ids = new Set<number>(gerentesDestino.map((usuario) => usuario.id));

      if (typeof (processoAtualizado as any).responsavelId === 'number') {
        ids.add((processoAtualizado as any).responsavelId);
      }

      ids.delete(user.id);

      const destinatarios = Array.from(ids);
      if (destinatarios.length > 0) {
        const nomeEmpresa = (processoAtualizado as any).nomeEmpresa || 'Empresa';
        const nomeServico = (processoAtualizado as any).nomeServico
          ? ` - ${(processoAtualizado as any).nomeServico}`
          : '';

        await prisma.notificacao.createMany({
          data: destinatarios.map((usuarioId) => ({
            usuarioId,
            mensagem: `Processo avancou para ${proximoDepartamento.nome}: ${nomeEmpresa}${nomeServico}`,
            tipo: 'INFO',
            processoId,
            link: '/',
          })),
        });
      }
    } catch (error) {
      console.error('Erro ao criar notificacoes de avancao:', error);
    }

    // Email de notificação para todos os usuários ativos do departamento destino
    // (com spam-control de 24h e modo teste via env var EMAIL_NOTIFICACOES_TESTE_DESTINATARIO)
    try {
      const nomeEmpresa = (processoAtualizado as any).nomeEmpresa
        || ((processoAtualizado as any).empresa?.razaoSocial)
        || 'Empresa';
      const nomeServico = (processoAtualizado as any).nomeServico || null;
      const responsavelAnterior = await prisma.usuario.findUnique({
        where: { id: user.id },
        select: { nome: true },
      });

      void notificarDepartamentoPorEmail({
        processoId,
        departamentoId: proximoDepartamentoId,
        departamentoNome: proximoDepartamento.nome,
        empresaNome: nomeEmpresa,
        servicoNome: nomeServico,
        responsavelAnteriorNome: responsavelAnterior?.nome || null,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || null,
      }).catch((err) => console.error('Erro ao enviar email de notificação:', err));
    } catch (error) {
      console.error('Erro ao preparar email de notificação:', error);
    }

    return NextResponse.json(processoAtualizado);
  } catch (error) {
    console.error('Erro ao avancar processo:', error);
    return NextResponse.json(
      { error: 'Nao foi possivel avancar a solicitacao agora. Tente novamente.' },
      { status: 500 }
    );
  }
}
