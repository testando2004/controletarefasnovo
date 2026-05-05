'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SsoPage() {
  return (
    <Suspense fallback={<SsoLoading />}>
      <SsoExchange />
    </Suspense>
  );
}

function SsoLoading() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f4f6',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 48,
            height: 48,
            border: '4px solid #e5e7eb',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'sso-spin 0.8s linear infinite',
          }}
        />
        <p style={{ color: '#6b7280', fontSize: 14 }}>Carregando...</p>
        <style>{`@keyframes sso-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function SsoExchange() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams?.get('token') ?? null;
    const redirect = searchParams?.get('redirect') || '/';

    if (!token) {
      setErro('Link de acesso invalido');
      setDetalhes('Token SSO ausente na URL.');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/sso/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          credentials: 'include',
        });

        const data = await res.json().catch(() => ({} as any));

        if (cancelled) return;

        if (!res.ok) {
          setErro(data?.error || 'Falha ao validar acesso');
          setDetalhes(data?.details || null);
          return;
        }

        const safeRedirect = redirect.startsWith('/') ? redirect : '/';
        window.location.replace(safeRedirect);
      } catch (e: any) {
        if (cancelled) return;
        setErro('Erro de conexao com o servidor');
        setDetalhes(e?.message || null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (erro) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#f3f4f6',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            background: 'white',
            borderRadius: 12,
            padding: 32,
            boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 48,
              marginBottom: 12,
              color: '#dc2626',
            }}
          >
            ⚠
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: '#111827' }}>
            {erro}
          </h1>
          {detalhes && (
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24, lineHeight: 1.5 }}>
              {detalhes}
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="/"
              style={{
                padding: '10px 20px',
                background: '#2563eb',
                color: 'white',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Ir para o login do Tarefas
            </a>
            <a
              href={`${process.env.NEXT_PUBLIC_EMPRESAS_URL || 'https://controle-empresas.vercel.app'}/dashboard`}
              style={{
                padding: '10px 20px',
                background: '#e5e7eb',
                color: '#111827',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Voltar para Empresas
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f4f6',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 48,
            height: 48,
            border: '4px solid #e5e7eb',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'sso-spin 0.8s linear infinite',
          }}
        />
        <p style={{ color: '#6b7280', fontSize: 14 }}>Conectando ao Controle de Tarefas...</p>
        <style>{`
          @keyframes sso-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
