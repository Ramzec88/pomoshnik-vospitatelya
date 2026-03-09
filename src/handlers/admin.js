import { InlineKeyboard } from 'grammy';
import { getAnalytics, getRecentRequests, getMonthlyUsageStats, getUserStats } from '../database/db-postgres.js';
import { CONTENT_TYPES } from '../services/openrouter.js';
import { sendLongMessage } from '../utils/telegram.js';
import { ADMIN_IDS, config } from '../config.js';

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

function createProgressBar(percent, length = 20) {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export async function handleAnalytics(ctx) {
  if (!isAdmin(ctx)) return;

  try {
    const [stats, usageStats] = await Promise.all([
      getAnalytics(),
      getMonthlyUsageStats(ADMIN_IDS, config.monthlyLimit),
    ]);

    const total = stats.totalGenerations || 1;
    const byTypeLines = stats.byType.map((row) => {
      const info = CONTENT_TYPES[row.content_type];
      const emoji = info?.emoji || '•';
      const name = info?.name || row.content_type;
      const pct = Math.round((parseInt(row.count) / total) * 100);
      return `  ${emoji} ${name}: ${row.count} (${pct}%)`;
    }).join('\n');

    const progressBar = createProgressBar(usageStats.usagePercent);

    const text =
      `📊 Аналитика бота\n\n` +
      `👥 Всего пользователей: ${stats.totalUsers}\n` +
      `📝 Всего генераций: ${stats.totalGenerations}\n` +
      `📅 За этот месяц: ${stats.monthlyGenerations}\n\n` +
      `📋 По типам контента:\n${byTypeLines || '  —'}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📈 Использование лимитов (без админов):\n` +
      `[${progressBar}] ${usageStats.usagePercent}%\n\n` +
      `Использовано: ${usageStats.usedRequests} / ${usageStats.maxRequests}\n` +
      `Осталось: ${usageStats.remainingRequests}\n` +
      `Обычных пользователей: ${usageStats.regularUsersCount}`;

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

export async function handleUserStats(ctx) {
  if (!isAdmin(ctx)) return;

  // Извлекаем user_id из команды: /user 123456789
  const text = ctx.message?.text || '';
  const parts = text.split(' ');

  if (parts.length < 2) {
    await ctx.reply(
      '❌ Укажите ID пользователя:\n\n' +
      'Пример: /user 123456789'
    );
    return;
  }

  const targetUserId = parseInt(parts[1]);
  if (isNaN(targetUserId)) {
    await ctx.reply('❌ Неверный формат ID пользователя');
    return;
  }

  try {
    const stats = await getUserStats(targetUserId, config.monthlyLimit);

    if (!stats) {
      await ctx.reply(`❌ Пользователь с ID ${targetUserId} не найден в базе`);
      return;
    }

    const isAdmin = ADMIN_IDS.includes(targetUserId);
    const userName = [stats.user.first_name, stats.user.last_name].filter(Boolean).join(' ');
    const username = stats.user.username ? `@${stats.user.username}` : '—';

    // Последние запросы
    const recentLines = stats.recentRequests.slice(0, 5).map((req) => {
      const info = CONTENT_TYPES[req.content_type];
      const emoji = info?.emoji || '•';
      const name = info?.name || req.content_type;
      const text = req.user_text ? `"${req.user_text.substring(0, 50)}${req.user_text.length > 50 ? '...' : ''}"` : '(нет текста)';
      return `  ${emoji} ${name} - ${formatDate(req.created_at)}\n  ${text}`;
    }).join('\n\n');

    const message =
      `👤 Статистика пользователя\n\n` +
      `ID: ${targetUserId}\n` +
      `Имя: ${userName || 'не указано'}\n` +
      `Username: ${username}\n` +
      `Статус: ${isAdmin ? '⭐️ Администратор (безлимит)' : '👤 Обычный пользователь'}\n\n` +
      `📊 Использование:\n` +
      `• Всего генераций: ${stats.totalGenerations}\n` +
      `• За текущий месяц: ${stats.monthlyGenerations}\n` +
      `• Осталось: ${isAdmin ? '∞' : stats.remaining}\n\n` +
      `📋 Последние 5 запросов:\n${recentLines || '  (нет запросов)'}`;

    await ctx.reply(message);
  } catch (error) {
    console.error('Ошибка получения статистики пользователя:', error);
    await ctx.reply('❌ Ошибка получения данных');
  }
}
