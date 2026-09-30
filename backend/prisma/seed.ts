import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const seed = async () => {
  const googleId = process.env.SEED_GOOGLE_ID;
  const email = process.env.SEED_EMAIL;
  const name = process.env.SEED_NAME;

  if (!googleId || !email || !name) {
    console.log("Seed skipped: missing SEED_GOOGLE_ID, SEED_EMAIL, or SEED_NAME.");
    return;
  }

  const user = await prisma.user.upsert({
    where: { googleId },
    update: { email, name },
    create: {
      googleId,
      email,
      name
    }
  });

  const senderEmail = process.env.SEED_SENDER_EMAIL;
  const senderName = process.env.SEED_SENDER_NAME;

  if (senderEmail && senderName) {
    await prisma.sender.upsert({
      where: { id: `${user.id}-seed-sender` },
      update: { email: senderEmail, displayName: senderName },
      create: {
        id: `${user.id}-seed-sender`,
        userId: user.id,
        email: senderEmail,
        displayName: senderName
      }
    });
  }

  console.log("Seed completed.");
};

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
