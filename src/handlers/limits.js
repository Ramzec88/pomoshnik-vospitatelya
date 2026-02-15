import { getRemainingGenerations, getMonthlyGenerationsCount } from '../database/db.js';
import { config } from '../config.js';

export async function handleLimits(ctx) {
  const userId = ctx.from.id;
  const used = getMonthlyGenerationsCount(userId);
  const remaining = getRemainingGenerations(userId, config.monthlyLimit);

  const progressBar = createProgressBar(used, config.monthlyLimit);

  await ctx.reply(
    `📊 Статистика использования\n\n` +
    `${progressBar}\n\n` +
    `✅ Использовано: ${used}\n` +
    `⏳ Осталось: ${remaining}\n` +
    `📅 Лимит в месяц: ${config.monthlyLimit}\n\n` +
    `💡 Лимит обновляется каждый месяц.`
  );
}

function createProgressBar(used, total, length = 10) {
  const filled = Math.round((used / total) * length);
  const empty = length - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percentage = Math.round((used / total) * 100);

  return `${bar} ${percentage}%`;
}
