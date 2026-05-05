import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { hashPassword } from '@/app/utils/auth';
import { requireAuth, requireRole } from '@/app/utils/routeAuth';
import { registrarLog, detectarMudancas, getIp } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

// GET /api/usuarios/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.time('GET /api/usuarios/:id');
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    if (!requireRole(user, ['ADMIN'])) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Promise.all para buscar usuário e departamento em paralelo se necessário (aqui só 1 query, mas já deixo padrão)
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(params.id) },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        ativo: true,
        departamento: {
          select: { id: true, nome: true },
        },
        criadoEm: true,
      },
    });

    if (!usuario) {
      console.timeEnd('GET /api/usuarios/:id');
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }
    console.timeEnd('GET /api/usuarios/:id');
    return NextResponse.json(usuario);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar usuário' },
      { status: 500 }
    );
  }
}

// PUT /api/usuarios/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.time('PUT /api/usuarios/:id');
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    // Apenas ADMIN pode atualizar usuários
    if (!requireRole(user, ['ADMIN'])) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    
    const data = await request.json();

    // GERENTE não pode promover/alterar ADMIN
    const targetId = parseInt(params.id);
    const departamentoIdRaw = data?.departamentoId;
    const departamentoIdParsed = Number(departamentoIdRaw);
    const departamentoId = Number.isFinite(departamentoIdParsed) && departamentoIdParsed > 0
      ? departamentoIdParsed
      : undefined;

    // Departamentos adicionais (além do principal)
    const departamentosExtras: number[] | undefined = Array.isArray(data?.departamentosExtras)
      ? Array.from(new Set(
          data.departamentosExtras
            .map((x: any) => Number(x))
            .filter((x: any) => Number.isFinite(x) && x > 0 && x !== departamentoId)
        ))
      : undefined;

    const nextRoleUpper = data.role ? String(data.role).toUpperCase() : undefined;

    // Busca target e departamento em paralelo se possível
    const [target, dept] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: targetId }, select: { id: true, nome: true, email: true, role: true, ativo: true, departamentoId: true, permissoes: true } }),
      (typeof departamentoId === 'number')
        ? prisma.departamento.findUnique({ where: { id: departamentoId }, select: { id: true, ativo: true } })
        : Promise.resolve(undefined)
    ]);
    if (!target) {
      console.timeEnd('PUT /api/usuarios/:id');
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    const requesterIsAdmin = requireRole(user, ['ADMIN']);

    // Impede o usuário de se desativar (evita lock-out)
    if (targetId === (user as any).id && data.ativo === false) {
      return NextResponse.json(
        { error: 'Você não pode desativar seu próprio usuário.' },
        { status: 400 }
      );
    }

    // Impede desativar o último ADMIN ativo
    if (data.ativo === false && String(target.role).toUpperCase() === 'ADMIN' && target.ativo) {
      const outrosAdminsAtivos = await prisma.usuario.count({
        where: {
          role: 'ADMIN',
          ativo: true,
          id: { not: targetId },
        },
      });

      if (outrosAdminsAtivos === 0) {
        return NextResponse.json(
          { error: 'Não é possível desativar o último administrador ativo.' },
          { status: 400 }
        );
      }
    }

    const roleFinalUpper = nextRoleUpper ?? String(target.role).toUpperCase();
    const roleSemDepartamento = roleFinalUpper === 'ADMIN';

    // Se está definindo/alterando para USUARIO/GERENTE, exige departamento
    if ((roleFinalUpper === 'USUARIO' || roleFinalUpper === 'GERENTE') && typeof departamentoId !== 'number') {
      return NextResponse.json({ error: 'Departamento é obrigatório para usuário/gerente' }, { status: 400 });
    }

    // Só valida o departamento se ele for usado (ADMIN ignora departamento)
    if (!roleSemDepartamento && typeof departamentoId === 'number') {
      if (!dept || !dept.ativo) {
        console.timeEnd('PUT /api/usuarios/:id');
        return NextResponse.json({ error: 'Departamento inválido' }, { status: 400 });
      }
    }

    const updateData: any = {
      nome: data.nome,
      email: data.email,
      role: nextRoleUpper,
      departamentoId: roleSemDepartamento
        ? null
        : (typeof departamentoId === 'number' ? departamentoId : null),
      permissoes: data.permissoes || [],
      ativo: data.ativo !== undefined ? data.ativo : true,
    };

    // require2FA: somente ghost pode alterar
    if (data.require2FA !== undefined) {
      const requesterIsGhost = (user as any).isGhost === true || (user as any).email === 'ghost@triar.system';
      if (requesterIsGhost) {
        updateData.require2FA = Boolean(data.require2FA);
      }
    }

    // requester é admin (já validado acima)

    // Se tiver senha, atualiza
    if (data.senha) {
      updateData.senha = await hashPassword(data.senha);
    }

    const usuario = await prisma.usuario.update({
      where: { id: parseInt(params.id) },
      data: updateData,
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        ativo: true,
        require2FA: true,
        departamento: {
          select: { id: true, nome: true },
        },
      },
    });

    // Salva departamentosExtras via raw SQL — só se o request enviou o campo
    // (não sobrescreve se o admin só enviou outros campos).
    if (departamentosExtras !== undefined) {
      // ADMIN não tem deptos; zera
      const extrasFinais = roleSemDepartamento ? [] : departamentosExtras;
      try {
        const arr = extrasFinais.length > 0
          ? `ARRAY[${extrasFinais.map((n) => Number(n)).join(',')}]::INTEGER[]`
          : `ARRAY[]::INTEGER[]`;
        await prisma.$executeRawUnsafe(
          `UPDATE "Usuario" SET "departamentosExtras" = ${arr} WHERE id = ${Number(targetId)}`
        );
      } catch {
        // coluna ainda não aplicada
      }
      (usuario as any).departamentosExtras = extrasFinais;
    }
    
    // Audit log: detectar campos alterados e registrar
    const camposAntes: Record<string, any> = {
      nome: target.nome,
      email: target.email,
      role: target.role,
      ativo: target.ativo,
      departamentoId: target.departamentoId,
      permissoes: JSON.stringify(target.permissoes),
    };
    const camposDepois: Record<string, any> = {
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      ativo: usuario.ativo,
      departamentoId: (usuario as any).departamento?.id ?? (usuario as any).departamentoId ?? null,
      permissoes: JSON.stringify(updateData.permissoes ?? []),
    };
    const mudancas = detectarMudancas(camposAntes, camposDepois);
    if (mudancas.length > 0) {
      for (const m of mudancas) {
        await registrarLog({
          usuarioId: user.id as number,
          acao: 'EDITAR',
          entidade: 'USUARIO',
          entidadeId: usuario.id,
          entidadeNome: usuario.nome,
          campo: m.campo,
          valorAnterior: m.valorAnterior,
          valorNovo: m.valorNovo,
          ip: getIp(request),
        });
      }
    } else {
      // Registra edição mesmo sem mudanças detectáveis (ex: senha alterada)
      if (data.senha) {
        await registrarLog({
          usuarioId: user.id as number,
          acao: 'EDITAR',
          entidade: 'USUARIO',
          entidadeId: usuario.id,
          entidadeNome: usuario.nome,
          campo: 'senha',
          detalhes: 'Senha alterada',
          ip: getIp(request),
        });
      }
    }

    console.timeEnd('PUT /api/usuarios/:id');
    return NextResponse.json(usuario);
  } catch (error: any) {
    console.error('Erro ao atualizar usuário:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Erro ao atualizar usuário' },
      { status: 500 }
    );
  }
}

