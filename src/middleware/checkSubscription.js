import { FREE_CHANNEL_ID, PREMIUM_CHANNEL_ID, ADMIN_IDS, TIER_LIMITS } from '../config.js';
import { updateUserTier } from '../database/db-postgres.js';

/**
 * Проверяет подписку пользователя и определяет tier
 * Tier приоритет:
 * 1. admin - если user_id в ADMIN_IDS
 * 2. premium - если подписан на premium канал
 * 3. free - если подписан только на free канал
 * 4. deny - если не подписан ни на один канал
 */
export async function checkSubscription(ctx, next) {
  try {
    const userId = ctx.from.id;

    // Админы получают tier = admin автоматически
    if (ADMIN_IDS.includes(userId)) {
      ctx.state = ctx.state || {};
      ctx.state.tier = 'admin';
      ctx.state.limit = TIER_LIMITS.admin;
      await updateUserTier(userId, 'admin');
      return await next();
    }

    // Проверяем подписку на оба канала
    const [premiumMember, freeMember] = await Promise.all([
      checkChannel(ctx, PREMIUM_CHANNEL_ID, userId),
      checkChannel(ctx, FREE_CHANNEL_ID, userId),
    ]);

    // Определяем tier по подпискам (premium приоритетнее)
    let tier;
    if (premiumMember) {
      tier = 'premium';
    } else if (freeMember) {
      tier = 'free';
    } else {
      // Не подписан ни на один канал
      await ctx.reply(
        '❌ Для использования бота необходимо быть подписчиком одного из каналов:\n\n' +
        '🎓 Воспитатель | Детский сад | Мишка Макс — лимит 10 генераций/месяц\n' +
        '📢 Открытый канал "Мишка Макс" (@mishka_max) — лимит 2 генерации/месяц\n\n' +
        'После подписки нажмите /start для начала работы.'
      );
      return;
    }

    // Сохраняем tier в контексте и БД
    ctx.state = ctx.state || {};
    ctx.state.tier = tier;
    ctx.state.limit = TIER_LIMITS[tier];
    await updateUserTier(userId, tier);

    return await next();
  } catch (error) {
    console.error('Ошибка проверки подписки:', error);
    await ctx.reply(
      '⚠️ Произошла ошибка при проверке подписки. Убедитесь, что:\n' +
      '1. Вы подписаны на один из каналов\n' +
      '2. Бот добавлен в каналы как администратор\n\n' +
      'Попробуйте позже или обратитесь к администратору.'
    );
  }
}

/**
 * Проверяет членство пользователя в канале
 * @returns {Promise<boolean>} true если пользователь подписан
 */
async function checkChannel(ctx, channelId, userId) {
  try {
    const chatMember = await ctx.api.getChatMember(channelId, userId);
    return ['creator', 'administrator', 'member'].includes(chatMember.status);
  } catch (error) {
    // Если канал недоступен или бот не админ - возвращаем false
    console.error(`Ошибка проверки канала ${channelId}:`, error.message);
    return false;
  }
}
