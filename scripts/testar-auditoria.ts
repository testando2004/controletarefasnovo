/**
 * Script de Teste - Sistema de Auditoria
 * 
 * Execute este script para testar o sistema de auditoria
 * Comando: npx ts-node scripts/testar-auditoria.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testarAuditoria() {
  console.log('🔍 Testando Sistema de Auditoria\n');

  try {
    // 1. Buscar um processo existente
    console.log('1️⃣ Buscando processos...');
    const processo = await prisma.processo.findFirst({
      include: {
        empresa: true,
        departamentoAtualRel: true,
      }
    });

    if (!processo) {
      console.log('❌ Nenhum processo encontrado. Crie um processo primeiro!');
      return;
    }

    console.log(`✅ Processo encontrado: #${processo.id} - ${processo.nomeEmpresa}`);
    console.log(`   Departamento atual: ${processo.departamentoAtualRel?.nome || processo.departamentoAtual}\n`);

    // 2. Criar eventos de teste
    console.log('2️⃣ Criando eventos de teste...');

    const eventos = [
      {
        tipo: 'INICIO',
        acao: `🎯 Processo criado para ${processo.nomeEmpresa}`,
        departamento: processo.departamentoAtualRel?.nome || 'Não especificado',
      },
      {
        tipo: 'DOCUMENTO',
        acao: '📎 Documento "Contrato Social.pdf" adicionado',
        departamento: processo.departamentoAtualRel?.nome || 'Não especificado',
      },
      {
        tipo: 'COMENTARIO',
        acao: '💬 Comentário: "Cliente solicitou revisão do prazo"',
        departamento: processo.departamentoAtualRel?.nome || 'Não especificado',
      },
      {
        tipo: 'ALTERACAO',
        acao: '🔄 Prioridade alterada de MEDIA para ALTA',
        departamento: processo.departamentoAtualRel?.nome || 'Não especificado',
      },
    ];

    for (const evento of eventos) {
      const criado = await prisma.historicoEvento.create({
        data: {
          processoId: processo.id,
          tipo: evento.tipo as any,
          acao: evento.acao,
          departamento: evento.departamento,
          dataTimestamp: Date.now(),
        },
      });
      console.log(`   ✅ Evento criado: ${evento.acao}`);
    }

    console.log('');

    // 3. Buscar histórico criado
    console.log('3️⃣ Buscando histórico do processo...');
    const historico = await prisma.historicoEvento.findMany({
      where: {
        processoId: processo.id,
      },
      include: {
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
      orderBy: {
        data: 'desc',
      },
      take: 10,
    });

    console.log(`✅ Encontrados ${historico.length} eventos:\n`);

    historico.forEach((evento, index) => {
      const dataFormatada = new Date(evento.data).toLocaleString('pt-BR');
      const responsavel = evento.responsavel?.nome || 'Sistema';
      console.log(`   ${index + 1}. [${evento.tipo}] ${evento.acao}`);
      console.log(`      👤 ${responsavel} | 📅 ${dataFormatada}`);
      if (evento.departamento) {
        console.log(`      📍 ${evento.departamento}`);
      }
      console.log('');
    });

    // 4. Estatísticas
    console.log('4️⃣ Estatísticas do histórico:');
    const stats = await prisma.historicoEvento.groupBy({
      by: ['tipo'],
      where: {
        processoId: processo.id,
      },
      _count: true,
    });

    stats.forEach((stat) => {
      console.log(`   ${stat.tipo}: ${stat._count} evento(s)`);
    });

    console.log('\n✅ Teste concluído com sucesso!');
    console.log('\n📌 Próximos passos:');
    console.log('   1. Acesse o sistema em http://localhost:3000');
    console.log(`   2. Abra o processo #${processo.id}`);
    console.log('   3. Clique na aba "🕒 Histórico Completo"');
    console.log('   4. Você verá todos os eventos criados!\n');

  } catch (error) {
    console.error('❌ Erro ao testar auditoria:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar teste
testarAuditoria()
  .then(() => {
    console.log('✅ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
