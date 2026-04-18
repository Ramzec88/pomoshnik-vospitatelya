import { getRemainingGenerations, getMonthlyGenerationsCount } from '../database/db-postgres.js';
import { TIER_LIMITS, ADMIN_IDS } from '../config.js';

const TIER_NAMES = {
  free: '🆓 Free (открытый канал)',
  premium: '🎓 Premium (Воспитатель | Детский сад | Мишка Макс)',
  admin: '⭐️ Admin (безлимит)'
};

export async function handleLimits(ctx) {
  const userId = ctx.from.id;

  // Получаем tier из middleware
  const tier = ctx.state?.tier || 'free';
  const limit = TIER_LIMITS[tier];

  if (tier === 'admin') {
    await ctx.reply(
      `📊 Статистика использования\n\n` +
      `Статус: ${TIER_NAMES[tier]}\n\n` +
      `✅ У вас безлимитный доступ!\n` +
      `📅 Генераций за месяц: ${await getMonthlyGenerationsCount(userId)}`
    );
    return;
  }

  const used = await getMonthlyGenerationsCount(userId);
  const remaining = await getRemainingGenerations(userId, limit);

  const progressBar = createProgressBar(used, limit);

  const upgradeHint = tier === 'free'
    ? '\n\n💡 Подпишитесь на канал Воспитатель | Детский сад | Мишка Макс для 10 генераций/месяц!'
    : '';

  await ctx.reply(
    `📊 Статистика использования\n\n` +
    `Статус: ${TIER_NAMES[tier]}\n\n` +
    `${progressBar}\n\n` +
    `✅ Использовано: ${used}\n` +
    `⏳ Осталось: ${remaining}\n` +
    `📅 Лимит в месяц: ${limit}` +
    upgradeHint +
    `\n\n💡 Лимит обновляется каждый месяц.`
  );
}

function createProgressBar(used, total, length = 10) {
  const filled = Math.round((used / total) * length);
  const empty = length - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percentage = Math.round((used / total) * 100);

  return `${bar} ${percentage}%`;
}
