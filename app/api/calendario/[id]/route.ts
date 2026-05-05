import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { getAuthUser } from '@/app/utils/routeAuth';
import { registrarLog, getIp } from '@/app/utils/logAuditoria';

// Função para converter data corretamente (evita problema de timezone)
function parseDate(value: string): Date {
  // Se for apenas data (YYYY-MM-DD), adiciona horário meio-dia UTC para evitar mudança de dia por timezone
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value + 'T12:00:00Z');
  }
  // Se tem hora mas sem indicador de timezone, tratar como UTC explicitamente
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !value.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(value)) {
    return new Date(value + 'Z');
  }
  return new Date(value);
}

function isDateOnlyValue(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// GET - Buscar evento específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    
    const evento = await (prisma as any).eventoCalendario.findUnique({
      where: { id },
    });
    
    if (!evento) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      ...evento,
      tipo: evento.tipo.toLowerCase(),
      status: evento.status.toLowerCase(),
      recorrencia: evento.recorrencia.toLowerCase(),
    });
  } catch (error) {
    console.error('Erro ao buscar evento:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar evento' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar evento
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    const usuario = await getAuthUser(request);
    const body = await request.json();
    
    const {
      titulo,
      descricao,
      tipo,
      status,
      dataInicio,
      dataFim,
      diaInteiro,
      cor,
      processoId,
      empresaId,
      departamentoId,
      recorrencia,
      recorrenciaFim,
      alertaMinutosAntes,
    } = body;

    const diaInteiroNormalizado =
      diaInteiro !== undefined ? Boolean(diaInteiro || isDateOnlyValue(dataInicio)) : undefined;
    
    const evento = await (prisma as any).eventoCalendario.update({
      where: { id },
      data: {
        ...(titulo && { titulo }),
        ...(descricao !== undefined && { descricao }),
        ...(tipo && { tipo: tipo.toUpperCase() }),
        ...(status && { status: status.toUpperCase() }),
        ...(dataInicio && { dataInicio: parseDate(dataInicio) }),
        ...(dataFim !== undefined && { dataFim: dataFim ? parseDate(dataFim) : null }),
        ...(diaInteiroNormalizado !== undefined && { diaInteiro: diaInteiroNormalizado }),
        ...(cor !== undefined && { cor }),
        ...(processoId !== undefined && { processoId: processoId ? Number(processoId) : null }),
        ...(empresaId !== undefined && { empresaId: empresaId ? Number(empresaId) : null }),
        ...(departamentoId !== undefined && { departamentoId: departamentoId ? Number(departamentoId) : null }),
        ...(recorrencia && { recorrencia: recorrencia.toUpperCase() }),
        ...(recorrenciaFim !== undefined && { recorrenciaFim: recorrenciaFim ? new Date(recorrenciaFim) : null }),
        ...(alertaMinutosAntes !== undefined && { alertaMinutosAntes }),
      },
    });

    if (usuario?.id) {
      await registrarLog({
        usuarioId: usuario.id,
        acao: 'EDITAR',
        entidade: 'CALENDARIO',
        entidadeId: evento.id,
        entidadeNome: evento.titulo,
        ip: getIp(request),
      });
    }

    return NextResponse.json({
      ...evento,
      tipo: evento.tipo.toLowerCase(),
      status: evento.status.toLowerCase(),
      recorrencia: evento.recorrencia.toLowerCase(),
    });
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar evento' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir evento
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    const usuario = await getAuthUser(request);

    // Fetch event before deleting for log purposes
    const eventoAntes = await (prisma as any).eventoCalendario.findUnique({ where: { id } });

    await (prisma as any).eventoCalendario.delete({
      where: { id },
    });

    if (usuario?.id) {
      await registrarLog({
        usuarioId: usuario.id,
        acao: 'EXCLUIR',
        entidade: 'CALENDARIO',
        entidadeId: id,
        entidadeNome: eventoAntes?.titulo || 'N/A',
        ip: getIp(request),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir evento:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir evento' },
      { status: 500 }
    );
  }
}
