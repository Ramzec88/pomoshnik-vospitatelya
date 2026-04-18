import axios from 'axios';
import { config } from '../config.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Системные промпты для разных типов контента
const SYSTEM_PROMPTS = {
  scenario: `Ты опытный воспитатель детского сада с большим стажем работы.
Создавай подробные, интересные и развивающие сценарии занятий для детей.
Учитывай возрастные особенности, безопасность и образовательную ценность.
Структурируй ответ с четкими этапами: введение, основная часть, заключение.`,

  methodical: `Ты опытный музыкальный педагог и композитор детских песен.
Создавай детские песни с понятными, запоминающимися словами и простыми мелодиями.
ОБЯЗАТЕЛЬНО добавляй нотную запись в текстовом виде после текста песни.

Структура ответа:
1. **Название песни**
2. **Текст песни** (куплеты и припев с понятными словами)
3. **Ноты** (текстовая нотная запись: названия нот с длительностью и тактами)

Пример нотной записи:
Куплет 1, такт 1-2: C4 (четверть) D4 (четверть) E4 (половина) | G4 (четверть) G4 (четверть) A4 (половина)

Учитывай возраст детей, делай мелодию простой и образовательно ценной.`,

  activity: `Ты креативный педагог, специализирующийся на разработке развивающих занятий.
Создавай увлекательные и образовательные занятия, которые развивают различные навыки детей.
Включай цели занятия, необходимые материалы, пошаговый план и варианты адаптации.`,

  game: `Ты эксперт по детским играм и игровым методикам в дошкольном образовании.
Разрабатывай веселые, безопасные и развивающие игры для детей.
Указывай возраст, количество участников, правила, инвентарь и педагогические цели игры.`,
};

function stripMarkdown(text) {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^[*-]\s+/gm, '• ')
    .replace(/_{3,}/g, '———')
    .trim();
}

export async function generateContent(contentType, userPrompt, userContext = {}) {
  const systemPrompt = SYSTEM_PROMPTS[contentType] || SYSTEM_PROMPTS.scenario;

  // Формируем расширенный промпт с учетом контекста
  let fullPrompt = userPrompt;

  if (userContext.ageGroup) {
    fullPrompt = `Возраст детей: ${userContext.ageGroup}\n\n${fullPrompt}`;
  }

  if (userContext.groupSize) {
    fullPrompt = `Количество детей: ${userContext.groupSize}\n\n${fullPrompt}`;
  }

  if (userContext.duration) {
    fullPrompt = `Продолжительность: ${userContext.duration}\n\n${fullPrompt}`;
  }

  if (userContext.theme) {
    fullPrompt = `Тема: ${userContext.theme}\n\n${fullPrompt}`;
  }

  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: config.openRouterModel,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: fullPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/pomoshnik-vospitatelya',
          'X-Title': 'Pomoshnik Vospitatelya Bot',
        },
      }
    );

    return stripMarkdown(response.data.choices[0].message.content);
  } catch (error) {
    console.error('Ошибка OpenRouter API:', error.response?.data || error.message);
    throw new Error('Не удалось сгенерировать контент. Попробуйте позже.');
  }
}

// Типы контента с их описаниями
export const CONTENT_TYPES = {
  scenario: {
    name: 'Сценарий',
    emoji: '📋',
    description: 'Сценарий мероприятия или праздника',
  },
  methodical: {
    name: 'Песня и ноты',
    emoji: '🎵',
    description: 'Детская песня с нотами',
  },
  activity: {
    name: 'Занятие',
    emoji: '🎨',
    description: 'Развивающее занятие',
  },
  game: {
    name: 'Игра',
    emoji: '🎮',
    description: 'Детская игра',
  },
};
