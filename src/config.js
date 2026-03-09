import dotenv from 'dotenv';

dotenv.config();

// ID администраторов с безлимитными запросами
export const ADMIN_IDS = [369960686, 811069094];

// ID каналов для tier-системы
export const FREE_CHANNEL_ID = '-1002634183424'; // Открытый канал "Мишка Макс"
export const PREMIUM_CHANNEL_ID = process.env.PREMIUM_CHANNEL_ID; // Закрытый канал педагогов

// Лимиты по уровням доступа
export const TIER_LIMITS = {
  free: 2,      // Подписчик открытого канала
  premium: 10,  // Подписчик закрытого канала
  admin: Infinity // Администраторы
};

export const config = {
  botToken: process.env.BOT_TOKEN,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  openRouterModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
};

// Валидация конфигурации
export function validateConfig() {
  const required = ['botToken', 'openRouterApiKey'];
  const missing = required.filter(key => !config[key]);

  if (missing.length > 0) {
    throw new Error(`Отсутствуют обязательные переменные окружения: ${missing.join(', ')}`);
  }

  if (!PREMIUM_CHANNEL_ID) {
    throw new Error('Не задана переменная окружения PREMIUM_CHANNEL_ID');
  }
}
