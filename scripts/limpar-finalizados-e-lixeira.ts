import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const confirmar = process.argv.includes('--confirm');

  const finalizados = await prisma.processo.count({ where: { status: 'FINALIZADO' } });
  const lixeiraProcessos = await prisma.itemLixeira.count({ where: { tipoItem: 'PROCESSO' } });
  const projetos = await prisma.projeto.count();

  console.log('\n📊 Contagem atual:');
  console.log(`   • Processos FINALIZADOS: ${finalizados}`);
  console.log(`   • Itens na Lixeira (PROCESSO): ${lixeiraProcessos}`);
  console.log(`   • Projetos (todos): ${projetos}`);
  console.log(`   • Total a remover: ${finalizados + lixeiraProcessos + projetos}\n`);

  console.log('🔒 Preservados (não serão tocados):');
  const empresas = await prisma.empresa.count();
  const usuarios = await prisma.usuario.count();
  const templates = await prisma.template.count();
  const emAndamento = await prisma.processo.count({ where: { status: 'EM_ANDAMENTO' } });
  const pausados = await prisma.processo.count({ where: { status: 'PAUSADO' } });
  console.log(`   • Empresas: ${empresas}`);
  console.log(`   • Usuários: ${usuarios}`);
  console.log(`   • Templates (solicitações): ${templates}`);
  console.log(`   • Processos EM_ANDAMENTO: ${emAndamento}`);
  console.log(`   • Processos PAUSADOS: ${pausados}\n`);

  if (!confirmar) {
    console.log('ℹ️  Modo dry-run (apenas leitura). Nenhum dado foi alterado.');
    console.log('   Para executar a remoção, rode novamente passando --confirm\n');
    return;
  }

  console.log('⚠️  Executando remoção...\n');

  const delFinalizados = await prisma.processo.deleteMany({ where: { status: 'FINALIZADO' } });
  console.log(`   ✅ Processos FINALIZADOS removidos: ${delFinalizados.count}`);
  console.log('      (relacionados — comentários, documentos, questionários, histórico, tags, favoritos — também removidos via cascade)');

  const delLixeira = await prisma.itemLixeira.deleteMany({ where: { tipoItem: 'PROCESSO' } });
  console.log(`   ✅ Itens da Lixeira (PROCESSO) removidos: ${delLixeira.count}`);

  const delProjetos = await prisma.projeto.deleteMany({});
  console.log(`   ✅ Projetos removidos: ${delProjetos.count}\n`);

  const finalizadosDepois = await prisma.processo.count({ where: { status: 'FINALIZADO' } });
  const lixeiraDepois = await prisma.itemLixeira.count({ where: { tipoItem: 'PROCESSO' } });
  const projetosDepois = await prisma.projeto.count();
  console.log('📊 Contagem após remoção:');
  console.log(`   • Processos FINALIZADOS: ${finalizadosDepois}`);
  console.log(`   • Itens na Lixeira (PROCESSO): ${lixeiraDepois}`);
  console.log(`   • Projetos: ${projetosDepois}\n`);
  console.log('✅ Concluído.');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
