import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function criarAdmin() {
  try {
    console.log('🔐 Criando usuário admin...');

    const email = 'admin@example.com';
    const senha = 'admin123';

    // Verificar se já existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email },
    });

    if (usuarioExistente) {
      console.log('⚠️  Usuário admin já existe. Atualizando senha...');
      
      const senhaHash = await bcrypt.hash(senha, 10);
      
      const usuario = await prisma.usuario.update({
        where: { email },
        data: {
          senha: senhaHash,
          role: 'ADMIN',
          ativo: true,
          permissoes: ['*'],
        },
      });

      console.log('✅ Usuário admin atualizado com sucesso!');
      console.log('📧 Email:', usuario.email);
      console.log('👤 Nome:', usuario.nome);
      console.log('🔑 Role:', usuario.role);
    } else {
      // Criar novo usuário
      const senhaHash = await bcrypt.hash(senha, 10);

      const usuario = await prisma.usuario.create({
        data: {
          nome: 'Administrador',
          email: email,
          senha: senhaHash,
          role: 'ADMIN',
          ativo: true,
          permissoes: ['*'], // Todas permissões
        },
      });

      console.log('✅ Usuário admin criado com sucesso!');
      console.log('📧 Email:', usuario.email);
      console.log('👤 Nome:', usuario.nome);
      console.log('🔑 Role:', usuario.role);
      console.log('🆔 ID:', usuario.id);
    }

    console.log('\n🎉 Pronto! Você pode fazer login com:');
    console.log('   Email: admin@example.com');
    console.log('   Senha: admin123');
  } catch (error) {
    console.error('❌ Erro ao criar usuário admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

criarAdmin();




