import fs from 'fs';
import dotenv from 'dotenv';
import { lookup } from 'dns/promises';

function carregarEnv() {
  const envPath = '.env';
  const envLocalPath = '.env.local';

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
  }
}

async function testarHost(label: string, host: string) {
  try {
    const result = await lookup(host);
    console.log(`✅ ${label}: ${host} -> ${result.address}`);
  } catch (err: any) {
    console.log(`❌ ${label}: ${host}`);
    console.log(`   Erro: ${err?.code ?? 'UNKNOWN'} - ${err?.message ?? String(err)}`);
  }
}

function extrairHostDeDatabaseUrl(databaseUrl: string | undefined) {
  if (!databaseUrl) return null;
  try {
    const url = new URL(databaseUrl.replace(/^postgresql:\/\//, 'http://'));
    return url.hostname || null;
  } catch {
    return null;
  }
}

function extrairProjectRefDeSupabaseUrl(supabaseUrl: string | undefined) {
  if (!supabaseUrl) return null;
  try {
    const url = new URL(supabaseUrl);
    const host = url.hostname; // <ref>.supabase.co
    const parts = host.split('.');
    if (parts.length >= 3 && parts[1] === 'supabase' && parts[2] === 'co') {
      return parts[0];
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  carregarEnv();

  console.log('🔎 Diagnóstico de rede/DNS para Supabase\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const databaseUrl = process.env.DATABASE_URL;
  const projectRef = extrairProjectRefDeSupabaseUrl(supabaseUrl);
  const dbHost = extrairHostDeDatabaseUrl(databaseUrl);

  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      await testarHost('SUPABASE_URL', url.hostname);
    } catch {
      console.log('⚠️  SUPABASE_URL está com formato inválido');
    }
  } else {
    console.log('⚠️  SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL não definida');
  }

  if (projectRef) {
    await testarHost('DB direct (db.<ref>.supabase.co)', `db.${projectRef}.supabase.co`);
  }

  if (dbHost) {
    await testarHost('DATABASE_URL host', dbHost);
  } else {
    console.log('⚠️  DATABASE_URL não definida ou inválida');
  }

  console.log('\n💡 Se aparecer ENOTFOUND/timeout, a correção quase sempre é DNS/VPN/Proxy:');
  console.log('   - Trocar DNS para 1.1.1.1/1.0.0.1 ou 8.8.8.8/8.8.4.4');
  console.log('   - Desligar VPN/Proxy corporativo (se houver)');
  console.log('   - Rodar: ipconfig /flushdns');
}

main().catch((e) => {
  console.error('Falha no diagnóstico:', e);
  process.exit(1);
});
