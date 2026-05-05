import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_ADDRESS = process.env.EMAIL_FROM || 'no-reply@example.com';

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.warn('SMTP not fully configured. Email sending will fail unless SMTP_* env vars are set.');
}

export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  const info = await transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject,
    text: text || undefined,
    html,
  });

  return info;
}

export function buildVerificationEmail(code: string, expiresMinutes = 5) {
  const html = `<p>Seu código de verificação é <strong>${code}</strong>.</p><p>Ele expira em ${expiresMinutes} minutos.</p>`;
  const text = `Seu código de verificação é ${code}. Expira em ${expiresMinutes} minutos.`;
  return { html, text };
}
