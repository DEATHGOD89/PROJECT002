import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Seed Services
  const services = ["Service 1", "Service 2", "Service 3"];
  for (const serviceName of services) {
    await prisma.service.upsert({
      where: { name: serviceName },
      update: {},
      create: { name: serviceName },
    });
  }
  console.log("Services seeded.");

  // Seed Providers (Provider 1 to Provider 8)
  for (let i = 1; i <= 8; i++) {
    const providerName = `Provider ${i}`;
    await prisma.provider.upsert({
      where: { id: i },
      update: {
        name: providerName,
        monthlyQuota: 10,
        currentMonthLeads: 0,
        allocationIndex: 0,
      },
      create: {
        id: i,
        name: providerName,
        monthlyQuota: 10,
        currentMonthLeads: 0,
        allocationIndex: 0,
      },
    });
  }
  console.log("Providers seeded.");
  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
