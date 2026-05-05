import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { requireAuth } from '@/app/utils/routeAuth';
import { hashPassword } from '@/app/utils/auth';
import { uploadFile } from '@/app/utils/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

function jsonBigInt(data: unknown, init?: { status?: number }) {
  return new NextResponse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ),
    {
      status: init?.status ?? 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    }
  );
}

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

async function resolveRestoredPasswordHash(rawPassword: unknown): Promise<string> {
  const password = typeof rawPassword === 'string' ? rawPassword.trim() : '';
  if (password) {
    return isBcryptHash(password) ? password : hashPassword(password);
  }

  // Quando a lixeira não possui senha original, cria senha temporária e armazena somente o hash.
  const temporaryPassword = `restored-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return hashPassword(temporaryPassword);
}

// Verifica se usuário pode ver item na lixeira
function usuarioPodeVerItem(item: any, userId: number, userRole: string): boolean {
  const vis = String(item.visibility || 'PUBLIC').toUpperCase();
  const allowedRoles: string[] = Array.isArray(item.allowedRoles) 
    ? item.allowedRoles.map((r: any) => String(r).toUpperCase()) 
    : [];
  const allowedUserIds: number[] = Array.isArray(item.allowedUserIds) 
    ? item.allowedUserIds.map((n: any) => Number(n)) 
    : [];

  if (item.deletadoPorId === userId) return true;
  if (userRole === 'ADMIN' || userRole === 'ADMIN_DEPARTAMENTO') return true;
  if (vis === 'PUBLIC') return true;
  if (vis === 'ROLES') {
    if (allowedRoles.length === 0) return false;
    return allowedRoles.includes(userRole);
  }
  if (vis === 'USERS') {
    if (allowedUserIds.length === 0) return false;
    return allowedUserIds.includes(userId);
  }
  
  return false;
}

// GET /api/lixeira/:id - Detalhes de um item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const itemId = parseInt(params.id);
    const userId = Number(user.id);
    const userRole = String((user as any).role || '').toUpperCase();

    const item = await prisma.itemLixeira.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return jsonBigInt({ error: 'Item não encontrado na lixeira' }, { status: 404 });
    }

    if (!usuarioPodeVerItem(item, userId, userRole)) {
      return jsonBigInt({ error: 'Sem permissão para ver este item' }, { status: 403 });
    }

    const agora = new Date();
    const diasRestantes = Math.max(0, Math.ceil((new Date(item.expiraEm).getTime() - agora.getTime()) / (1000 * 60 * 60 * 24)));

    return jsonBigInt({ ...item, diasRestantes });
  } catch (error) {
    console.error('Erro ao buscar item da lixeira:', error);
    return jsonBigInt({ error: 'Erro ao buscar item' }, { status: 500 });
  }
}

// POST /api/lixeira/:id - Restaurar item
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const itemId = parseInt(params.id);
    const userId = Number(user.id);
    const userRole = String((user as any).role || '').toUpperCase();

    const item = await prisma.itemLixeira.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return jsonBigInt({ error: 'Item não encontrado na lixeira' }, { status: 404 });
    }

    if (!usuarioPodeVerItem(item, userId, userRole)) {
      return jsonBigInt({ error: 'Sem permissão para restaurar este item' }, { status: 403 });
    }

    // Verificar se não expirou
    if (new Date(item.expiraEm) < new Date()) {
      return jsonBigInt({ error: 'Item expirado e não pode mais ser restaurado' }, { status: 410 });
    }

    const dadosOriginais = item.dadosOriginais as any;

    // Restaurar baseado no tipo
    if (item.tipoItem === 'DOCUMENTO') {
      // Verificar se o processo ainda existe
      if (item.processoId) {
        const processoExiste = await prisma.processo.findUnique({
          where: { id: item.processoId },
          select: { id: true },
        });
        if (!processoExiste) {
          return jsonBigInt({ 
            error: 'O processo ao qual este documento pertencia foi excluído' 
          }, { status: 400 });
        }
      }

      // Recriar documento
      const documento = await prisma.documento.create({
        data: {
          processoId: dadosOriginais.processoId,
          nome: dadosOriginais.nome,
          tipo: dadosOriginais.tipo,
          tipoCategoria: dadosOriginais.tipoCategoria || null,
          tamanho: BigInt(dadosOriginais.tamanho || 0),
          url: dadosOriginais.url || '',
          path: dadosOriginais.path || null,
          departamentoId: dadosOriginais.departamentoId || null,
          perguntaId: dadosOriginais.perguntaId || null,
          dataUpload: dadosOriginais.dataUpload ? new Date(dadosOriginais.dataUpload) : new Date(),
          uploadPorId: dadosOriginais.uploadPorId || null,
          visibility: dadosOriginais.visibility || 'PUBLIC',
          allowedRoles: dadosOriginais.allowedRoles || [],
          allowedUserIds: dadosOriginais.allowedUserIds || [],
        },
      });

      // Criar evento de restauração
      if (item.processoId) {
        await prisma.historicoEvento.create({
          data: {
            processoId: item.processoId,
            tipo: 'DOCUMENTO',
            acao: `Documento "${dadosOriginais.nome}" restaurado da lixeira`,
            responsavelId: userId,
            dataTimestamp: BigInt(Date.now()),
          },
        });
      }

      // Remover da lixeira
      await prisma.itemLixeira.delete({ where: { id: itemId } });

      return jsonBigInt({ 
        message: 'Documento restaurado com sucesso',
        tipo: 'DOCUMENTO',
        itemRestaurado: documento,
      });

    } else if (item.tipoItem === 'PROCESSO') {
      // Verificar se a empresa ainda existe (se tinha)
      if (dadosOriginais.empresaId) {
        const empresaExiste = await prisma.empresa.findUnique({
          where: { id: dadosOriginais.empresaId },
          select: { id: true },
        });
        if (!empresaExiste) {
          dadosOriginais.empresaId = null;
        }
      }

      // Recriar processo com TODOS os dados
      const processo = await prisma.processo.create({
        data: {
          nome: dadosOriginais.nome || null,
          nomeServico: dadosOriginais.nomeServico || null,
          nomeEmpresa: dadosOriginais.nomeEmpresa || 'Empresa Restaurada',
          cliente: dadosOriginais.cliente || null,
          email: dadosOriginais.email || null,
          telefone: dadosOriginais.telefone || null,
          empresaId: dadosOriginais.empresaId || null,
          status: dadosOriginais.status || 'EM_ANDAMENTO',
          prioridade: dadosOriginais.prioridade || 'MEDIA',
          departamentoAtual: dadosOriginais.departamentoAtual,
          departamentoAtualIndex: dadosOriginais.departamentoAtualIndex || 0,
          fluxoDepartamentos: dadosOriginais.fluxoDepartamentos || [],
          descricao: dadosOriginais.descricao || null,
          notasCriador: dadosOriginais.notasCriador || null,
          criadoPorId: dadosOriginais.criadoPorId || null,
          responsavelId: dadosOriginais.responsavelId || null,
          dataInicio: dadosOriginais.dataInicio ? new Date(dadosOriginais.dataInicio) : null,
          dataEntrega: dadosOriginais.dataEntrega ? new Date(dadosOriginais.dataEntrega) : null,
          progresso: dadosOriginais.progresso || 0,
        },
      });

      // Restaurar tags
      if (dadosOriginais.tags && Array.isArray(dadosOriginais.tags)) {
        for (const tagData of dadosOriginais.tags) {
          if (tagData.tagId) {
            // Verificar se a tag ainda existe
            const tagExiste = await prisma.tag.findUnique({
              where: { id: tagData.tagId },
            });
            if (tagExiste) {
              await (prisma as any).processoTag.create({
                data: {
                  processoId: processo.id,
                  tagId: tagData.tagId,
                },
              }).catch(() => {}); // Ignorar se já existir
            }
          }
        }
      }

      // Mapeamento de IDs antigos para novos dos questionários
      const questionarioIdMap = new Map<number, number>();

      // Restaurar questionários vinculados ao processo
      if (dadosOriginais.questionarios && Array.isArray(dadosOriginais.questionarios)) {
        for (const questionario of dadosOriginais.questionarios) {
          try {
            const novoQuestionario = await (prisma as any).questionarioDepartamento.create({
              data: {
                processoId: processo.id,
                departamentoId: questionario.departamentoId,
                label: questionario.label,
                tipo: questionario.tipo,
                obrigatorio: questionario.obrigatorio || false,
                ordem: questionario.ordem || 0,
                opcoes: questionario.opcoes || [],
                placeholder: questionario.placeholder || null,
                descricao: questionario.descricao || null,
                condicaoPerguntaId: questionario.condicaoPerguntaId || null,
                condicaoOperador: questionario.condicaoOperador || null,
                condicaoValor: questionario.condicaoValor || null,
              },
            });
            // Mapear ID antigo para novo (se tiver)
            if (questionario.id) {
              questionarioIdMap.set(questionario.id, novoQuestionario.id);
            }
          } catch (err: any) {
            console.log('Erro ao restaurar questionário:', err.message);
          }
        }
      }

      // Restaurar respostas do questionário
      if (dadosOriginais.respostasQuestionario && Array.isArray(dadosOriginais.respostasQuestionario)) {
        for (const resposta of dadosOriginais.respostasQuestionario) {
          // Primeiro tenta usar o mapeamento de IDs novos
          let questionarioIdParaUsar = questionarioIdMap.get(resposta.questionarioId);
          
          // Se não encontrou no mapa, verifica se o questionário original ainda existe
          if (!questionarioIdParaUsar) {
            const questionarioExiste = await (prisma as any).questionarioDepartamento.findUnique({
              where: { id: resposta.questionarioId },
            });
            if (questionarioExiste) {
              questionarioIdParaUsar = resposta.questionarioId;
            }
          }

          if (questionarioIdParaUsar) {
            await prisma.respostaQuestionario.create({
              data: {
                processoId: processo.id,
                questionarioId: questionarioIdParaUsar,
                resposta: resposta.resposta,
                respondidoPorId: resposta.respondidoPorId,
                respondidoEm: resposta.respondidoEm ? new Date(resposta.respondidoEm) : new Date(),
              },
            }).catch((err: any) => {
              console.log('Erro ao restaurar resposta questionário:', err.message);
            });
          }
        }
      }

      // Restaurar comentários
      if (dadosOriginais.comentarios && Array.isArray(dadosOriginais.comentarios)) {
        for (const comentario of dadosOriginais.comentarios) {
          await prisma.comentario.create({
            data: {
              processoId: processo.id,
              texto: comentario.conteudo || comentario.texto || '',
              autorId: comentario.autorId,
              departamentoId: comentario.departamentoId || null,
              criadoEm: comentario.criadoEm ? new Date(comentario.criadoEm) : new Date(),
              mencoes: comentario.mencoes || [],
            },
          }).catch((err: any) => {
            console.log('Erro ao restaurar comentário:', err.message);
          });
        }
      }

      // Restaurar histórico de eventos
      if (dadosOriginais.historicoEventos && Array.isArray(dadosOriginais.historicoEventos)) {
        for (const evento of dadosOriginais.historicoEventos) {
          await prisma.historicoEvento.create({
            data: {
              processoId: processo.id,
              tipo: evento.tipo,
              acao: evento.acao,
              responsavelId: evento.responsavelId || null,
              departamento: evento.departamento || null,
              data: evento.data ? new Date(evento.data) : new Date(),
              dataTimestamp: evento.dataTimestamp ? BigInt(evento.dataTimestamp) : BigInt(Date.now()),
            },
          }).catch((err: any) => {
            console.log('Erro ao restaurar histórico evento:', err.message);
          });
        }
      }

      // Restaurar histórico de fluxo
      if (dadosOriginais.historicoFluxos && Array.isArray(dadosOriginais.historicoFluxos)) {
        for (const fluxo of dadosOriginais.historicoFluxos) {
          await prisma.historicoFluxo.create({
            data: {
              processoId: processo.id,
              departamentoId: fluxo.departamentoDestinoId || fluxo.departamentoId, // tenta usar destino, senão id direto
              ordem: fluxo.ordem ?? 0,
              status: fluxo.status || 'em_andamento',
              entradaEm: fluxo.entradaEm ? new Date(fluxo.entradaEm) : new Date(),
              saidaEm: fluxo.saidaEm ? new Date(fluxo.saidaEm) : null,
            },
          }).catch((err: any) => {
            console.log('Erro ao restaurar histórico fluxo:', err.message);
          });
        }
      }

      // Restaurar documentos
      if (dadosOriginais.documentos && Array.isArray(dadosOriginais.documentos)) {
        for (const doc of dadosOriginais.documentos) {
          await prisma.documento.create({
            data: {
              processoId: processo.id,
              nome: doc.nome,
              tipo: doc.tipo,
              tipoCategoria: doc.tipoCategoria || null,
              tamanho: doc.tamanho ? BigInt(doc.tamanho) : BigInt(0),
              url: doc.url || '',
              path: doc.path || null,
              departamentoId: doc.departamentoId || null,
              perguntaId: doc.perguntaId || null,
              dataUpload: doc.dataUpload ? new Date(doc.dataUpload) : new Date(),
              uploadPorId: doc.uploadPorId || null,
              visibility: doc.visibility || 'PUBLIC',
              allowedRoles: doc.allowedRoles || [],
              allowedUserIds: doc.allowedUserIds || [],
            },
          }).catch((err: any) => {
            console.log('Erro ao restaurar documento:', err.message);
          });
        }
      }

      // Criar evento de restauração
      await prisma.historicoEvento.create({
        data: {
          processoId: processo.id,
          tipo: 'ALTERACAO',
          acao: 'Processo restaurado da lixeira',
          responsavelId: userId,
          dataTimestamp: BigInt(Date.now()),
        },
      });

      // Remover da lixeira
      await prisma.itemLixeira.delete({ where: { id: itemId } });

      return jsonBigInt({ 
        message: 'Processo restaurado com sucesso',
        tipo: 'PROCESSO',
        itemRestaurado: processo,
      });
    }

    // Restaurar departamento (soft-deleted)
    else if (item.tipoItem === 'DEPARTAMENTO') {
      // Tenta reativar departamento existente
      const deptId = item.itemIdOriginal;
      let departamentoRestaurado: any = null;
      const existing = await prisma.departamento.findUnique({ where: { id: deptId } });
      if (existing) {
        departamentoRestaurado = await prisma.departamento.update({
          where: { id: deptId },
          data: {
            ativo: true,
            nome: dadosOriginais.nome,
            descricao: dadosOriginais.descricao || null,
            responsavel: dadosOriginais.responsavel || null,
            cor: dadosOriginais.cor || undefined,
            icone: dadosOriginais.icone || null,
            ordem: typeof dadosOriginais.ordem === 'number' ? dadosOriginais.ordem : existing.ordem,
          },
        });
      } else {
        // Cria novo departamento com os dados
        departamentoRestaurado = await prisma.departamento.create({
          data: {
            nome: dadosOriginais.nome,
            descricao: dadosOriginais.descricao || null,
            responsavel: dadosOriginais.responsavel || null,
            cor: dadosOriginais.cor || undefined,
            icone: dadosOriginais.icone || null,
            ativo: true,
            ordem: typeof dadosOriginais.ordem === 'number' ? dadosOriginais.ordem : 0,
          },
        });
      }

      await prisma.itemLixeira.delete({ where: { id: itemId } });
      return jsonBigInt({ message: 'Departamento restaurado com sucesso', tipo: 'DEPARTAMENTO', itemRestaurado: departamentoRestaurado });
    }

    // Restaurar comentário
    else if (item.tipoItem === 'COMENTARIO') {
      const comentarioCriado = await prisma.comentario.create({
        data: {
          processoId: dadosOriginais.processoId,
          texto: dadosOriginais.texto || dadosOriginais.conteudo || '',
          autorId: dadosOriginais.autorId,
          departamentoId: dadosOriginais.departamentoId || null,
          parentId: dadosOriginais.parentId || null,
          criadoEm: dadosOriginais.criadoEm ? new Date(dadosOriginais.criadoEm) : new Date(),
          mencoes: Array.isArray(dadosOriginais.mencoes) ? dadosOriginais.mencoes : [],
        }
      }).catch((err: any) => {
        console.error('Erro ao recriar comentario ao restaurar lixeira:', err);
        throw err;
      });

      await prisma.itemLixeira.delete({ where: { id: itemId } });
      return jsonBigInt({ message: 'Comentário restaurado com sucesso', tipo: 'COMENTARIO', itemRestaurado: comentarioCriado });
    }

    // Restaurar usuário (reativar ou recriar)
    else if (item.tipoItem === 'USUARIO') {
      const userIdOrig = item.itemIdOriginal;
      let usuarioRestaurado: any = null;
      const existente = await prisma.usuario.findUnique({ where: { id: userIdOrig } });
      if (existente) {
        usuarioRestaurado = await prisma.usuario.update({
          where: { id: userIdOrig },
          data: {
            ativo: true,
            nome: dadosOriginais.nome || existente.nome,
            email: dadosOriginais.email || existente.email,
            role: (dadosOriginais.role as any) || existente.role,
            departamentoId: dadosOriginais.departamentoId || existente.departamentoId || null,
            permissoes: Array.isArray(dadosOriginais.permissoes) ? dadosOriginais.permissoes : existente.permissoes,
          },
        });
      } else {
        const senhaHash = await resolveRestoredPasswordHash(dadosOriginais.senha);
        usuarioRestaurado = await prisma.usuario.create({
          data: {
            nome: dadosOriginais.nome,
            email: dadosOriginais.email,
            senha: senhaHash,
            role: (dadosOriginais.role as any) || 'USUARIO',
            departamentoId: dadosOriginais.departamentoId || null,
            ativo: true,
            permissoes: Array.isArray(dadosOriginais.permissoes) ? dadosOriginais.permissoes : [],
          },
        });
      }

      await prisma.itemLixeira.delete({ where: { id: itemId } });
      return jsonBigInt({ message: 'Usuário restaurado com sucesso', tipo: 'USUARIO', itemRestaurado: usuarioRestaurado });
    }

    // Outros tipos podem ser implementados conforme necessário

    return jsonBigInt({ error: 'Tipo de item não suportado' }, { status: 400 });

  } catch (error) {
    console.error('Erro ao restaurar item:', error);
    return jsonBigInt({ error: 'Erro ao restaurar item' }, { status: 500 });
  }
}

// DELETE /api/lixeira/:id - Excluir permanentemente
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const itemId = parseInt(params.id);
    const userId = Number(user.id);
    const userRole = String((user as any).role || '').toUpperCase();

    const item = await prisma.itemLixeira.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return jsonBigInt({ error: 'Item não encontrado na lixeira' }, { status: 404 });
    }

    if (!usuarioPodeVerItem(item, userId, userRole)) {
      return jsonBigInt({ error: 'Sem permissão para excluir este item' }, { status: 403 });
    }

    // Apenas admin ou quem deletou pode excluir permanentemente
    if (userRole !== 'ADMIN' && userRole !== 'ADMIN_DEPARTAMENTO' && item.deletadoPorId !== userId) {
      return jsonBigInt({ 
        error: 'Apenas administradores ou quem excluiu o item pode deletar permanentemente' 
      }, { status: 403 });
    }

    // Excluir permanentemente
    await prisma.itemLixeira.delete({ where: { id: itemId } });

    return jsonBigInt({ 
      message: 'Item excluído permanentemente',
      tipoItem: item.tipoItem,
      nomeItem: item.nomeItem,
    });

  } catch (error) {
    console.error('Erro ao excluir item permanentemente:', error);
    return jsonBigInt({ error: 'Erro ao excluir item' }, { status: 500 });
  }
}
