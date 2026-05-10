/**
 * Утилиты для работы с Telegram API
 */

// Максимальная длина сообщения в Telegram (для всех пользователей, включая Premium)
const MAX_MESSAGE_LENGTH = 4096;

/**
 * Разбивает длинный текст на части, не превышающие лимит Telegram
 * @param {string} text - Текст для разбивки
 * @param {number} maxLength - Максимальная длина части (по умолчанию 4096)
 * @returns {string[]} - Массив частей текста
 */
export function splitLongMessage(text, maxLength = MAX_MESSAGE_LENGTH) {
  if (text.length <= maxLength) {
    return [text];
  }

  const parts = [];
  let currentPart = '';

  // Разбиваем по параграфам (двойной перенос строки)
  const paragraphs = text.split('\n\n');

  for (const paragraph of paragraphs) {
    // Если один параграф уже больше лимита
    if (paragraph.length > maxLength) {
      // Если есть накопленный текст - сохраняем его
      if (currentPart) {
        parts.push(currentPart.trim());
        currentPart = '';
      }

      // Разбиваем длинный параграф по предложениям
      const sentences = paragraph.split(/([.!?]\s+)/);
      let tempPart = '';

      for (const sentence of sentences) {
        if ((tempPart + sentence).length > maxLength) {
          if (tempPart) {
            parts.push(tempPart.trim());
            tempPart = sentence;
          } else {
            // Если даже одно предложение больше лимита - разбиваем по символам
            const chunks = sentence.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
            parts.push(...chunks.map(c => c.trim()));
          }
        } else {
          tempPart += sentence;
        }
      }

      if (tempPart) {
        currentPart = tempPart;
      }
    } else {
      // Проверяем, поместится ли параграф в текущую часть
      if ((currentPart + '\n\n' + paragraph).length > maxLength) {
        // Не поместится - сохраняем текущую часть и начинаем новую
        if (currentPart) {
          parts.push(currentPart.trim());
        }
        currentPart = paragraph;
      } else {
        // Поместится - добавляем к текущей части
        currentPart += (currentPart ? '\n\n' : '') + paragraph;
      }
    }
  }

  // Добавляем последнюю часть
  if (currentPart) {
    parts.push(currentPart.trim());
  }

  return parts.length > 0 ? parts : [text.substring(0, maxLength)];
}

/**
 * Отправляет длинное сообщение, автоматически разбивая его на части
 * @param {Context} ctx - Контекст grammY
 * @param {string} text - Текст для отправки
 * @param {Object} options - Дополнительные опции (reply_markup и т.д.)
 */
export async function sendLongMessage(ctx, text, options = {}) {
  const parts = splitLongMessage(text);

  if (parts.length === 1) {
    // Если текст поместился в одно сообщение
    console.log(`[sendLongMessage] Отправка одного сообщения (${text.length} символов)`);
    return await ctx.reply(text, options);
  }

  console.log(`[sendLongMessage] Разбито на ${parts.length} частей`);

  // Отправляем несколько сообщений
  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1;
    const part = parts[i];

    // Добавляем индикатор части
    const partText = `${part}\n\n📄 Часть ${i + 1}/${parts.length}`;

    // reply_markup добавляем только к последнему сообщению
    const partOptions = isLast ? options : {};

    try {
      await ctx.reply(partText, partOptions);
      console.log(`[sendLongMessage] ✅ Часть ${i + 1}/${parts.length} отправлена (${partText.length} символов)`);
    } catch (error) {
      console.error(`[sendLongMessage] ❌ Ошибка отправки части ${i + 1}/${parts.length}:`, error);
      throw new Error(`Не удалось отправить часть ${i + 1} из ${parts.length}: ${error.message}`);
    }

    // Небольшая задержка между сообщениями, чтобы не словить rate limit
    if (!isLast) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`[sendLongMessage] ✅ Все ${parts.length} части отправлены успешно`);
}
