import { Keyboard } from 'grammy';
import { getOrCreateUser, getRemainingGenerations } from '../database/db.js';
import { config } from '../config.js';

export async function handleStart(ctx) {
  const userId = ctx.from.id;

  // Создаем или получаем пользователя
  getOrCreateUser(userId, {
    username: ctx.from.username,
    first_name: ctx.from.first_name,
    last_name: ctx.from.last_name,
  });

  const remaining = getRemainingGenerations(userId, config.monthlyLimit);

  const keyboard = new Keyboard()
    .text('📋 Сценарий')
    .text('💡 Методическая подсказка')
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
    `💡 Методические рекомендации\n` +
    `🎨 Развивающие занятия\n` +
    `🎮 Детские игры\n\n` +
    `📊 У вас осталось ${remaining} из ${config.monthlyLimit} генераций в этом месяце.\n\n` +
    `💡 Как получить лучший результат?\n` +
    `Прочитайте статью с подсказками:\n` +
    `https://telegra.ph/Kak-poluchit-ot-Mishki-Maksa-imenno-to-chto-nuzhno-02-16\n\n` +
    `Выберите тип контента из меню ниже:`,
    { reply_markup: keyboard }
  );
}
