import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/utils/prisma';
import { deleteFile } from '@/app/utils/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'gru1';

/**
 * Endpoint de limpeza automática da lixeira
 * Pode ser chamado por um cron job ou manualmente
 * 
 * GET /api/lixeira/cleanup - Executa a limpeza de itens expirados
 * 
 * Segurança: Este endpoint pode ser protegido por uma chave API
 * Configure LIXEIRA_CLEANUP_KEY no .env para habilitar proteção
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar chave de segurança se configurada
    const cleanupKey = process.env.LIXEIRA_CLEANUP_KEY;
    if (cleanupKey) {
      const authHeader = request.headers.get('x-cleanup-key');
      if (authHeader !== cleanupKey) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
      }
    }

    const agora = new Date();
    
    // Buscar itens expirados
    const itensExpirados = await prisma.itemLixeira.findMany({
      where: {
        expiraEm: { lte: agora },
      },
    });

    let itensRemovidos = 0;
    let arquivosRemovidos = 0;
    const erros: string[] = [];

    // Processar cada item expirado
    for (const item of itensExpirados) {
      try {
        // Se for documento, tentar excluir arquivo do storage
        if (item.tipoItem === 'DOCUMENTO') {
          const dados = item.dadosOriginais as any;
          if (dados?.path) {
            try {
              await deleteFile(dados.path);
              arquivosRemovidos++;
            } catch (err) {
              console.error(`Erro ao excluir arquivo ${dados.path}:`, err);
              erros.push(`Falha ao excluir arquivo: ${dados.path}`);
              // Continua mesmo se falhar a exclusão do arquivo
            }
          }
        }

        // Excluir registro da lixeira
        await prisma.itemLixeira.delete({
          where: { id: item.id },
        });
        
        itensRemovidos++;
      } catch (err) {
        console.error(`Erro ao processar item ${item.id}:`, err);
        erros.push(`Falha ao processar item ID ${item.id}`);
      }
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Limpeza da lixeira concluída',
      itensExpirados: itensExpirados.length,
      itensRemovidos,
      arquivosRemovidos,
      erros: erros.length > 0 ? erros : undefined,
      executadoEm: agora.toISOString(),
    });

  } catch (error) {
    console.error('Erro na limpeza automática da lixeira:', error);
    return NextResponse.json(
      { error: 'Erro na limpeza da lixeira' },
      { status: 500 }
    );
  }
}
