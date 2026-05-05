import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';
import { registrarLog, getIp } from '@/app/utils/logAuditoria';
import { verificarPermissaoDocumento } from '@/app/utils/verificarPermissaoDocumento';
import { getEmpresaDocumentoQueryConfig, normalizeEmpresaDocumento } from '@/app/utils/empresaDocumentoCompat';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/empresas
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const { searchParams } = new URL(request.url);
    const cadastrada = searchParams.get('cadastrada');
    const busca = searchParams.get('busca');

    const where: any = {};

    // Filtrar por cadastrada apenas se o parâmetro for informado;
    if (cadastrada !== null && cadastrada !== undefined && cadastrada !== '') {
      where.cadastrada = cadastrada === 'true';
    }

    // Filtrar por busca se informado
    if (busca) {
      where.OR = [
        { codigo: { contains: busca, mode: 'insensitive' } },
        { razao_social: { contains: busca, mode: 'insensitive' } },
        { cnpj: { contains: busca } },
      ];
    }

    const empresas = await prisma.empresa.findMany({
      where,
      orderBy: { criado_em: 'desc' },
      include: {
        _count: {
          select: { processos: true },
        },
      },
    });

    // Agrega status de validade dos documentos em UMA query só (evita N+1 do badge)
    const summaryByEmpresa = new Map<number, { vencido: number; proximoVencer: number }>();
    try {
      const { select, acl } = await getEmpresaDocumentoQueryConfig();
      const documentos = await prisma.empresaDocumento.findMany({
        where: { validadeAte: { not: null } },
        select,
      });

      const userId = Number((user as any).id);
      const userRole = String((user as any).role || '').toUpperCase();
      const userDeptId = Number((user as any).departamentoId) || null;

      const hoje = new Date();
      const startOfDay = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const DIA_MS = 1000 * 60 * 60 * 24;

      for (const raw of documentos) {
        const doc = normalizeEmpresaDocumento(raw as any, acl);
        const pode = verificarPermissaoDocumento(
          {
            visibility: (doc as any).visibility,
            allowedRoles: (doc as any).allowedRoles,
            allowedUserIds: (doc as any).allowedUserIds,
            uploadPorId: (doc as any).uploadPorId,
            allowedDepartamentos: (doc as any).allowedDepartamentos || null,
          },
          { id: userId, role: userRole, departamentoId: userDeptId }
        );
        if (!pode) continue;

        const validade = (doc as any).validadeAte ? new Date((doc as any).validadeAte) : null;
        if (!validade) continue;
        const alvo = new Date(validade.getFullYear(), validade.getMonth(), validade.getDate());
        const diffDias = Math.ceil((alvo.getTime() - startOfDay.getTime()) / DIA_MS);
        const janelaRaw = (doc as any).alertarDiasAntes;
        const janela = Number.isFinite(Number(janelaRaw)) ? Number(janelaRaw) : 30;

        const empresaId = Number((doc as any).empresaId);
        if (!Number.isFinite(empresaId)) continue;
        const prev = summaryByEmpresa.get(empresaId) || { vencido: 0, proximoVencer: 0 };
        if (diffDias < 0) prev.vencido++;
        else if (diffDias <= janela) prev.proximoVencer++;
        summaryByEmpresa.set(empresaId, prev);
      }
    } catch (e) {
      console.error('Erro ao calcular resumo de validade de documentos:', e);
    }

    const empresasComResumo = empresas.map((e: any) => ({
      ...e,
      validadeSummary: summaryByEmpresa.get(Number(e.id)) || { vencido: 0, proximoVencer: 0 },
    }));

    return NextResponse.json(empresasComResumo);
  } catch (error) {
    console.error('Erro ao buscar empresas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar empresas' },
      { status: 500 }
    );
  }
}

