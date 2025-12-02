import { MessageCategory } from './types';
import { prisma } from './prisma';

export async function checkAndPurge(category: MessageCategory) {
  const config =
    (await prisma.purgeConfig.findUnique({
      where: { category },
    })) ||
    (await prisma.purgeConfig.create({
      data: { category, maxMessages: 500 },
    }));

  const count = await prisma.message.count({
    where: { category },
  });

  if (count > config.maxMessages) {
    // Xóa messages cũ nhất, giữ lại maxMessages messages mới nhất
    const messagesToDelete = await prisma.message.findMany({
      where: { category },
      orderBy: { createdAt: 'asc' },
      take: count - config.maxMessages,
      select: { id: true },
    });

    if (messagesToDelete.length > 0) {
      await prisma.message.deleteMany({
        where: { id: { in: messagesToDelete.map((m) => m.id) } },
      });

      await prisma.purgeConfig.update({
        where: { category },
        data: { lastPurgedAt: new Date() },
      });

      console.log(
        `Purged ${messagesToDelete.length} messages from category ${category}. Remaining: ${config.maxMessages}`
      );
    }
  }
}

export async function getPurgeConfig(category: MessageCategory) {
  return (
    (await prisma.purgeConfig.findUnique({
      where: { category },
    })) ||
    (await prisma.purgeConfig.create({
      data: { category, maxMessages: 500 },
    }))
  );
}

export async function updatePurgeConfig(
  category: MessageCategory,
  maxMessages: number
) {
  return await prisma.purgeConfig.upsert({
    where: { category },
    update: { maxMessages },
    create: { category, maxMessages },
  });
}

