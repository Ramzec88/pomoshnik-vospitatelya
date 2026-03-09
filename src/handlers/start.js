import { Keyboard } from 'grammy';
import { getOrCreateUser, getRemainingGenerations } from '../database/db-postgres.js';
import { TIER_LIMITS, ADMIN_IDS } from '../config.js';

export async function handleStart(ctx) {
  const userId = ctx.from.id;

  // Создаем или получаем пользователя
  await getOrCreateUser(userId, {
    username: ctx.from.username,
    first_name: ctx.from.first_name,
    last_name: ctx.from.last_name,
  });

  // Получаем tier и лимит из middleware
  const tier = ctx.state?.tier || 'free';
  const limit = TIER_LIMITS[tier];
  const remaining = tier === 'admin' ? '∞' : await getRemainingGenerations(userId, limit);

  const tierMessage = {
    free: '🆓 Free (2 генерации/месяц)',
    premium: '🎓 Premium (10 генераций/месяц)',
    admin: '⭐️ Admin (безлимит)'
  }[tier];

  const keyboard = new Keyboard()
    .text('📋 Сценарий')
    .text('🎵 Песня и ноты')
    .row()
    .text('🎨 Занятие')
    .text('🎮 Игра')
    .row()
    .text('📊 Мои лимиты')
    .text('ℹ️ Помощь')
    .resized();

  await ctx.reply(
    `👋 Привет, ${ctx.from.first_name}!\n\n` +
    `Я помощник воспитателя. Помогу создать:\n` +
    `📋 Сценарии мероприятий и праздников\n` +
    `🎵 Песни с нотами\n` +
    `🎨 Развивающие занятия\n` +
    `🎮 Детские игры\n\n` +
    `Ваш статус: ${tierMessage}\n` +
    `📊 Осталось генераций: ${remaining}\n\n` +
    `💡 Как получить лучший результат?\n` +
    `Прочитайте статью с подсказками:\n` +
    `https://telegra.ph/Kak-poluchit-ot-Mishki-Maksa-imenno-to-chto-nuzhno-02-16\n\n` +
    `Выберите тип контента из меню ниже:`,
    { reply_markup: keyboard }
  );
}
