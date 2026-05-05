import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';
import { registrarLog, detectarMudancas, getIp } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/empresas/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const empresa = await prisma.empresa.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        processos: {
          orderBy: { dataCriacao: 'desc' },
          take: 10,
        },
        _count: {
          select: { processos: true },
        },
      },
    });
    
    if (!empresa) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(empresa);
  } catch (error) {
    console.error('Erro ao buscar empresa:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar empresa' },
      { status: 500 }
    );
  }
}

// PUT /api/empresas/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    if (!requireRole(user, ['ADMIN', 'GERENTE'])) {
      return NextResponse.json({ error: 'Sem permissão para editar empresa' }, { status: 403 });
    }

    const data = await request.json();
    
    // Calcular valor de cadastrada
    const updateData: any = {};
    if (data.cnpj !== undefined) updateData.cnpj = data.cnpj;
    if (data.codigo !== undefined) updateData.codigo = data.codigo;
    if (data.razao_social !== undefined) updateData.razao_social = data.razao_social;
    if (data.apelido !== undefined) updateData.apelido = data.apelido;
    if (data.inscricao_estadual !== undefined) updateData.inscricao_estadual = data.inscricao_estadual;
    if (data.inscricao_municipal !== undefined) updateData.inscricao_municipal = data.inscricao_municipal;
    if (data.regime_federal !== undefined) updateData.regime_federal = data.regime_federal;
    if (data.regime_estadual !== undefined) updateData.regime_estadual = data.regime_estadual;
    if (data.regime_municipal !== undefined) updateData.regime_municipal = data.regime_municipal;
    if (data.data_abertura !== undefined) updateData.data_abertura = data.data_abertura ? new Date(data.data_abertura) : null;
    if (data.estado !== undefined) updateData.estado = data.estado;
    if (data.cidade !== undefined) updateData.cidade = data.cidade;
    if (data.bairro !== undefined) updateData.bairro = data.bairro;
    if (data.logradouro !== undefined) updateData.logradouro = data.logradouro;
    if (data.numero !== undefined) updateData.numero = data.numero;
    if (data.cep !== undefined) updateData.cep = data.cep;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.telefone !== undefined) updateData.telefone = data.telefone;
    
    // Lógica para cadastrada
    if (data.cadastrada !== undefined) {
      updateData.cadastrada = Boolean(data.cadastrada);
    } else if (data.cnpj !== undefined) {
      updateData.cadastrada = !!data.cnpj && String(data.cnpj).replace(/\D/g, '').length === 14;
    }
    
    // Buscar registro antes da atualização para detectar mudanças
    const antes = await prisma.empresa.findUnique({ where: { id: parseInt(params.id) } });

    const empresa = await prisma.empresa.update({
      where: { id: parseInt(params.id) },
      data: updateData,
    });

    // Log de auditoria para edição — registrar cada campo alterado
    if (antes) {
      const mudancas = detectarMudancas(antes as any, empresa as any);
      if (mudancas.length > 0) {
        for (const m of mudancas) {
          await registrarLog({
            usuarioId: user.id as number,
            acao: 'EDITAR',
            entidade: 'EMPRESA',
            entidadeId: empresa.id,
            entidadeNome: empresa.razao_social || empresa.codigo,
            empresaId: empresa.id,
            campo: m.campo,
            valorAnterior: m.valorAnterior,
            valorNovo: m.valorNovo,
            ip: getIp(request),
          });
        }
      } else {
        await registrarLog({
          usuarioId: user.id as number,
          acao: 'EDITAR',
          entidade: 'EMPRESA',
          entidadeId: empresa.id,
          entidadeNome: empresa.razao_social || empresa.codigo,
          empresaId: empresa.id,
          detalhes: 'Nenhum campo alterado detectado',
          ip: getIp(request),
        });
      }
    }

    return NextResponse.json(empresa);
  } catch (error: any) {
    console.error('Erro ao atualizar empresa:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'CNPJ ou código já cadastrado' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Erro ao atualizar empresa' },
      { status: 500 }
    );
  }
}

// DELETE /api/empresas/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    if (!requireRole(user, ['ADMIN'])) {
      return NextResponse.json({ error: 'Sem permissão para excluir empresa' }, { status: 403 });
    }
      // Buscar empresa para backup na lixeira
      const empresaId = parseInt(params.id);
      const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
      if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 15);

      try {
        const dadosOriginais = JSON.parse(JSON.stringify(empresa));
        const created = await prisma.itemLixeira.create({
          data: {
            tipoItem: 'EMPRESA',
            itemIdOriginal: empresa.id,
            dadosOriginais,
            empresaId: empresa.id,
            visibility: 'PUBLIC',
            allowedRoles: [],
            allowedUserIds: [],
            deletadoPorId: user.id as number,
            expiraEm: dataExpiracao,
            nomeItem: empresa.apelido || empresa.razao_social,
            descricaoItem: empresa.email || null,
          }
        });
        console.log('ItemLixeira criado para empresa:', { itemLixeiraId: created.id, empresaId: empresa.id });
      } catch (e: any) {
        console.error('Erro ao criar ItemLixeira for empresa:', e);
      }

      await prisma.empresa.delete({ where: { id: empresaId } });

      // Log de auditoria para exclusão
      await registrarLog({
        usuarioId: user.id as number,
        acao: 'EXCLUIR',
        entidade: 'EMPRESA',
        entidadeId: empresa.id,
        entidadeNome: empresa.razao_social || empresa.codigo,
        empresaId: empresa.id,
        ip: getIp(request),
      });

      return NextResponse.json({ message: 'Empresa excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir empresa:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir empresa' },
      { status: 500 }
    );
  }
}


