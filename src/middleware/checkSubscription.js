import { config } from '../config.js';

export async function checkSubscription(ctx, next) {
  try {
    const userId = ctx.from.id;
    const chatMember = await ctx.api.getChatMember(config.premiumChannelId, userId);

    const isSubscribed = ['creator', 'administrator', 'member'].includes(chatMember.status);

    if (isSubscribed) {
      return await next();
    } else {
      await ctx.reply(
        '❌ Для использования бота необходимо быть подписчиком платного канала.\n\n' +
        'После подписки нажмите /start для начала работы.'
      );
    }
  } catch (error) {
    console.error('Ошибка проверки подписки:', error);
    await ctx.reply(
      '⚠️ Произошла ошибка при проверке подписки. Убедитесь, что:\n' +
      '1. Вы подписаны на канал\n' +
      '2. Бот добавлен в канал как администратор\n\n' +
      'Попробуйте позже или обратитесь к администратору.'
    );
  }
}
