# 🔧 Como Corrigir a DATABASE_URL

## Problema Identificado

Sua URL está usando:
- Host: `aws-1-sa-east-1.pooler.supabase.com` (Connection Pooling)
- Porta: `5432` (Direct Connection) ❌ **INCOMPATÍVEL**

## Solução

Você tem duas opções:

### Opção 1: Usar Connection Pooling (RECOMENDADO) ✅

Se você está usando `pooler.supabase.com`, use a porta **6543**:

```env
DATABASE_URL="postgresql://postgres:SUA_SENHA@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10"
```

**Importante:**
- Usuário deve ser apenas `postgres` (não `postgres.xxx`)
- Porta deve ser `6543`
- Adicione `?pgbouncer=true&connection_limit=10` (evite `1`, pois pode serializar requisições e deixar o app “em fila”)

### Opção 2: Usar Direct Connection

Se você quer usar a porta 5432, mude o host para direct:

```env
DATABASE_URL="postgresql://postgres.xxx:SUA_SENHA@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
```

**Importante:**
- Use o usuário completo `postgres.xxx` (como você tem)
- Porta `5432`
- **NÃO** use `?pgbouncer=true`

## Como Obter a URL Correta do Supabase

1. Acesse https://supabase.com
2. Selecione seu projeto
3. Vá em **Settings** > **Database**
4. Procure por **Connection string** ou **Connection pooling**

### Para Connection Pooling:
- Clique em **Connection pooling**
- Escolha **Transaction mode** (recomendado) ou **Session mode**
- Copie a URL
- Formato será: `postgresql://postgres:[YOUR-PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`

### Para Direct Connection:
- Clique em **Connection string**
- Escolha **URI** ou **JDBC**
- Copie a URL
- Formato será: `postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`

## Verificar Senha

Se a senha estiver incorreta:

1. Vá em **Settings** > **Database** no Supabase
2. Role até **Database password**
3. Clique em **Reset database password**
4. Anote a nova senha
5. Atualize no arquivo `.env`

## Testar a Conexão

Após corrigir, execute:

```bash
npm run testar-conexao
```

Se funcionar, você verá: ✅ Conexão estabelecida com sucesso!

## Exemplo Correto

Para Connection Pooling (recomendado):
```env
DATABASE_URL="postgresql://postgres:minhasenha123@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10"
```

Para Direct Connection:
```env
DATABASE_URL="postgresql://postgres.mhavpkynzyihrcauhpig:minhasenha123@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
```

