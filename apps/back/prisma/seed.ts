import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.upsert({
    create: {
      features: {},
      isActive: true,
      maxBranches: 1,
      maxDevices: 2,
      maxUsers: 3,
      name: "Starter",
      priceMonthly: 0,
    },
    update: {},
    where: { name: "Starter" },
  });
  console.log("Starter plan seeded");
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
