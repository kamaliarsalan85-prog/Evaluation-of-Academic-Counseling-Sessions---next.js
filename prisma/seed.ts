import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { ensureDefaultAppData } from '../src/lib/bootstrap';

async function main() {
  await ensureDefaultAppData();
  console.log('Database seeded with default settings, sample counselors, and initial form v1.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
