import { Bot, session } from 'grammy';
import { createServer } from 'http';
import { config, validateConfig } from './config.js';
import { initDatabase, closeDatabase } from './database/db-postgres.js';
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
import { handleAnalytics, handleAdminCallback } from './handlers/admin.js';
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
await initDatabase();

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
bot.command('analytics', handleAnalytics);

// Обработка кнопок меню
bot.hears('📊 Мои лимиты', checkSubscription, handleLimits);
bot.hears('ℹ️ Помощь', checkSubscription, handleHelp);

// Обработка выбора типа контента
bot.hears('📋 Сценарий', checkSubscription, (ctx) =>
  handleContentTypeSelection(ctx, 'scenario')
);
bot.hears('🎵 Песня и ноты', checkSubscription, (ctx) =>
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
// Callback-запросы администратора
bot.callbackQuery(/^admin:/, handleAdminCallback);

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
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN; // например: your-app.railway.app
const USE_WEBHOOK = !!WEBHOOK_DOMAIN;

const server = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      bot: 'running',
      mode: USE_WEBHOOK ? 'webhook' : 'polling',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
  }
  // Webhook endpoint для Telegram
  else if (USE_WEBHOOK && req.url === `/webhook/${config.botToken}`) {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const update = JSON.parse(body);
          await bot.handleUpdate(update);
          res.writeHead(200);
          res.end('OK');
        } catch (error) {
          console.error('Ошибка обработки webhook:', error);
          res.writeHead(500);
          res.end('Error');
        }
      });
    } else {
      res.writeHead(405);
      res.end('Method Not Allowed');
    }
  }
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 HTTP сервер запущен на порту ${PORT}`);
  console.log(`📡 Режим работы: ${USE_WEBHOOK ? 'webhook' : 'polling'}`);
});

// Keep-alive механизм: пингуем сами себя каждые 5 минут
if (USE_WEBHOOK) {
  setInterval(() => {
    const url = `https://${WEBHOOK_DOMAIN}/health`;
    fetch(url)
      .then(() => console.log(`[${new Date().toISOString()}] Keep-alive ping успешен`))
      .catch(err => console.error(`[${new Date().toISOString()}] Keep-alive ping failed:`, err.message));
  }, 5 * 60 * 1000); // каждые 5 минут
}

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Получен сигнал остановки, завершаю работу...');

  // Удаляем webhook если использовался
  if (USE_WEBHOOK) {
    try {
      await bot.api.deleteWebhook();
      console.log('✅ Webhook удалён');
    } catch (error) {
      console.error('⚠️ Ошибка удаления webhook:', error.message);
    }
  }

  // Останавливаем бота
  await bot.stop();
  console.log('✅ Бот остановлен');

  // Закрываем соединение с базой данных
  try {
    await closeDatabase();
  } catch (error) {
    console.error('⚠️ Ошибка закрытия БД:', error.message);
  }

  // Закрываем HTTP сервер
  server.close(() => {
    console.log('✅ HTTP сервер остановлен');
    process.exit(0);
  });

  // Принудительный выход через 10 секунд если что-то зависло
  setTimeout(() => {
    console.error('⚠️ Принудительное завершение через 10 секунд');
    process.exit(1);
  }, 10000);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

// Запуск бота
console.log('🤖 Запуск бота "Помощник воспитателя"...');
console.log(`📊 Лимит генераций: ${config.monthlyLimit} в месяц`);
console.log(`🤖 Модель: ${config.openRouterModel}`);

if (USE_WEBHOOK) {
  // Webhook режим для production (Railway/Render)
  const webhookUrl = `https://${WEBHOOK_DOMAIN}/webhook/${config.botToken}`;

  // ВАЖНО: Инициализируем бота ПЕРЕД установкой webhook
  // Это необходимо для работы bot.handleUpdate() в webhook режиме
  (async () => {
    try {
      await bot.init();
      console.log(`🤖 Бот инициализирован: @${bot.botInfo.username}`);

      // Устанавливаем webhook
      await bot.api.setWebhook(webhookUrl);
      console.log(`✅ Webhook установлен: ${webhookUrl}`);
      console.log('✅ Бот успешно запущен в режиме webhook!');
    } catch (error) {
      console.error('❌ Ошибка запуска бота:', error);
      process.exit(1);
    }
  })();
} else {
  // Polling режим для локальной разработки
  bot.start({
    onStart: () => {
      console.log('✅ Бот успешно запущен в режиме polling!');
    },
    // Настройки для более надёжного polling
    allowed_updates: ['message', 'callback_query'],
  }).catch((error) => {
    console.error('❌ Ошибка запуска бота:', error);
    process.exit(1);
  });
}
