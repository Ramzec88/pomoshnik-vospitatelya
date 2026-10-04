import { InlineKeyboard } from 'grammy';
import { getAnalytics, getRecentRequests, getMonthlyUsageStats, getUserStats, getTierStats, getAllUsers } from '../database/db-postgres.js';
import { CONTENT_TYPES } from '../services/openrouter.js';
import { sendLongMessage } from '../utils/telegram.js';
import { ADMIN_IDS, TIER_LIMITS } from '../config.js';

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
    const [stats, usageStats, tierStats] = await Promise.all([
      getAnalytics(),
      getMonthlyUsageStats(ADMIN_IDS, 10), // Legacy для совместимости
      getTierStats(ADMIN_IDS),
    ]);

    const total = stats.totalGenerations || 1;
    const byTypeLines = stats.byType.map((row) => {
      const info = CONTENT_TYPES[row.content_type];
      const emoji = info?.emoji || '•';
      const name = info?.name || row.content_type;
      const pct = Math.round((parseInt(row.count) / total) * 100);
      return `  ${emoji} ${name}: ${row.count} (${pct}%)`;
    }).join('\n');

    // Статистика по tier
    const tierEmoji = { free: '🆓', premium: '🎓', admin: '⭐️' };
    const usersByTierLines = tierStats.usersByTier.map((row) => {
      return `  ${tierEmoji[row.tier] || '•'} ${row.tier}: ${row.count}`;
    }).join('\n');

    const totalGensByTierLines = tierStats.totalGensByTier.map((row) => {
      return `  ${tierEmoji[row.tier] || '•'} ${row.tier}: ${row.count}`;
    }).join('\n');

    const monthlyGensByTierLines = tierStats.monthlyGensByTier.map((row) => {
      // Вычисляем использование лимита для этого tier
      const tierLimit = TIER_LIMITS[row.tier] || 10;
      const usersCount = tierStats.usersByTier.find(u => u.tier === row.tier)?.count || 1;
      const maxForTier = row.tier === 'admin' ? '∞' : tierLimit * usersCount;
      const used = parseInt(row.count);
      const remaining = row.tier === 'admin' ? '∞' : Math.max(0, maxForTier - used);
      return `  ${tierEmoji[row.tier] || '•'} ${row.tier}: ${used} / ${maxForTier} (осталось: ${remaining})`;
    }).join('\n');

    const progressBar = createProgressBar(usageStats.usagePercent);

    const text =
      `📊 Аналитика бота\n\n` +
      `👥 Всего пользователей: ${stats.totalUsers}\n` +
      `${usersByTierLines}\n\n` +
      `📝 Всего генераций: ${stats.totalGenerations}\n` +
      `${totalGensByTierLines || '  —'}\n\n` +
      `📅 За этот месяц: ${stats.monthlyGenerations}\n` +
      `${monthlyGensByTierLines || '  —'}\n\n` +
      `📋 По типам контента:\n${byTypeLines || '  —'}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📈 Конверсия free → premium:\n` +
      `Конвертировано: ${tierStats.conversion.convertedUsers} (${tierStats.conversion.conversionPercent}%)\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 Общее использование лимитов (legacy):\n` +
      `[${progressBar}] ${usageStats.usagePercent}%\n` +
      `Использовано: ${usageStats.usedRequests} / ${usageStats.maxRequests}`;

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

  if (data === 'admin:bc:send' || data === 'admin:bc:cancel') {
    await handleBroadcastDecision(ctx, data === 'admin:bc:send');
    return;
  }

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
    // Определяем tier и лимит пользователя
    const userTier = ADMIN_IDS.includes(targetUserId) ? 'admin' : 'free'; // Будет обновлен из БД
    const userLimit = TIER_LIMITS[userTier];

    const stats = await getUserStats(targetUserId, userLimit);

    if (!stats) {
      await ctx.reply(`❌ Пользователь с ID ${targetUserId} не найден в базе`);
      return;
    }

    const tier = stats.user.tier || 'free';
    const tierEmoji = { free: '🆓', premium: '🎓', admin: '⭐️' };
    const tierName = { free: 'Free (открытый канал)', premium: 'Premium (Воспитатель | Детский сад | Мишка Макс)', admin: 'Admin (безлимит)' };

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
      `Tier: ${tierEmoji[tier]} ${tierName[tier]}\n\n` +
      `📊 Использование:\n` +
      `• Всего генераций: ${stats.totalGenerations}\n` +
      `• За текущий месяц: ${stats.monthlyGenerations}\n` +
      `• Осталось: ${tier === 'admin' ? '∞' : stats.remaining}\n\n` +
      `📋 Последние 5 запросов:\n${recentLines || '  (нет запросов)'}`;

    await ctx.reply(message);
  } catch (error) {
    console.error('Ошибка получения статистики пользователя:', error);
    await ctx.reply('❌ Ошибка получения данных');
  }
}

