import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { hashPassword } from '@/app/utils/auth';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, novaSenha } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Código de verificação é obrigatório' },
        { status: 400 }
      );
    }

    if (!novaSenha || typeof novaSenha !== 'string' || novaSenha.length < 8) {
      return NextResponse.json(
        { success: false, message: 'A nova senha deve ter pelo menos 8 caracteres' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user by email
    const user = await prisma.usuario.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.ativo) {
      return NextResponse.json(
        { success: false, message: 'Dados inválidos' },
        { status: 400 }
      );
    }

    // Find the most recent unused, non-expired verification code for this user
    const verificationCode = await prisma.emailVerificationCode.findFirst({
      where: {
        usuarioId: user.id,
        used: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) {
      return NextResponse.json(
        { success: false, message: 'Código expirado ou inválido. Solicite um novo código.' },
        { status: 400 }
      );
    }

    // Check max attempts (prevent brute force)
    if (verificationCode.attempts >= 5) {
      // Mark as used so it can't be tried again
      await prisma.emailVerificationCode.update({
        where: { id: verificationCode.id },
        data: { used: true },
      });

      return NextResponse.json(
        { success: false, message: 'Número máximo de tentativas excedido. Solicite um novo código.' },
        { status: 400 }
      );
    }

    // Increment attempts
    await prisma.emailVerificationCode.update({
      where: { id: verificationCode.id },
      data: { attempts: verificationCode.attempts + 1 },
    });

    // Verify the code
    const codeValid = await bcrypt.compare(code.trim(), verificationCode.codeHash);

    if (!codeValid) {
      return NextResponse.json(
        { success: false, message: 'Código inválido' },
        { status: 400 }
      );
    }

    // Hash the new password and update user
    const hashedPassword = await hashPassword(novaSenha);

    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: user.id },
        data: { senha: hashedPassword },
      }),
      prisma.emailVerificationCode.update({
        where: { id: verificationCode.id },
        data: { used: true },
      }),
    ]);

    return NextResponse.json(
      { success: true, message: 'Senha redefinida com sucesso' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro em reset-password:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
