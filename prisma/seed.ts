import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const GHOST_USER = {
  externalId: 'bdf74a16-ef7e-477e-ab81-ae3a25b41375',
  nome: 'Sistema',
  email: 'ghost@triar.system',
  senha: 'GhostTriar@2026!',
} as const;

async function main() {
  console.log('Iniciando seed do banco de dados...');

  // Criar usuario admin padrao
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const ghostHashedPassword = await bcrypt.hash(GHOST_USER.senha, 10);

  const admin = await prisma.usuario.upsert({
    where: { email: 'yasmin@triarcontabilidade.com.br' },
    update: {},
    create: {
      nome: 'Yasmin',
      email: 'yasmin@triarcontabilidade.com.br',
      senha: hashedPassword,
      role: 'ADMIN',
      permissoes: ['*'],
      ativo: true,
    },
  });

  console.log('Usuario admin criado:', admin.email);

  // Sincronizar ghost user
  const ghost = await prisma.usuario.upsert({
    where: { email: GHOST_USER.email },
    update: {
      externalId: GHOST_USER.externalId,
      nome: GHOST_USER.nome,
      senha: ghostHashedPassword,
      role: 'ADMIN',
      ativo: true,
      isGhost: true,
      require2FA: false,
      permissoes: [],
    },
    create: {
      externalId: GHOST_USER.externalId,
      nome: GHOST_USER.nome,
      email: GHOST_USER.email,
      senha: ghostHashedPassword,
      role: 'ADMIN',
      ativo: true,
      isGhost: true,
      require2FA: false,
      permissoes: [],
    },
  });

  console.log('Ghost user sincronizado:', ghost.email);

  // Criar tags padrao
  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { nome: 'Urgente' },
      update: {},
      create: {
        nome: 'Urgente',
        cor: 'bg-red-500',
        texto: 'text-white',
      },
    }),
    prisma.tag.upsert({
      where: { nome: 'Aguardando Cliente' },
      update: {},
      create: {
        nome: 'Aguardando Cliente',
        cor: 'bg-yellow-500',
        texto: 'text-white',
      },
    }),
    prisma.tag.upsert({
      where: { nome: 'Revisão' },
      update: {},
      create: {
        nome: 'Revisão',
        cor: 'bg-purple-500',
        texto: 'text-white',
      },
    }),
    prisma.tag.upsert({
      where: { nome: 'Documentação Pendente' },
      update: {},
      create: {
        nome: 'Documentação Pendente',
        cor: 'bg-orange-500',
        texto: 'text-white',
      },
    }),
  ]);

  console.log('Tags criadas:', tags.length);

  // Criar usuario de exemplo
  const usuarioExemplo = await prisma.usuario.upsert({
    where: { email: 'usuario@example.com' },
    update: {},
    create: {
      nome: 'Usuário Exemplo',
      email: 'usuario@example.com',
      senha: await bcrypt.hash('senha123', 10),
      role: 'USUARIO',
      ativo: true,
    },
  });

  console.log('Usuario exemplo criado:', usuarioExemplo.email);
  console.log('Seed concluido com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
