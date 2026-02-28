import { InlineKeyboard } from 'grammy';
import { getAnalytics, getRecentRequests } from '../database/db-postgres.js';
import { CONTENT_TYPES } from '../services/openrouter.js';
import { sendLongMessage } from '../utils/telegram.js';
import { ADMIN_IDS } from '../config.js';

function isAdmin(ctx) {
  return ADMIN_IDS.includes(ctx.from?.id);
}

function formatDate(date) {
  return new Date(date).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
}

function getUserLabel(row) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ');
  if (row.username) return `@${row.username}${name ? ` (${name})` : ''}`;
  return name || `ID: ${row.user_id}`;
}

export async function handleAnalytics(ctx) {
  if (!isAdmin(ctx)) return;

  try {
    const stats = await getAnalytics();

    const total = stats.totalGenerations || 1;
    const byTypeLines = stats.byType.map((row) => {
      const info = CONTENT_TYPES[row.content_type];
      const emoji = info?.emoji || '•';
      const name = info?.name || row.content_type;
      const pct = Math.round((parseInt(row.count) / total) * 100);
      return `  ${emoji} ${name}: ${row.count} (${pct}%)`;
    }).join('\n');

    const text =
      `📊 Аналитика бота\n\n` +
      `👥 Всего пользователей: ${stats.totalUsers}\n` +
      `📝 Всего генераций: ${stats.totalGenerations}\n` +
      `📅 За этот месяц: ${stats.monthlyGenerations}\n\n` +
      `📋 По типам контента:\n${byTypeLines || '  —'}`;

    const keyboard = new InlineKeyboard()
      .text('📋 Последние 20 запросов', 'admin:requests:0');

    await ctx.reply(text, { reply_markup: keyboard });
  } catch (error) {
    console.error('Ошибка аналитики:', error);
    await ctx.reply('❌ Ошибка получения статистики.');
  }
}

export async function handleAdminCallback(ctx) {
  if (!isAdmin(ctx)) {
    await ctx.answerCallbackQuery('Нет доступа');
    return;
  }

  const data = ctx.callbackQuery.data;

  if (data.startsWith('admin:requests:')) {
    const offset = parseInt(data.split(':')[2]) || 0;
    const limit = 20;

    try {
      const rows = await getRecentRequests(limit + 1, offset);
      const hasMore = rows.length > limit;
      const items = rows.slice(0, limit);

      if (items.length === 0) {
        await ctx.answerCallbackQuery('Запросов нет');
        return;
      }

      const lines = items.map((row, i) => {
        const info = CONTENT_TYPES[row.content_type];
        const typeLabel = `${info?.emoji || '•'} ${info?.name || row.content_type}`;
        const userLabel = getUserLabel(row);
        const userText = row.user_text
          ? `« ${row.user_text} »`
          : '(текст не сохранён)';
        return `${offset + i + 1}. ${formatDate(row.created_at)}\n👤 ${userLabel}\n${typeLabel}\n${userText}`;
      });

      const keyboard = new InlineKeyboard();
      if (offset > 0) {
        keyboard.text('← Назад', `admin:requests:${offset - limit}`);
      }
      if (hasMore) {
        keyboard.text('Ещё →', `admin:requests:${offset + limit}`);
      }

      await ctx.answerCallbackQuery();
      await sendLongMessage(
        ctx,
        `📋 Последние запросы (${offset + 1}–${offset + items.length}):\n\n` +
        lines.join('\n\n———\n\n'),
        keyboard.inline_keyboard.length ? { reply_markup: keyboard } : {}
      );
    } catch (error) {
      console.error('Ошибка получения запросов:', error);
      await ctx.answerCallbackQuery('Ошибка загрузки').catch(() => {});
    }
  }
}
