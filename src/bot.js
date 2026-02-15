import { Bot, session } from 'grammy';
import { config, validateConfig } from './config.js';
import { initDatabase } from './database/db.js';
import { checkSubscription } from './middleware/checkSubscription.js';
import { handleStart } from './handlers/start.js';
import { handleLimits } from './handlers/limits.js';
import { handleHelp } from './handlers/help.js';
import {
  handleContentTypeSelection,
  handleAnswer,
  handleSkip,
  handleDescription,
  handleCancel,
} from './handlers/generate.js';
import { CONTENT_TYPES } from './services/openrouter.js';

// Валидация конфигурации
try {
  validateConfig();
} catch (error) {
  console.error('❌ Ошибка конфигурации:', error.message);
  console.error('\nПроверьте файл .env и убедитесь, что все необходимые переменные заданы.');
  console.error('Пример см. в файле .env.example\n');
  process.exit(1);
}

// Инициализация базы данных
initDatabase();

// Создание бота
const bot = new Bot(config.botToken);

// Middleware для логирования
bot.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`[${new Date().toISOString()}] ${ctx.from?.id} - ${ctx.message?.text || ctx.callbackQuery?.data} (${ms}ms)`);
});

// Команды
bot.command('start', checkSubscription, handleStart);
bot.command('limits', checkSubscription, handleLimits);
bot.command('help', checkSubscription, handleHelp);
bot.command('cancel', checkSubscription, handleCancel);

// Обработка кнопок меню
bot.hears('📊 Мои лимиты', checkSubscription, handleLimits);
bot.hears('ℹ️ Помощь', checkSubscription, handleHelp);

// Обработка выбора типа контента
bot.hears('📋 Сценарий', checkSubscription, (ctx) =>
  handleContentTypeSelection(ctx, 'scenario')
);
bot.hears('💡 Методическая подсказка', checkSubscription, (ctx) =>
  handleContentTypeSelection(ctx, 'methodical')
);
bot.hears('🎨 Занятие', checkSubscription, (ctx) =>
  handleContentTypeSelection(ctx, 'activity')
);
bot.hears('🎮 Игра', checkSubscription, (ctx) =>
  handleContentTypeSelection(ctx, 'game')
);

// Обработка callback-запросов (ответы на вопросы)
bot.callbackQuery(/^answer:/, checkSubscription, handleAnswer);
bot.callbackQuery(/^skip:/, checkSubscription, handleSkip);

// Обработка текстовых сообщений (описание запроса)
bot.on('message:text', checkSubscription, handleDescription);

// Обработка ошибок
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Ошибка при обработке обновления ${ctx.update.update_id}:`);
  const e = err.error;

  if (e instanceof Error) {
    console.error('Ошибка:', e.message);
    console.error(e.stack);
  } else {
    console.error('Неизвестная ошибка:', e);
  }

  // Уведомляем пользователя
  if (ctx.chat) {
    ctx.reply(
      '❌ Произошла ошибка при обработке вашего запроса.\n' +
      'Попробуйте еще раз или обратитесь к администратору.'
    ).catch(console.error);
  }
});

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\n🛑 Получен SIGINT, останавливаю бота...');
  bot.stop();
});

process.once('SIGTERM', () => {
  console.log('\n🛑 Получен SIGTERM, останавливаю бота...');
  bot.stop();
});

// Запуск бота
console.log('🤖 Запуск бота "Помощник воспитателя"...');
console.log(`📊 Лимит генераций: ${config.monthlyLimit} в месяц`);
console.log(`🤖 Модель: ${config.openRouterModel}`);

bot.start({
  onStart: () => {
    console.log('✅ Бот успешно запущен и готов к работе!');
  },
});
