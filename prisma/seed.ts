// Optional convenience seed — just makes sure the Settings singleton row
// exists so the Settings page has something to load on first run.
// Everything else (clients, invoices) you create yourself through the UI.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!existing) {
    await prisma.settings.create({ data: { id: 1 } });
    console.log('Created default Settings row.');
  } else {
    console.log('Settings row already exists — nothing to do.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
