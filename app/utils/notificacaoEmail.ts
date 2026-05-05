import { prisma } from '@/app/utils/prisma';
import { sendEmail } from '@/app/utils/email';

interface NotificarDepartamentoArgs {
  processoId: number;
  departamentoId: number;
  departamentoNome: string;
  empresaNome: string;
  servicoNome?: string | null;
  responsavelAnteriorNome?: string | null;
  appUrl?: string | null;
}

const NOTIFICACAO_EMAIL_THROTTLE_HORAS = 24;

function buildEmailHtml(args: {
  departamentoNome: string;
  empresaNome: string;
  servicoNome?: string | null;
  responsavelAnteriorNome?: string | null;
  appUrl: string;
}) {
  const { departamentoNome, empresaNome, servicoNome, responsavelAnteriorNome, appUrl } = args;
  const linhaServico = servicoNome ? `<p style="margin: 0 0 8px 0;"><strong>Serviço:</strong> ${servicoNome}</p>` : '';
  const linhaResponsavel = responsavelAnteriorNome
    ? `<p style="margin: 0 0 8px 0;"><strong>Vindo de:</strong> ${responsavelAnteriorNome}</p>`
    : '';

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f1f5f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:linear-gradient(90deg,#06b6d4 0%,#2563eb 100%);padding:24px;color:#ffffff;">
                <h1 style="margin:0;font-size:20px;font-weight:bold;">Nova solicitação no seu departamento</h1>
                <p style="margin:8px 0 0 0;opacity:0.9;font-size:14px;">${departamentoNome}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;">Uma solicitação acabou de chegar no departamento <strong>${departamentoNome}</strong> e precisa da sua atenção.</p>
                <div style="background:#f8fafc;border-left:4px solid #06b6d4;padding:16px;border-radius:8px;margin-bottom:20px;">
                  <p style="margin:0 0 8px 0;"><strong>Empresa:</strong> ${empresaNome}</p>
                  ${linhaServico}
                  ${linhaResponsavel}
                </div>
                <p style="margin:0 0 16px 0;font-size:14px;color:#475569;">Acesse o sistema para ver os detalhes e dar continuidade:</p>
                <p style="margin:0 0 24px 0;">
                  <a href="${appUrl}" style="display:inline-block;background:linear-gradient(90deg,#06b6d4 0%,#2563eb 100%);color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;">Abrir solicitação</a>
                </p>
                <p style="margin:0;font-size:12px;color:#94a3b8;">Você está recebendo este email porque faz parte do departamento ${departamentoNome}. Esta é uma notificação automática — não responda este email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Nova solicitação no seu departamento (${departamentoNome})`,
    '',
    `Empresa: ${empresaNome}`,
    servicoNome ? `Serviço: ${servicoNome}` : null,
    responsavelAnteriorNome ? `Vindo de: ${responsavelAnteriorNome}` : null,
    '',
    `Abrir solicitação: ${appUrl}`,
  ].filter(Boolean).join('\n');

  return { html, text };
}

export async function notificarDepartamentoPorEmail(args: NotificarDepartamentoArgs): Promise<{
  enviado: boolean;
  motivo?: string;
  destinatarios?: string[];
}> {
  const { processoId, departamentoId, departamentoNome, empresaNome, servicoNome, responsavelAnteriorNome, appUrl } = args;

  console.log(`[EMAIL] Iniciando envio para processo=${processoId} dep=${departamentoNome}(${departamentoId})`);

  // Kill switch: só envia notificações se explicitamente habilitado.
  // Default = desligado, pra evitar mandar email pros deps antes da gente liberar oficialmente.
  if ((process.env.EMAIL_NOTIFICACOES_HABILITADO || '').trim().toLowerCase() !== 'true') {
    console.log(`[EMAIL] ABORTADO: EMAIL_NOTIFICACOES_HABILITADO=${process.env.EMAIL_NOTIFICACOES_HABILITADO} (precisa ser "true")`);
    return { enviado: false, motivo: 'Notificações por email desabilitadas (EMAIL_NOTIFICACOES_HABILITADO != true)' };
  }

  // Spam-control: já enviou pra esse processo+dep nas últimas 24h?
  try {
    const limiteData = new Date(Date.now() - NOTIFICACAO_EMAIL_THROTTLE_HORAS * 60 * 60 * 1000);
    const enviosRecentes = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM "EmailNotificacaoLog" WHERE "processoId" = $1 AND "departamentoId" = $2 AND "enviadoEm" >= $3 LIMIT 1`,
      processoId,
      departamentoId,
      limiteData
    );
    if (Array.isArray(enviosRecentes) && enviosRecentes.length > 0) {
      console.log(`[EMAIL] ABORTADO: já enviado nas últimas 24h pra processo=${processoId} dep=${departamentoId} (spam-control). Crie uma solicitação em OUTRO departamento pra testar.`);
      return { enviado: false, motivo: 'Já enviado nas últimas 24h (spam-control)' };
    }
  } catch (err) {
    console.warn('[EMAIL] ABORTADO: tabela EmailNotificacaoLog não existe no banco. Rode o SQL de migration_email_notificacao_log.sql no Supabase.', err);
    // Sem o log não dá pra fazer spam-control. Por segurança, NÃO envia (evita flood).
    return { enviado: false, motivo: 'Tabela EmailNotificacaoLog indisponível' };
  }

  // Busca apenas GERENTES ativos do departamento destino com email válido.
  // Notificação é só pra gerentes — usuários comuns recebem só notificação in-app.
  const gerentesDept = await prisma.usuario.findMany({
    where: {
      ativo: true,
      role: 'GERENTE',
      departamentoId,
      email: { not: '' },
    },
    select: { email: true, nome: true },
  });

  const emailsReais = gerentesDept
    .map((u) => (u.email || '').trim())
    .filter((e) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  console.log(`[EMAIL] Encontrados ${emailsReais.length} gerente(s) com email no dep ${departamentoNome}: ${emailsReais.join(', ') || '(nenhum)'}`);

  if (emailsReais.length === 0) {
    console.log(`[EMAIL] ABORTADO: nenhum gerente ativo com email cadastrado no dep ${departamentoNome}. Cadastre pelo menos um usuário com role=GERENTE e email nesse dep.`);
    return { enviado: false, motivo: 'Nenhum gerente ativo com email no departamento' };
  }

  // Modo teste: se a env var está setada, redireciona TODOS os emails pra ela.
  // Quando vazia, envia pros emails reais dos usuários.
  const destinatarioTeste = (process.env.EMAIL_NOTIFICACOES_TESTE_DESTINATARIO || '').trim();
  const destinatariosFinais = destinatarioTeste ? [destinatarioTeste] : emailsReais;
  console.log(`[EMAIL] Destinatários finais: ${destinatariosFinais.join(', ')} ${destinatarioTeste ? '(modo teste — redirecionado)' : '(reais)'}`);

  const baseUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
  const link = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/?processo=${processoId}` : `/?processo=${processoId}`;

  const subjectPrefix = destinatarioTeste ? '[TESTE] ' : '';
  const subject = `${subjectPrefix}Nova solicitação em ${departamentoNome} — ${empresaNome}`;
  const { html, text } = buildEmailHtml({
    departamentoNome,
    empresaNome,
    servicoNome,
    responsavelAnteriorNome,
    appUrl: link,
  });

  try {
    // Envio único com múltiplos destinatários no campo TO (todos veem todos).
    // Se quiser BCC depois, dá pra trocar.
    await sendEmail(destinatariosFinais.join(', '), subject, html, text);
    console.log(`[EMAIL] ENVIADO com sucesso para ${destinatariosFinais.join(', ')}`);

    // Registra log para spam-control
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "EmailNotificacaoLog" ("processoId", "departamentoId", "destinatarios") VALUES ($1, $2, $3::text[])`,
        processoId,
        departamentoId,
        destinatariosFinais
      );
    } catch (logErr) {
      console.warn('[EMAIL] Falha ao registrar EmailNotificacaoLog após envio (não bloqueia):', logErr);
    }

    return { enviado: true, destinatarios: destinatariosFinais };
  } catch (err) {
    console.error('[EMAIL] FALHA NO SMTP ao enviar:', err);
    return { enviado: false, motivo: 'Falha no SMTP' };
  }
}
