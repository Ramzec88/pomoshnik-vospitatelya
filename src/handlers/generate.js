import { InlineKeyboard } from 'grammy';
import {
  saveUserState,
  getUserState,
  clearUserState,
  getRemainingGenerations,
  addGeneration,
} from '../database/db.js';
import { generateContent, CONTENT_TYPES } from '../services/openrouter.js';
import { config } from '../config.js';

// Вопросы для сбора информации
const QUESTIONS = {
  ageGroup: {
    text: 'Выберите возрастную группу детей:',
    options: [
      ['👶 Ясельная (1-3 года)', '1-3 года'],
      ['🧒 Младшая (3-4 года)', '3-4 года'],
      ['👦 Средняя (4-5 лет)', '4-5 лет'],
      ['👧 Старшая (5-6 лет)', '5-6 лет'],
      ['🎓 Подготовительная (6-7 лет)', '6-7 лет'],
    ],
  },
  groupSize: {
    text: 'Укажите размер группы:',
    options: [
      ['👥 Малая (5-10 детей)', '5-10 детей'],
      ['👨‍👩‍👧‍👦 Средняя (10-20 детей)', '10-20 детей'],
      ['👪 Большая (20-30 детей)', '20-30 детей'],
    ],
  },
  duration: {
    text: 'Какая продолжительность?',
    options: [
      ['⏱️ 15-20 минут', '15-20 минут'],
      ['⏰ 20-30 минут', '20-30 минут'],
      ['🕐 30-45 минут', '30-45 минут'],
      ['🕑 Более часа', 'более часа'],
    ],
  },
};

export async function handleContentTypeSelection(ctx, contentType) {
  const userId = ctx.from.id;

  // Проверяем лимит
  const remaining = getRemainingGenerations(userId, config.monthlyLimit);
  if (remaining <= 0) {
    await ctx.reply(
      '❌ Вы исчерпали лимит генераций на этот месяц.\n\n' +
      'Лимит обновится в начале следующего месяца.\n' +
      'Используйте /limits для просмотра статистики.'
    );
    return;
  }

  // Сохраняем начальное состояние
  saveUserState(userId, 'collecting_info', {
    contentType,
    step: 'ageGroup',
    data: {},
  });

  // Задаем первый вопрос
  await askQuestion(ctx, 'ageGroup');
}

async function askQuestion(ctx, questionKey) {
  const question = QUESTIONS[questionKey];
  const keyboard = new InlineKeyboard();

  question.options.forEach(([label, value]) => {
    keyboard.text(label, `answer:${questionKey}:${value}`).row();
  });

  // Добавляем кнопку пропуска для необязательных вопросов
  if (questionKey !== 'ageGroup') {
    keyboard.text('⏭️ Пропустить', `skip:${questionKey}`);
  }

  await ctx.reply(question.text, { reply_markup: keyboard });
}

export async function handleAnswer(ctx) {
  const userId = ctx.from.id;
  const data = ctx.callbackQuery.data;
  const [action, questionKey, ...valueParts] = data.split(':');
  const value = valueParts.join(':');

  const state = getUserState(userId);
  if (!state || state.state !== 'collecting_info') {
    await ctx.answerCallbackQuery('Сессия истекла. Начните заново.');
    return;
  }

  // Сохраняем ответ
  state.data.data[questionKey] = value;

  // Определяем следующий шаг
  const steps = ['ageGroup', 'groupSize', 'duration', 'final'];
  const currentIndex = steps.indexOf(questionKey);
  const nextStep = steps[currentIndex + 1];

  if (nextStep === 'final') {
    // Все вопросы заданы, запрашиваем описание
    state.data.step = 'awaiting_description';
    saveUserState(userId, state.state, state.data);

    await ctx.editMessageText('✅ Параметры сохранены!');
    await ctx.reply(
      `Теперь опишите, что вам нужно.\n\n` +
      `Например:\n` +
      `"Праздник осени с конкурсами и загадками"\n` +
      `"Занятие по развитию мелкой моторики"\n` +
      `"Подвижная игра на свежем воздухе"\n\n` +
      `Чем подробнее опишете, тем лучше будет результат.`
    );
  } else {
    // Задаем следующий вопрос
    state.data.step = nextStep;
    saveUserState(userId, state.state, state.data);

    await ctx.editMessageText(`✅ Сохранено: ${value}`);
    await askQuestion(ctx, nextStep);
  }

  await ctx.answerCallbackQuery();
}

