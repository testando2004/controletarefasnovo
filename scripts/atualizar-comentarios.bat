@echo off
echo 🔄 Atualizando banco de dados para suportar respostas em comentários...
echo.

REM Gerar a migration
echo 📝 Gerando migration...
call npx prisma migrate dev --name adicionar-respostas-comentarios

REM Gerar o Prisma Client
echo ⚡ Gerando Prisma Client...
call npx prisma generate

echo.
echo ✅ Banco de dados atualizado com sucesso!
echo.
echo Agora o sistema suporta:
echo   ✅ Respostas aninhadas em comentários
echo   ✅ Threads de conversas
echo   ✅ Campo parentId disponível
echo.
echo 🎉 Pronto para usar!
pause
