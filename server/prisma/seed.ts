import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@boondclone.local';
const ADMIN_PASSWORD = 'Admin1234!';

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    console.log('ℹ️  Utilisateur admin déjà présent, aucune action.');
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: 'Admin',
      lastName: 'Boond',
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  console.log('✅ Utilisateur admin créé :');
  console.log(`   email    : ${ADMIN_EMAIL}`);
  console.log(`   password : ${ADMIN_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
