require('dotenv').config();
const nodemailer = require('nodemailer');

(async () => {
  try {
    const host = (process.env.SMTP_HOST || '').trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const user = (process.env.SMTP_USER || '').trim();
    // Remove espaços acidentais que usuários copiam da UI do Google (ex: "abcd efgh ijkl mnop")
    const passRaw = process.env.SMTP_PASS || '';
    const pass = passRaw.replace(/\s+/g, '');
    const from = process.env.EMAIL_FROM || user;
    const to = process.env.SMTP_TEST_TO || user;

    if (!host || !user || !pass) {
      console.error('Faltam variáveis SMTP no .env (SMTP_HOST, SMTP_USER, SMTP_PASS) — verifique e remova espaços extras');
      process.exit(1);
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    console.log('Tentando enviar email de teste usando', host, 'porta', port);

    const info = await transporter.sendMail({
      from,
      to,
      subject: 'Teste SMTP - Sistema',
      text: 'Se você recebeu este e-mail, o SMTP está configurado corretamente.',
    });

    console.log('Envio OK:', info.messageId || info.response || info);
    process.exit(0);
  } catch (err) {
    console.error('Erro no envio de teste:', err);
    process.exit(2);
  }
})();
