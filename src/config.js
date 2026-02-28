import dotenv from 'dotenv';

dotenv.config();

// ID администраторов с безлимитными запросами
export const ADMIN_IDS = [369960686, 811069094];

export const config = {
  botToken: process.env.BOT_TOKEN,
  premiumChannelId: process.env.PREMIUM_CHANNEL_ID,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  openRouterModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
  monthlyLimit: parseInt(process.env.MONTHLY_LIMIT) || 10,
};

// Валидация конфигурации
export function validateConfig() {
  const required = ['botToken', 'premiumChannelId', 'openRouterApiKey'];
  const missing = required.filter(key => !config[key]);

  if (missing.length > 0) {
    throw new Error(`Отсутствуют обязательные переменные окружения: ${missing.join(', ')}`);
  }
}
