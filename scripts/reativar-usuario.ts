import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getArgValue(flag: string) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const email = getArgValue('--email');
  const idRaw = getArgValue('--id');

  if (!email && !idRaw) {
    console.log('Uso:');
    console.log('  npm run reativar-usuario -- --email "usuario@empresa.com"');
    console.log('  npm run reativar-usuario -- --id 1');
    process.exit(1);
  }

  const where = email
    ? { email: String(email).trim() }
    : { id: Number(idRaw) };

  const usuario = await prisma.usuario.findUnique({ where: where as any });
  if (!usuario) {
    console.error('Usuário não encontrado.');
    process.exit(1);
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ativo: true },
  });

  console.log('✅ Usuário reativado com sucesso:', usuario.email);
}

main()
  .catch((err) => {
    console.error('❌ Erro ao reativar usuário:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
