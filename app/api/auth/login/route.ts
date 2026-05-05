import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { verifyPassword, generateToken } from '@/app/utils/auth';
import { registrarLog, getIp } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  try {
    const { email, senha } = await request.json();

    if (!email || !senha) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL não está configurada');
      return NextResponse.json(
        {
          error: 'Erro de configuração do servidor',
          details: 'DATABASE_URL não está configurada. Verifique o arquivo .env',
        },
        { status: 500 }
      );
    }

    let usuario;
    try {
      usuario = await prisma.usuario.findUnique({ where: { email } });
    } catch (dbError: any) {
      console.error('Erro ao conectar com o banco de dados:', dbError);

      const dbMessage =
        `${dbError?.message ?? ''} ${dbError?.cause?.message ?? ''}`.trim();

      if (dbMessage.includes('Tenant or user not found')) {
        return NextResponse.json(
          {
            error: 'Erro de conexão com o banco de dados',
            details:
              'O Supabase retornou "Tenant or user not found". Refaça a DATABASE_URL copiando do Supabase Dashboard (Settings > Database > Connection pooling).',
          },
          { status: 503 }
        );
      }

      if (
        dbMessage.includes('Authentication failed') ||
        dbMessage.includes('credentials') ||
        dbError.code === 'P1000'
      ) {
        return NextResponse.json(
          {
            error: 'Erro de conexão com o banco de dados',
            details:
              'Credenciais do banco de dados inválidas. Verifique o arquivo .env.',
          },
          { status: 500 }
        );
      }

      if (dbError.code === 'P1001' || dbMessage.includes('connect')) {
        return NextResponse.json(
          {
            error: 'Erro de conexão com o banco de dados',
            details:
              'Não foi possível conectar ao banco de dados. Verifique se o servidor está acessível.',
          },
          { status: 500 }
        );
      }

      throw dbError;
    }

    if (!usuario || !usuario.ativo) {
      if (usuario) {
        await registrarLog({
          usuarioId: usuario.id,
          acao: 'LOGIN_FALHA',
          entidade: 'USUARIO',
          entidadeId: usuario.id,
          entidadeNome: usuario.nome,
          detalhes: 'Tentativa de login com conta inativa',
          ip: getIp(request),
        });
      }
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    const senhaValida = await verifyPassword(senha, usuario.senha);

    if (!senhaValida) {
      await registrarLog({
        usuarioId: usuario.id,
        acao: 'LOGIN_FALHA',
        entidade: 'USUARIO',
        entidadeId: usuario.id,
        entidadeNome: usuario.nome,
        detalhes: 'Tentativa de login com senha incorreta',
        ip: getIp(request),
      });
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    const token = generateToken({ userId: usuario.id, email: usuario.email, role: usuario.role });

    const response = NextResponse.json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        ativo: usuario.ativo,
        departamentoId: usuario.departamentoId,
        permissoes: usuario.permissoes,
        ...(usuario.isGhost ? { isGhost: true } : {}),
      },
      token,
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    // Criar sessão ativa para rastreamento no painel de controle
    try {
      await prisma.sessaoAtiva.create({
        data: {
          usuarioId: usuario.id,
          token,
          ip: getIp(request) || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (sessaoErr) {
      console.error('Erro ao criar sessão ativa:', sessaoErr);
    }

    await registrarLog({
      usuarioId: usuario.id,
      acao: 'LOGIN',
      entidade: 'USUARIO',
      entidadeId: usuario.id,
      entidadeNome: usuario.nome,
      detalhes: 'Login realizado com sucesso',
      ip: getIp(request),
    });

    return response;
  } catch (error: any) {
    console.error('Erro no login:', error);
    return NextResponse.json(
      {
        error: error.message || 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: error.statusCode || 500 }
    );
  }
}
