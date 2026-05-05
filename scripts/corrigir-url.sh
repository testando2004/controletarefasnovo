#!/bin/bash

echo "🔧 Assistente para corrigir DATABASE_URL"
echo ""
echo "Selecione a opção desejada:"
echo "1) Connection Pooling (porta 6543) - RECOMENDADO"
echo "2) Direct Connection (porta 5432)"
echo ""
read -p "Digite o número da opção (1 ou 2): " opcao

if [ "$opcao" = "1" ]; then
    echo ""
    echo "📝 Configuração para Connection Pooling"
    echo ""
    read -p "Digite a SENHA do banco de dados: " senha
    echo ""
    echo "Gerando URL para Connection Pooling..."
    
    # Usar host pooler com porta 6543
    nova_url="postgresql://postgres:${senha}@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
    
    echo ""
    echo "✅ URL gerada (senha ocultada):"
    echo "${nova_url}" | sed 's/:[^@]*@/:***@/g'
    echo ""
    
    read -p "Deseja atualizar o arquivo .env? (s/n): " confirmar
    
    if [ "$confirmar" = "s" ] || [ "$confirmar" = "S" ]; then
        # Backup do .env
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        echo "✅ Backup criado: .env.backup.*"
        
        # Atualizar DATABASE_URL
        if grep -q "^DATABASE_URL=" .env; then
            # Substituir linha existente
            sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=\"${nova_url}\"|" .env
        else
            # Adicionar nova linha
            echo "DATABASE_URL=\"${nova_url}\"" >> .env
        fi
        
        echo "✅ Arquivo .env atualizado!"
        echo ""
        echo "🧪 Testando conexão..."
        npm run testar-conexao
    fi
    
elif [ "$opcao" = "2" ]; then
    echo ""
    echo "📝 Configuração para Direct Connection"
    echo ""
    read -p "Digite o USUÁRIO completo (ex: postgres.xxx): " usuario
    read -p "Digite a SENHA do banco de dados: " senha
    echo ""
    echo "Gerando URL para Direct Connection..."
    
    # Usar host com porta 5432
    nova_url="postgresql://${usuario}:${senha}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
    
    echo ""
    echo "✅ URL gerada (senha ocultada):"
    echo "${nova_url}" | sed 's/:[^@]*@/:***@/g'
    echo ""
    
    read -p "Deseja atualizar o arquivo .env? (s/n): " confirmar
    
    if [ "$confirmar" = "s" ] || [ "$confirmar" = "S" ]; then
        # Backup do .env
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        echo "✅ Backup criado: .env.backup.*"
        
        # Atualizar DATABASE_URL
        if grep -q "^DATABASE_URL=" .env; then
            # Substituir linha existente
            sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=\"${nova_url}\"|" .env
        else
            # Adicionar nova linha
            echo "DATABASE_URL=\"${nova_url}\"" >> .env
        fi
        
        echo "✅ Arquivo .env atualizado!"
        echo ""
        echo "🧪 Testando conexão..."
        npm run testar-conexao
    fi
else
    echo "❌ Opção inválida!"
    exit 1
fi

