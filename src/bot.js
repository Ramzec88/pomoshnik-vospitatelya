import { Bot, session } from 'grammy';
import { createServer } from 'http';
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
// ВАЖНО: не бросаем ошибки дальше, чтобы не останавливать polling
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`[${new Date().toISOString()}] Ошибка при обработке обновления ${ctx.update.update_id}:`);
  const e = err.error;

  if (e instanceof Error) {
    console.error('Ошибка:', e.message);
    console.error('Stack:', e.stack);
  } else {
    console.error('Неизвестная ошибка:', e);
  }

  // Уведомляем пользователя (без выброса ошибки)
  if (ctx?.chat) {
    ctx.reply(
      '❌ Произошла ошибка при обработке вашего запроса.\n' +
      'Попробуйте еще раз или обратитесь к администратору.'
    ).catch((replyError) => {
      console.error('Не удалось отправить сообщение об ошибке:', replyError.message);
    });
  }

  // НЕ бросаем ошибку дальше - бот продолжает работать
});

// HTTP Health Check сервер для Railway/Render и других платформ
// Это предотвращает автоматическую остановку контейнера на бесплатных планах
const PORT = process.env.PORT || 3000;
const server = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      bot: 'running',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 HTTP health check сервер запущен на порту ${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n🛑 Получен сигнал остановки, завершаю работу...');
  bot.stop();
  server.close(() => {
    console.log('✅ HTTP сервер остановлен');
    process.exit(0);
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

// Запуск бота
console.log('🤖 Запуск бота "Помощник воспитателя"...');
console.log(`📊 Лимит генераций: ${config.monthlyLimit} в месяц`);
console.log(`🤖 Модель: ${config.openRouterModel}`);

bot.start({
  onStart: () => {
    console.log('✅ Бот успешно запущен и готов к работе!');
  },
});