export async function handleSkip(ctx) {
  const userId = ctx.from.id;
  const data = ctx.callbackQuery.data;
  const questionKey = data.split(':')[1];

  const state = getUserState(userId);
  if (!state || state.state !== 'collecting_info') {
    await ctx.answerCallbackQuery('Сессия истекла. Начните заново.');
    return;
  }

  // Определяем следующий шаг
  const steps = ['ageGroup', 'groupSize', 'duration', 'final'];
  const currentIndex = steps.indexOf(questionKey);
  const nextStep = steps[currentIndex + 1];

  if (nextStep === 'final') {
    state.data.step = 'awaiting_description';
    saveUserState(userId, state.state, state.data);

    await ctx.editMessageText('⏭️ Пропущено');
    await ctx.reply(
      `Теперь опишите, что вам нужно.\n\n` +
      `Чем подробнее опишете, тем лучше будет результат.`
    );
  } else {
    state.data.step = nextStep;
    saveUserState(userId, state.state, state.data);

    await ctx.editMessageText('⏭️ Пропущено');
    await askQuestion(ctx, nextStep);
  }

  await ctx.answerCallbackQuery();
}

export async function handleDescription(ctx) {
  const userId = ctx.from.id;
  const state = getUserState(userId);

  if (!state || state.state !== 'collecting_info' || state.data.step !== 'awaiting_description') {
    return; // Не наше сообщение
  }

  const description = ctx.message.text;

  if (description.length < 10) {
    await ctx.reply('Пожалуйста, опишите подробнее (минимум 10 символов).');
    return;
  }

  // Начинаем генерацию
  await ctx.reply('⏳ Генерирую контент... Это может занять некоторое время.');

  try {
    const contentType = state.data.contentType;
    const context = {
      ageGroup: state.data.data.ageGroup,
      groupSize: state.data.data.groupSize,
      duration: state.data.data.duration,
    };

    const result = await generateContent(contentType, description, context);

    // Сохраняем генерацию
    addGeneration(userId, contentType);

    // Очищаем состояние
    clearUserState(userId);

    // Отправляем результат
    const typeInfo = CONTENT_TYPES[contentType];
    const remaining = getRemainingGenerations(userId, config.monthlyLimit);

    await ctx.reply(
      `${typeInfo.emoji} ${typeInfo.name}\n\n${result}\n\n` +
      `---\n📊 Осталось генераций: ${remaining}`
    );

    // Предлагаем создать еще
    if (remaining > 0) {
      await ctx.reply(
        'Хотите создать что-то еще? Выберите тип контента из меню.',
        { reply_markup: { remove_keyboard: true } }
      );
    }
  } catch (error) {
    console.error('Ошибка генерации:', error);
    clearUserState(userId);
    await ctx.reply(
      '❌ Произошла ошибка при генерации контента.\n' +
      'Попробуйте еще раз позже или обратитесь к администратору.\n\n' +
      'Генерация не была учтена в вашем лимите.'
    );
  }
}

export async function handleCancel(ctx) {
  const userId = ctx.from.id;
  const state = getUserState(userId);

  if (state) {
    clearUserState(userId);
    await ctx.reply(
      '❌ Операция отменена.\n\n' +
      'Используйте /start для возврата в главное меню.'
    );
  } else {
    await ctx.reply('Нет активных операций для отмены.');
  }
}
