/**
 * Script Rápido - Criar Eventos de Teste
 * Execute no console do navegador (F12) quando estiver na página do sistema
 */

// 1. Obter o ID do processo que você está visualizando
// (abra o processo e pegue o ID da URL ou do console)
const processoId = 1; // ⚠️ ALTERE PARA O ID DO SEU PROCESSO

// 2. Criar vários eventos de teste
async function criarEventosTeste() {
  const eventos = [
    {
      tipo: 'INICIO',
      acao: '🎯 Processo criado e iniciado no sistema',
      departamento: 'Comercial'
    },
    {
      tipo: 'DOCUMENTO',
      acao: '📎 Documento "Contrato Social.pdf" foi anexado',
      departamento: 'Comercial'
    },
    {
      tipo: 'COMENTARIO',
      acao: '💬 Comentário adicionado: "Cliente solicitou urgência"',
      departamento: 'Comercial'
    },
    {
      tipo: 'ALTERACAO',
      acao: '🔄 Prioridade alterada de MEDIA para ALTA',
      departamento: 'Comercial'
    },
    {
      tipo: 'MOVIMENTACAO',
      acao: '➡️ Processo movido de Comercial para Fiscal',
      departamento: 'Fiscal'
    },
    {
      tipo: 'DOCUMENTO',
      acao: '📎 Documento "Certidão Negativa.pdf" foi anexado',
      departamento: 'Fiscal'
    },
    {
      tipo: 'CONCLUSAO',
      acao: '✅ Departamento Fiscal concluiu suas atividades',
      departamento: 'Fiscal'
    }
  ];

  console.log('🔄 Criando eventos de teste...');

  for (const evento of eventos) {
    try {
      const response = await fetch('/api/auditoria', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          processoId: processoId,
          tipo: evento.tipo,
          acao: evento.acao,
          departamento: evento.departamento,
          dataTimestamp: Date.now(),
        }),
      });

      if (response.ok) {
        console.log('✅', evento.acao);
      } else {
        console.error('❌ Erro:', evento.acao, await response.text());
      }

      // Pequena pausa entre requests
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error('❌ Erro ao criar evento:', error);
    }
  }

  console.log('\n✅ Eventos criados! Clique na aba "🕒 Histórico Completo" para ver!');
}

// Executar
criarEventosTeste();
