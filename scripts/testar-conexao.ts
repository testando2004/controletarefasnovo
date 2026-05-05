import fs from 'fs';
import dotenv from 'dotenv';
import { lookup } from 'dns/promises';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function carregarEnv() {
  // Next.js carrega .env e .env.local; nossos scripts precisam seguir o mesmo padrão
  const envPath = '.env';
  const envLocalPath = '.env.local';

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
  }
}

async function testarDNS(host: string) {
  try {
    const result = await lookup(host);
    return { ok: true as const, address: result.address };
  } catch (err: any) {
    return { ok: false as const, code: err?.code ?? 'UNKNOWN', message: err?.message ?? String(err) };
  }
}

async function testarConexao() {
  carregarEnv();

  console.log('🔍 Testando conexão com o banco de dados...\n');

  // Verificar se DATABASE_URL está definida
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Erro: DATABASE_URL não está definida no arquivo .env');
    console.log('\n💡 Adicione a seguinte linha no seu arquivo .env:');
    console.log('DATABASE_URL="postgresql://postgres:SUA_SENHA@host:port/database"\n');
    process.exit(1);
  }

  // Mostrar informações da URL (sem senha)
  let parsedUrl: URL | null = null;
  try {
    const url = new URL(databaseUrl.replace(/^postgresql:\/\//, 'http://'));
    parsedUrl = url;
    console.log('📋 Informações da conexão:');
    console.log(`   Host: ${url.hostname}`);
    console.log(`   Porta: ${url.port || '5432'}`);
    console.log(`   Database: ${url.pathname.replace('/', '') || 'postgres'}`);
    console.log(`   Usuário: ${url.username || 'postgres'}`);
    console.log(`   Senha: ${url.password ? '***' : 'não informada'}\n`);
  } catch (e) {
    console.log('⚠️  Não foi possível analisar a URL (formato pode estar incorreto)\n');
  }

  // Diagnóstico rápido de DNS (muito comum em rede corporativa/VPN)
  if (parsedUrl?.hostname) {
    const dnsResult = await testarDNS(parsedUrl.hostname);
    if (!dnsResult.ok) {
      console.error('❌ Problema de DNS ao resolver o host do banco:\n');
      console.error(`   Host: ${parsedUrl.hostname}`);
      console.error(`   Erro: ${dnsResult.code} - ${dnsResult.message}\n`);
      console.log('💡 Isso normalmente acontece por DNS/VPN/Proxy/Firewall. Tente:');
      console.log('   1. Desligar VPN/Proxy corporativo (se houver)');
      console.log('   2. Trocar DNS para 1.1.1.1/1.0.0.1 (Cloudflare) ou 8.8.8.8/8.8.4.4 (Google)');
      console.log('   3. Rodar no PowerShell: ipconfig /flushdns');
      process.exit(1);
    }
  }

  // Tentar conectar
  try {
    console.log('🔌 Tentando conectar...');
    await prisma.$connect();
    console.log('✅ Conexão estabelecida com sucesso!\n');

    // Testar uma query simples
    console.log('🧪 Testando query...');
    const count = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Query executada com sucesso!\n');

    console.log('🎉 Tudo funcionando corretamente!');
  } catch (error: any) {
    console.error('❌ Erro ao conectar com o banco de dados:\n');
    console.error(`   ${error.message}\n`);

    if (error.message?.includes('Tenant or user not found')) {
      console.log('💡 Esse erro é típico do Supabase Pooler quando:');
      console.log('   1. A URL de pooling está apontando para a região errada (host aws-*-<região>.pooler...)');
      console.log('   2. O usuário/senha não batem com o projeto');
      console.log('   3. O projeto foi pausado/removido, ou a rede está alterando a resolução/roteamento\n');
      console.log('✅ Como corrigir de forma garantida:');
      console.log('   - Supabase Dashboard > Settings > Database > Connection string');
      console.log('   - Copie a string de "Connection pooling" (Transaction mode) e cole como DATABASE_URL\n');
    }

    if (error.message?.includes('Authentication failed') || error.code === 'P1000') {
      console.log('💡 O problema é de autenticação. Verifique:');
      console.log('   1. A senha do banco está correta?');
      console.log('   2. O usuário "postgres" está correto?');
      console.log('   3. A URL está no formato correto?\n');
      
      console.log('📝 Formato correto para Supabase Connection Pooling:');
      console.log('DATABASE_URL="postgresql://postgres:SUA_SENHA@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"\n');
      
      console.log('📝 Formato correto para Supabase Direct Connection:');
      console.log('DATABASE_URL="postgresql://postgres:SUA_SENHA@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"\n');
      
      console.log('🔗 Como obter a URL correta:');
      console.log('   1. Acesse https://supabase.com');
      console.log('   2. Vá em Settings > Database');
      console.log('   3. Copie a Connection String');
      console.log('   4. Substitua [YOUR-PASSWORD] pela senha do seu banco\n');
    } else if (error.message?.includes('connect') || error.code === 'P1001') {
      console.log('💡 O problema é de conexão. Verifique:');
      console.log('   1. O host está correto?');
      console.log('   2. A porta está correta? (6543 para pooling, 5432 para direct)');
      console.log('   3. Seu IP está autorizado no Supabase?');
      console.log('   4. Há firewall bloqueando a conexão?\n');
    } else {
      console.log('💡 Dica: Verifique o arquivo .env e certifique-se de que:');
      console.log('   1. A DATABASE_URL está entre aspas');
      console.log('   2. Não há espaços extras');
      console.log('   3. A senha não contém caracteres especiais sem encoding\n');
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testarConexao();

