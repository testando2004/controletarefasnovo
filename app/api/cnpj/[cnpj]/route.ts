import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/utils/routeAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'gru1';

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '');
}

function formatCep(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
  return String(value || '');
}

function formatTelefone(ddd?: unknown, telefone?: unknown) {
  const d = String(ddd || '').replace(/\D/g, '');
  const t = String(telefone || '').replace(/\D/g, '');
  if (!d && !t) return '';
  return `${d}${t}`;
}

async function fetchProvider(url: string) {
  const upstream = await fetch(url, {
    next: { revalidate: 60 * 60 * 24 },
    headers: { Accept: 'application/json' },
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    return { ok: false as const, status: upstream.status, text };
  }

  const data: any = await upstream.json();
  return { ok: true as const, data };
}

// GET /api/cnpj/:cnpj
export async function GET(request: NextRequest, context: { params: Promise<{ cnpj: string }> | { cnpj: string } }) {
  try {
    const { user, error } = await requireAuth(request);
    if (!user) return error;

    const params = await Promise.resolve((context as any).params);
    const cnpj = onlyDigits(params?.cnpj);

    if (cnpj.length !== 14) {
      return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 });
    }

    // 1) BrasilAPI
    const br = await fetchProvider(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (br.ok) {
      const data: any = br.data;
      const response = {
        cnpj,
        razao_social: data?.razao_social ?? '',
        nome_fantasia: data?.nome_fantasia ?? '',
        data_abertura: data?.data_inicio_atividade ?? data?.data_abertura ?? '',
        cep: formatCep(data?.cep ?? ''),
        bairro: data?.bairro ?? '',
        logradouro:
          [data?.descricao_tipo_de_logradouro ?? data?.descricao_tipo_logradouro, data?.logradouro]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          data?.logradouro ||
          '',
        numero: data?.numero ?? '',
        cidade: data?.municipio ?? data?.cidade ?? '',
        estado: data?.uf ?? data?.estado ?? '',
        telefone: String(data?.ddd_telefone_1 ?? data?.telefone ?? ''),
        email: data?.email ?? '',
        situacao: data?.descricao_situacao_cadastral ?? data?.situacao_cadastral ?? undefined,
        provider: 'brasilapi' as const,
      };

      return NextResponse.json(response, {
        headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
      });
    }

    // 2) Fallback: publica.cnpj.ws
    const ws = await fetchProvider(`https://publica.cnpj.ws/cnpj/${cnpj}`);
    if (ws.ok) {
      const data: any = ws.data;
      const est = data?.estabelecimento || {};
      const logradouro = [est?.tipo_logradouro, est?.logradouro].filter(Boolean).join(' ').trim() || est?.logradouro || '';

      const response = {
        cnpj,
        razao_social: data?.razao_social ?? '',
        nome_fantasia: est?.nome_fantasia ?? '',
        data_abertura: est?.data_inicio_atividade ?? '',
        cep: formatCep(est?.cep ?? ''),
        bairro: est?.bairro ?? '',
        logradouro,
        numero: est?.numero ?? '',
        cidade: est?.cidade?.nome ?? '',
        estado: est?.estado?.sigla ?? '',
        telefone: formatTelefone(est?.ddd1, est?.telefone1),
        email: est?.email ?? '',
        situacao: est?.situacao_cadastral ?? undefined,
        provider: 'cnpjws' as const,
      };

      return NextResponse.json(response, {
        headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
      });
    }

    if (br.status === 404 || ws.status === 404) {
      return NextResponse.json({ error: 'CNPJ não encontrado' }, { status: 404 });
    }

    if (br.status === 429 || ws.status === 429) {
      return NextResponse.json(
        {
          error: 'Limite de consultas atingido. Tente novamente em alguns minutos.',
          providerStatus: { brasilapi: br.status, cnpjws: ws.status },
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: `Erro ao consultar CNPJ (BrasilAPI ${br.status}, CNPJ.ws ${ws.status})`,
        details:
          process.env.NODE_ENV !== 'production'
            ? {
                brasilapi: String((br as any).text || '').slice(0, 500) || undefined,
                cnpjws: String((ws as any).text || '').slice(0, 500) || undefined,
              }
            : undefined,
      },
      { status: 502 }
    );
  } catch (err) {
    console.error('Erro ao consultar CNPJ:', err);
    return NextResponse.json({ error: 'Erro ao consultar CNPJ' }, { status: 500 });
  }
}
