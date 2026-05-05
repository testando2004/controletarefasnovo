import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import bcrypt from 'bcryptjs';
import { generateToken } from '@/app/utils/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email e código são obrigatórios' }, { status: 400 });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    // Busca o código mais recente, ainda não usado e não expirado
    const now = new Date();
    const record = await prisma.emailVerificationCode.findFirst({
      where: { usuarioId: usuario.id, used: false, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) return NextResponse.json({ error: 'Código inválido ou expirado' }, { status: 400 });

    // Verifica tentativas e bloqueio simples
    if (record.attempts >= 5) {
      await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { used: true } });
      return NextResponse.json({ error: 'Muitas tentativas. Novo código necessário.' }, { status: 429 });
    }

    const valid = await bcrypt.compare(String(code), record.codeHash);

    if (!valid) {
      await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
    }

    // Marca como usado
    await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { used: true } });

    // Gera token e envia cookie
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
      },
      token,
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err: any) {
    console.error('Erro em verify-email-code:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
