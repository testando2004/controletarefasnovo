import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function limparBanco() {
  console.log('🗑️  Limpando TODOS os dados do banco...\n');

  // TRUNCATE com CASCADE remove tudo respeitando foreign keys
  // RESTART IDENTITY reseta os IDs (autoincrement) para 1
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "Usuario",
      "Departamento",
      "Empresa",
      "EmpresaDocumento",
      "Processo",
      "Tag",
      "ProcessoTag",
      "Comentario",
      "Documento",
      "DocumentoObrigatorio",
      "QuestionarioDepartamento",
      "RespostaQuestionario",
      "HistoricoEvento",
      "HistoricoFluxo",
      "Template",
      "Notificacao",
      "EventoCalendario",
      "ItemLixeira",
      "ProcessoFavorito",
      "EmailVerificationCode",
      "LogAuditoria",
      "InterligacaoProcesso",
      "ChecklistDepartamento",
      "MotivoExclusao"
    RESTART IDENTITY CASCADE;
  `);

  console.log('✅ Todas as tabelas foram limpas!');
  console.log('   - Todos os registros removidos');
  console.log('   - IDs resetados para 1');
  console.log('   - Estrutura das tabelas mantida\n');

  // Verificar se ficou vazio
  const usuarios = await prisma.usuario.count();
  const processos = await prisma.processo.count();
  const empresas = await prisma.empresa.count();
  console.log(`📊 Verificação: ${usuarios} usuários, ${processos} processos, ${empresas} empresas`);
}

limparBanco()
  .catch((e) => {
    console.error('❌ Erro ao limpar banco:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
