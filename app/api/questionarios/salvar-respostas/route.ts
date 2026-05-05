import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { registrarLog, getIp } from '@/app/utils/logAuditoria';
import { assertProcessAccess } from '@/app/utils/processAccess';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// POST /api/questionarios/salvar-respostas
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;
    
    const { processoId, departamentoId, respostas } = await request.json();
    const pid = Number(processoId);
    const did = Number(departamentoId);
    
    if (!pid || !did || !respostas || typeof respostas !== 'object') {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      );
    }

    const access = await assertProcessAccess(user, pid, 'answer_questionario', { departamentoId: did });
    if (access.error) return access.error;

    const questionarioIds = Object.keys(respostas)
      .map((questionarioId) => Number(questionarioId))
      .filter((questionarioId) => Number.isFinite(questionarioId) && questionarioId > 0);

    const questionariosValidos = await prisma.questionarioDepartamento.findMany({
      where: {
        id: { in: questionarioIds },
        processoId: pid,
        departamentoId: did,
      },
      select: { id: true, label: true },
    });

    const departamento = await prisma.departamento.findUnique({
      where: { id: did },
      select: { nome: true },
    });

    if (questionariosValidos.length !== questionarioIds.length) {
      return NextResponse.json(
        { error: 'Há perguntas inválidas para este processo/departamento' },
        { status: 403 }
      );
    }

    // Buscar respostas existentes para detectar mudanças
    const respostasExistentes = await prisma.respostaQuestionario.findMany({
      where: { processoId: pid, questionarioId: { in: questionarioIds } },
      select: { questionarioId: true, resposta: true },
    });
    const existenteMap: Record<number, string> = {};
    for (const r of respostasExistentes) {
      existenteMap[r.questionarioId] = r.resposta;
    }
    const labelMap: Record<number, string> = {};
    for (const q of questionariosValidos) {
      labelMap[q.id] = q.label;
    }

    // Salvar/atualizar respostas
    const resultados = await Promise.all(
      Object.entries(respostas).map(async ([questionarioId, resposta]) => {
        const respostaString = typeof resposta === 'string'
          ? resposta
          : JSON.stringify(resposta);

        return prisma.respostaQuestionario.upsert({
          where: {
            processoId_questionarioId: {
              processoId: pid,
              questionarioId: parseInt(questionarioId),
            },
          },
          update: {
            resposta: respostaString,
            respondidoPorId: user.id,
          },
          create: {
            processoId: pid,
            questionarioId: parseInt(questionarioId),
            resposta: respostaString,
            respondidoPorId: user.id,
          },
        });
      })
    );

    // Logging detalhado por pergunta
    const ip = getIp(request);
    const perguntasAlteradas: string[] = [];
    for (const [questionarioId, resposta] of Object.entries(respostas)) {
      const qId = parseInt(questionarioId);
      const respostaStr = typeof resposta === 'string' ? resposta : JSON.stringify(resposta);
      const anteriorStr = existenteMap[qId] || '';
      if (anteriorStr !== respostaStr) {
        perguntasAlteradas.push(labelMap[qId] || `Pergunta #${qId}`);
        await registrarLog({
          usuarioId: user.id,
          acao: 'PREENCHER',
          entidade: 'QUESTIONARIO',
          entidadeId: qId,
          entidadeNome: labelMap[qId] || `Pergunta #${qId}`,
          campo: labelMap[qId] || `pergunta_${qId}`,
          valorAnterior: anteriorStr || null,
          valorNovo: respostaStr,
          processoId: pid,
          departamentoId: did,
          ip,
        });
      }
    }

    if (perguntasAlteradas.length > 0) {
      await prisma.historicoEvento.create({
        data: {
          processoId: pid,
          tipo: 'ALTERACAO',
          acao:
            perguntasAlteradas.length === 1
              ? `Resposta atualizada: ${perguntasAlteradas[0]}`
              : `${perguntasAlteradas.length} respostas atualizadas em ${departamento?.nome || `Departamento #${did}`}`,
          responsavelId: user.id,
          departamento: departamento?.nome || `Departamento #${did}`,
          dataTimestamp: BigInt(Date.now()),
        },
      });
    }

    return NextResponse.json({ 
      message: 'Respostas salvas com sucesso',
      respostas: resultados,
    });
  } catch (error) {
    console.error('Erro ao salvar respostas:', error);
    return NextResponse.json(
      { error: 'Erro ao salvar respostas' },
      { status: 500 }
    );
  }
}