// Разбор: "Текст | Текст кнопки | https://ссылка" (кнопка необязательна)
function parseBroadcast(raw) {
  const parts = raw.split('|').map((p) => p.trim());
  if (parts.length === 1) return { message: raw };
  if (parts.length !== 3 || !parts[0] || !parts[1]) {
    return { error: 'Формат: /broadcast Текст | Текст кнопки | https://ссылка' };
  }
  let url;
  try {
    url = new URL(parts[2]);
  } catch {
    return { error: '❌ Некорректная ссылка для кнопки' };
  }
  if (!['http:', 'https:', 'tg:'].includes(url.protocol)) {
    return { error: '❌ Ссылка должна начинаться с http://, https:// или tg://' };
  }
  return { message: parts[0], buttonText: parts[1], buttonUrl: url.href };
}

// Черновики рассылки, ожидающие подтверждения: adminId -> { message, buttonText, buttonUrl }
const pendingBroadcasts = new Map();

function buildBroadcastMessage({ message, buttonText, buttonUrl }) {
  return {
    text: `📢 Сообщение от администратора:\n\n${message}`,
    options: buttonUrl
      ? { reply_markup: new InlineKeyboard().url(buttonText, buttonUrl) }
      : {},
  };
}

export async function handleBroadcast(ctx) {
  if (!isAdmin(ctx)) return;

  const text = ctx.message?.text || '';
  const raw = text.replace(/^\/broadcast\s*/i, '').trim();

  if (!raw) {
    await ctx.reply(
      '📢 Рассылка сообщений\n\n' +
      'Использование:\n' +
      '/broadcast Ваше сообщение\n\n' +
      'С кнопкой-ссылкой:\n' +
      '/broadcast Текст | Текст кнопки | https://ссылка\n\n' +
      'Пример:\n' +
      '/broadcast Добавили новые функции! | Подробнее | https://t.me/channel/1\n\n' +
      'Перед отправкой бот покажет предпросмотр и попросит подтверждение.'
    );
    return;
  }

  const { error, ...draft } = parseBroadcast(raw);
  if (error) {
    await ctx.reply(error);
    return;
  }

  try {
    const total = (await getAllUsers()).length;
    const { text: previewText, options } = buildBroadcastMessage(draft);

    await ctx.reply('👁 Предпросмотр — так сообщение увидят пользователи:');
    await ctx.reply(previewText, options);

    pendingBroadcasts.set(ctx.from.id, draft);

    await ctx.reply(
      `Отправить это сообщение ${total} пользователям?`,
      {
        reply_markup: new InlineKeyboard()
          .text('✅ Отправить', 'admin:bc:send')
          .text('❌ Отменить', 'admin:bc:cancel'),
      }
    );
  } catch (err) {
    console.error('Ошибка подготовки рассылки:', err);
    await ctx.reply('❌ Не удалось подготовить рассылку. Проверьте текст и попробуйте снова.');
  }
}

async function handleBroadcastDecision(ctx, confirmed) {
  // Забираем черновик сразу, чтобы повторное нажатие не запустило рассылку дважды
  const draft = pendingBroadcasts.get(ctx.from.id);
  pendingBroadcasts.delete(ctx.from.id);

  await ctx.answerCallbackQuery().catch(() => {});
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});

  if (!draft) {
    await ctx.reply('⚠️ Черновик рассылки не найден или уже обработан. Отправьте /broadcast заново.');
    return;
  }

  if (!confirmed) {
    await ctx.reply('❌ Рассылка отменена.');
    return;
  }

  await runBroadcast(ctx, draft);
}

async function runBroadcast(ctx, draft) {
  const { text, options } = buildBroadcastMessage(draft);

  const users = await getAllUsers();
  const total = users.length;

  await ctx.reply(`📢 Начинаю рассылку для ${total} пользователей...`);

  let sent = 0;
  let failed = 0;

  for (const userId of users) {
    try {
      await ctx.api.sendMessage(userId, text, options);
      sent++;
    } catch (error) {
      failed++;
      console.log(`[Broadcast] Не удалось отправить пользователю ${userId}: ${error.message}`);
    }

    // Задержка чтобы не превысить rate limit Telegram (30 сообщений/сек)
    await new Promise(resolve => setTimeout(resolve, 40));
  }

  await ctx.reply(
    `✅ Рассылка завершена\n\n` +
    `👥 Всего пользователей: ${total}\n` +
    `✅ Отправлено: ${sent}\n` +
    `❌ Не доставлено (заблокировали бота): ${failed}`
  );
}