// POST /api/empresas
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    if (!requireRole(user, ['ADMIN'])) {
      return NextResponse.json({ error: 'Sem permissão para cadastrar empresa' }, { status: 403 });
    }

    const data = await request.json();

    // ========== IMPORTAÇÃO EM LOTE ==========
    if (data.bulk === true && Array.isArray(data.empresas)) {
      const resultados = { criadas: 0, duplicadas: 0, erros: 0, detalhes: [] as any[] };
      for (const emp of data.empresas) {
        try {
          const cnpjLimpo = emp.cnpj ? String(emp.cnpj).replace(/\D/g, '') : '';
          const temCnpjValido = cnpjLimpo.length === 14;
          await prisma.empresa.create({
            data: {
              cnpj: emp.cnpj || null,
              codigo: emp.codigo || null,
              razao_social: emp.razao_social || emp.razaoSocial || 'Sem nome',
              apelido: emp.apelido || null,
              inscricao_estadual: emp.inscricao_estadual || null,
              inscricao_municipal: emp.inscricao_municipal || null,
              regime_federal: emp.regime_federal || null,
              regime_estadual: emp.regime_estadual || null,
              regime_municipal: emp.regime_municipal || null,
              data_abertura: emp.data_abertura ? new Date(emp.data_abertura) : null,
              estado: emp.estado || null,
              cidade: emp.cidade || null,
              bairro: emp.bairro || null,
              logradouro: emp.logradouro || null,
              numero: emp.numero || null,
              cep: emp.cep || null,
              email: emp.email || null,
              telefone: emp.telefone || null,
              cadastrada: temCnpjValido ? true : Boolean(emp.cadastrada),
            },
          });
          resultados.criadas++;
        } catch (error: any) {
          if (error.code === 'P2002') {
            resultados.duplicadas++;
            resultados.detalhes.push({ empresa: emp.razao_social || emp.codigo, erro: 'duplicada' });
          } else {
            resultados.erros++;
            resultados.detalhes.push({ empresa: emp.razao_social || emp.codigo, erro: String(error.message).slice(0, 120) });
          }
        }
      }

      // Log de auditoria para importação em lote
      await registrarLog({
        usuarioId: user.id as number,
        acao: 'IMPORTAR',
        entidade: 'EMPRESA',
        detalhes: `Importação em lote: ${resultados.criadas} criadas, ${resultados.duplicadas} duplicadas, ${resultados.erros} erros`,
        ip: getIp(request),
      });

      return NextResponse.json(resultados, { status: 201 });
    }
    
    // ========== CRIAÇÃO INDIVIDUAL ==========
    // Determinar se a empresa cadastrada: precisa ter CNPJ válido (14 dígitos)
    const cnpjLimpo = data.cnpj ? String(data.cnpj).replace(/\D/g, '') : '';
    const temCnpjValido = cnpjLimpo.length === 14;
    
    const empresaCadastrada = temCnpjValido ? true : Boolean(data.cadastrada);
    const razaoSocialNormalizada =
      String(data.razao_social || '').trim() ||
      String(data.codigo || '').trim() ||
      'Sem nome';

    const empresa = await prisma.empresa.create({
      data: {
        cnpj: data.cnpj || null,
        codigo: data.codigo,
        razao_social: razaoSocialNormalizada,
        apelido: data.apelido,
        inscricao_estadual: data.inscricao_estadual,
        inscricao_municipal: data.inscricao_municipal,
        regime_federal: data.regime_federal,
        regime_estadual: data.regime_estadual,
        regime_municipal: data.regime_municipal,
        data_abertura: data.data_abertura ? new Date(data.data_abertura) : null,
        estado: data.estado,
        cidade: data.cidade,
        bairro: data.bairro,
        logradouro: data.logradouro,
        numero: data.numero,
        cep: data.cep,
        email: data.email,
        telefone: data.telefone,
        cadastrada: empresaCadastrada,
      },
    });

    // Log de auditoria para criação individual
    await registrarLog({
      usuarioId: user.id as number,
      acao: 'CRIAR',
      entidade: 'EMPRESA',
      entidadeId: empresa.id,
      entidadeNome: empresa.razao_social || empresa.codigo,
      empresaId: empresa.id,
      ip: getIp(request),
    });

    return NextResponse.json(empresa, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar empresa:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'CNPJ ou código já cadastrado' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Erro ao criar empresa' },
      { status: 500 }
    );
  }
}

