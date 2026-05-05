import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/app/utils/prisma';
import { generateToken } from '@/app/utils/auth';
import { registrarLog, getIp } from '@/app/utils/logAuditoria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';
export const fetchCache = 'force-no-store';

function b64urlDecode(s: string): Buffer {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return Buffer.from(t, 'base64');
}

type SsoVerification =
  | { ok: true; payload: { email?: string; iat?: number; exp?: number; nonce?: string; source?: string } }
  | { ok: false; error: string };

function verifySsoToken(token: string, secret: string): SsoVerification {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, error: 'Formato de token invalido' };
  const [payloadB64, sigB64] = parts;

  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  let providedSig: Buffer;
  try {
    providedSig = b64urlDecode(sigB64);
  } catch {
    return { ok: false, error: 'Assinatura invalida' };
  }

  if (expectedSig.length !== providedSig.length) return { ok: false, error: 'Assinatura invalida' };
  if (!crypto.timingSafeEqual(expectedSig, providedSig)) return { ok: false, error: 'Assinatura invalida' };

  let payload: any;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
  } catch {
    return { ok: false, error: 'Payload invalido' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) {
    return { ok: false, error: 'Token expirado' };
  }
  if (typeof payload.iat !== 'number' || payload.iat > now + 60) {
    return { ok: false, error: 'Token invalido (iat futuro)' };
  }
  if (now - payload.iat > 300) {
    return { ok: false, error: 'Token muito antigo' };
  }

  return { ok: true, payload };
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.SSO_SHARED_SECRET;
    if (!secret) {
      console.error('[SSO] SSO_SHARED_SECRET nao configurado');
      return NextResponse.json(
        { error: 'SSO nao configurado neste servidor' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({} as any));
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!token) {
      return NextResponse.json({ error: 'Token SSO obrigatorio' }, { status: 400 });
    }

    const verification = verifySsoToken(token, secret);
    if (!verification.ok) {
      return NextResponse.json({ error: verification.error }, { status: 401 });
    }

    const email = String(verification.payload.email || '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Email ausente no token' }, { status: 400 });
    }

    // Lookup case-insensitive — o email do controle-empresas vem em lowercase,
    // mas no Tarefas o email pode ter sido cadastrado com maiúsculas
    // ("Maria@triar.com"). Sem `mode: 'insensitive'` o findUnique falha.
    const usuario = await prisma.usuario.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!usuario) {
      return NextResponse.json(
        {
          error: 'Usuario nao encontrado no Controle de Tarefas',
          details: `O email ${email} nao tem cadastro no sistema de Tarefas. Solicite ao administrador para criar o acesso.`,
        },
        { status: 404 }
      );
    }

    if (!usuario.ativo) {
      return NextResponse.json(
        { error: 'Usuario inativo no Controle de Tarefas' },
        { status: 403 }
      );
    }

    const jwtToken = generateToken({
      userId: usuario.id,
      email: usuario.email,
      role: usuario.role,
    });

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
      token: jwtToken,
    });

    response.cookies.set('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    try {
      await prisma.sessaoAtiva.create({
        data: {
          usuarioId: usuario.id,
          token: jwtToken,
          ip: getIp(request) || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (sessaoErr) {
      console.error('[SSO] Erro ao criar sessao ativa:', sessaoErr);
    }

    try {
      await registrarLog({
        usuarioId: usuario.id,
        acao: 'LOGIN',
        entidade: 'USUARIO',
        entidadeId: usuario.id,
        entidadeNome: usuario.nome,
        detalhes: 'Login via SSO (Controle-Empresas)',
        ip: getIp(request),
      });
    } catch (logErr) {
      console.error('[SSO] Erro ao registrar log:', logErr);
    }

    return response;
  } catch (error: any) {
    console.error('[SSO] Erro no exchange:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno no SSO' },
      { status: 500 }
    );
  }
}