// DELETE /api/usuarios/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.time('DELETE /api/usuarios/:id');
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    // Apenas ADMIN pode excluir usuários
    if (!requireRole(user, ['ADMIN'])) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const target = await prisma.usuario.findUnique({ where: { id: parseInt(params.id) }, select: { id: true, role: true } });
    if (!target) {
      console.timeEnd('DELETE /api/usuarios/:id');
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Salvar dados do usuário na lixeira (sem senha)
    const targetData = await prisma.usuario.findUnique({
      where: { id: parseInt(params.id) },
      select: { id: true, nome: true, email: true, role: true, departamentoId: true, criadoEm: true, ativo: true }
    });

    if (!targetData) {
      console.timeEnd('DELETE /api/usuarios/:id');
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 15);

    try {
      const dadosOriginais = JSON.parse(JSON.stringify(targetData));
      await prisma.itemLixeira.create({
        data: {
          tipoItem: 'USUARIO',
          itemIdOriginal: targetData.id,
          dadosOriginais,
          departamentoId: targetData.departamentoId || null,
          visibility: 'PUBLIC',
          allowedRoles: [],
          allowedUserIds: [],
          deletadoPorId: user.id as number,
          expiraEm: dataExpiracao,
          nomeItem: targetData.nome,
          descricaoItem: `Usuário ${targetData.email} (${targetData.role})`,
        }
      });
    } catch (e) {
      console.error('Erro ao criar ItemLixeira for usuario:', e);
    }

    // Suporta exclusão permanente via query param ?permanente=1 (apenas ADMIN)
    const url = new URL(request.url);
    const permanente = url.searchParams.get('permanente') === '1' || url.searchParams.get('permanente') === 'true';

    if (permanente) {
      // Não permitir remoção do último admin
      if (String(target.role).toUpperCase() === 'ADMIN') {
        const outrosAdminsAtivos = await prisma.usuario.count({ where: { role: 'ADMIN', ativo: true, id: { not: target.id } } });
        if (outrosAdminsAtivos === 0) {
          console.timeEnd('DELETE /api/usuarios/:id');
          return NextResponse.json({ error: 'Não é possível excluir permanentemente o último administrador ativo.' }, { status: 400 });
        }
      }

      // Tenta excluir permanentemente - limpa registros dependentes primeiro
      try {
        // Remover/desassociar registros que referenciam o usuário
        await Promise.all([
          // Desassociar processos criados e responsáveis (não excluir os processos)
          prisma.processo.updateMany({ where: { criadoPorId: target.id }, data: { criadoPorId: null } }),
          prisma.processo.updateMany({ where: { responsavelId: target.id }, data: { responsavelId: null } }),
          // Excluir comentários do usuário
          prisma.comentario.deleteMany({ where: { autorId: target.id } }),
          // Desassociar histórico de eventos
          prisma.historicoEvento.updateMany({ where: { responsavelId: target.id }, data: { responsavelId: null } }),
          // Excluir respostas de questionários
          prisma.respostaQuestionario.deleteMany({ where: { respondidoPorId: target.id } }),
          // Desassociar templates
          prisma.template.updateMany({ where: { criadoPorId: target.id }, data: { criadoPorId: null } }),
          // Excluir notificações
          prisma.notificacao.deleteMany({ where: { usuarioId: target.id } }),
          // Excluir favoritos
          prisma.processoFavorito.deleteMany({ where: { usuarioId: target.id } }),
          // Excluir códigos de verificação
          prisma.emailVerificationCode.deleteMany({ where: { usuarioId: target.id } }),
          // Desassociar itens da lixeira
          prisma.itemLixeira.deleteMany({ where: { deletadoPorId: target.id } }),
          // Desassociar logs de auditoria
          prisma.logAuditoria.deleteMany({ where: { usuarioId: target.id } }),
        ]);

        await prisma.usuario.delete({ where: { id: target.id } });
        // Audit log: exclusão permanente (registrado com o ID do admin que excluiu)
        try {
          await registrarLog({
            usuarioId: user.id as number,
            acao: 'EXCLUIR',
            entidade: 'USUARIO',
            entidadeId: targetData.id,
            entidadeNome: targetData.nome,
            detalhes: 'Exclusão permanente',
            ip: getIp(request),
          });
        } catch { /* log pode falhar se foi o mesmo usuario */ }
        console.timeEnd('DELETE /api/usuarios/:id');
        return NextResponse.json({ message: 'Usuário excluído permanentemente' });
      } catch (err: any) {
        console.error('Erro ao excluir usuário permanentemente:', err);
        return NextResponse.json({ error: `Erro ao excluir permanentemente: ${err.message || 'ver logs'}` }, { status: 500 });
      }
    }

    // Caso padrão: desativar usuário (soft-delete)
    await prisma.usuario.update({ where: { id: targetData.id }, data: { ativo: false } });

    // Audit log: soft-delete (movido para lixeira)
    await registrarLog({
      usuarioId: user.id as number,
      acao: 'EXCLUIR',
      entidade: 'USUARIO',
      entidadeId: targetData.id,
      entidadeNome: targetData.nome,
      detalhes: 'Movido para lixeira (soft-delete)',
      ip: getIp(request),
    });

    console.timeEnd('DELETE /api/usuarios/:id');
    return NextResponse.json({ message: 'Usuário movido para lixeira e desativado' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir usuário' },
      { status: 500 }
    );
  }
}




