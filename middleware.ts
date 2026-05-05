import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // ─── Headers de Seguranca ────────────────────────────────
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  // HSTS somente em producao
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  // CSP basico — permite Supabase para storage e inline styles para Tailwind
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseDomain = supabaseUrl ? new URL(supabaseUrl).hostname : '';

  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-eval' 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${supabaseDomain ? `https://${supabaseDomain}` : ''}`.trim(),
    `font-src 'self' data:`,
    `connect-src 'self' ${supabaseDomain ? `https://${supabaseDomain} wss://${supabaseDomain}` : ''}`.trim(),
    `media-src 'self' ${supabaseDomain ? `https://${supabaseDomain}` : ''}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  response.headers.set(
    'Content-Security-Policy',
    cspDirectives.join('; ')
  );

  return response;
}

export const config = {
  matcher: [
    // Aplicar em todas as rotas exceto assets estaticos
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
