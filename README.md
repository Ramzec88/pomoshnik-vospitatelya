# 🤖 Помощник воспитателя - Telegram Bot

Интеллектуальный Telegram бот для воспитателей детских садов, который помогает генерировать:
- 📋 Сценарии мероприятий и праздников
- 💡 Методические рекомендации и подсказки
- 🎨 Развивающие занятия для детей
- 🎮 Детские игры и игровые методики

Бот использует OpenRouter API для генерации качественного контента и работает только для подписчиков платного канала с лимитом 10 генераций в месяц.

## ✨ Возможности

- ✅ Проверка подписки на платный Telegram канал
- ✅ Интеграция с OpenRouter (Claude, GPT-4, и другие модели)
- ✅ Система лимитов (10 генераций в месяц на пользователя)
- ✅ Интерактивный сбор информации о параметрах (возраст, группа, тема)
- ✅ 4 типа контента: сценарии, методические материалы, занятия, игры
- ✅ PostgreSQL база данных для надежного хранения данных
- ✅ Удобное меню и интуитивный интерфейс
- ✅ HTTP health check для деплоя на Railway/Render
- ✅ Устойчивая обработка ошибок (не падает при проблемах)

## 🌐 Деплой на хостинг

**Для деплоя на Railway, Render или VPS см. [DEPLOYMENT.md](DEPLOYMENT.md)**

Краткая инструкция для Railway (рекомендуется):

### 1. Добавьте PostgreSQL базу данных
   - В вашем проекте нажмите "+ New" → "Database" → "Add PostgreSQL"
   - Railway автоматически создаст переменную `DATABASE_URL`
   - ✅ **Важно:** База данных сохранит данные даже после перезапуска!

### 2. Настройте бота
   - Создайте проект на [railway.app](https://railway.app)
   - Подключите GitHub репозиторий
   - Получите домен: Settings → Networking → Generate Domain

### 3. Добавьте переменные окружения:
   - `BOT_TOKEN` - токен от @BotFather
   - `PREMIUM_CHANNEL_ID` - ID вашего канала
   - `OPENROUTER_API_KEY` - ключ от OpenRouter
   - `WEBHOOK_DOMAIN` - домен из шага 2 (БЕЗ https://)
   - `DATABASE_URL` - **автоматически создается** при добавлении PostgreSQL

### 4. Финальная настройка
   - Настройте Health Check: `/health`
   - Установите Restart Policy: Always
   - Дождитесь деплоя

**⚠️ Важно:**
- Обязательно добавьте PostgreSQL ПЕРЕД первым запуском!
- Установите `WEBHOOK_DOMAIN` чтобы бот не "засыпал"!
- После каждого деплоя данные (лимиты) НЕ обнуляются! ✅

Подробные инструкции со скриншотами и решением проблем: [DEPLOYMENT.md](DEPLOYMENT.md)

## 🚀 Локальная установка

### Требования

- Node.js 18+ (рекомендуется 20+)
- PostgreSQL 12+ (для локальной разработки)
- npm или yarn
- Telegram Bot Token
- OpenRouter API Key
- Приватный Telegram канал

### Шаг 1: Клонирование репозитория

```bash
git clone <url-репозитория>
cd pomoshnik-vospitatelya
```

### Шаг 2: Установка зависимостей

```bash
npm install
```

### Шаг 3: Настройка PostgreSQL (локально)

**Вариант 1: Установка PostgreSQL локально**
```bash
# macOS (Homebrew)
brew install postgresql@14
brew services start postgresql@14

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Windows
# Скачайте установщик с https://www.postgresql.org/download/windows/
```

Создайте базу данных:
```bash
# Подключитесь к PostgreSQL
psql postgres

# Создайте базу данных
CREATE DATABASE pomoshnik;

# Выйдите
\q
```

**Вариант 2: Docker (проще)**
```bash
docker run --name pomoshnik-postgres \
  -e POSTGRES_DB=pomoshnik \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:14
```

**Вариант 3: Облачная БД (Supabase, Railway)**
- Создайте бесплатную PostgreSQL на [supabase.com](https://supabase.com) или [railway.app](https://railway.app)
- Получите `DATABASE_URL` и используйте его в `.env`

### Шаг 4: Настройка переменных окружения

1. Скопируйте файл `.env.example` в `.env`:
```bash
cp .env.example .env
```

2. Откройте `.env` и заполните все необходимые данные:

```env
# Получите у @BotFather в Telegram
BOT_TOKEN=your_bot_token_here

# ID вашего платного канала
# Чтобы получить ID канала:
# 1. Добавьте бота @userinfobot в ваш канал
# 2. Перешлите любое сообщение из канала боту
# 3. Скопируйте ID канала (формат: -100XXXXXXXXXX)
PREMIUM_CHANNEL_ID=-1001234567890

# Получите на https://openrouter.ai/keys
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Модель для генерации (опционально)
# Доступные модели: https://openrouter.ai/models
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet

# Лимит генераций (по умолчанию 10)
MONTHLY_LIMIT=10

# PostgreSQL Database URL
# Для локальной разработки:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pomoshnik
# Для Railway/Render: устанавливается автоматически
```

### Шаг 5: Настройка Telegram бота

1. **Создайте бота через @BotFather:**
   - Отправьте `/newbot`
   - Введите имя бота (например: "Помощник воспитателя")
   - Введите username бота (например: "pomoshnik_vospitatelya_bot")
   - Сохраните полученный токен в `.env`

2. **Добавьте бота в ваш платный канал:**
   - Откройте настройки канала
   - Administrators → Add Administrator
   - Найдите вашего бота и добавьте его
   - Дайте права: "Add new admins" НЕ нужно, остальные по желанию

3. **Получите ID канала:**
   - Добавьте @userinfobot в канал
   - Перешлите любое сообщение из канала боту
   - Скопируйте Chat ID (например: -1001234567890)
   - Удалите @userinfobot из канала

### Шаг 6: Получите OpenRouter API ключ

1. Зарегистрируйтесь на https://openrouter.ai
2. Перейдите в раздел Keys: https://openrouter.ai/keys
3. Создайте новый API ключ
4. Пополните баланс (минимум $5 рекомендуется)
5. Скопируйте ключ в `.env`

## 📦 Запуск

### Режим разработки (с авто-перезагрузкой)

```bash
npm run dev
```

### Продакшн режим

```bash
npm start
```

### Использование PM2 (рекомендуется для продакшна)

```bash
# Установите PM2
npm install -g pm2

# Запустите бота
pm2 start src/bot.js --name pomoshnik-vospitatelya

# Автозапуск при перезагрузке сервера
pm2 startup
pm2 save

# Просмотр логов
pm2 logs pomoshnik-vospitatelya

# Перезапуск
pm2 restart pomoshnik-vospitatelya

# Остановка
pm2 stop pomoshnik-vospitatelya
```

## 📱 Использование бота

### Команды

- `/start` - Запуск бота и главное меню
- `/limits` - Посмотреть оставшиеся генерации
- `/help` - Справка по использованию
- `/cancel` - Отменить текущую операцию

### Процесс генерации

1. Выберите тип контента из меню:
   - 📋 Сценарий
   - 💡 Методическая подсказка
   - 🎨 Занятие
   - 🎮 Игра

2. Ответьте на вопросы:
   - Возрастная группа детей
   - Размер группы (опционально)
   - Продолжительность (опционально)

3. Опишите, что вам нужно:
   - "Праздник осени с конкурсами и загадками"
   - "Занятие по развитию мелкой моторики"
   - "Подвижная игра на свежем воздухе"

4. Получите готовый материал!

## 🏗️ Структура проекта

```
pomoshnik-vospitatelya/
├── src/
│   ├── bot.js                 # Основной файл бота
│   ├── config.js              # Конфигурация
│   ├── database/
│   │   └── db-postgres.js     # PostgreSQL база данных
│   ├── handlers/
│   │   ├── start.js           # Обработчик /start
│   │   ├── limits.js          # Обработчик лимитов
│   │   ├── help.js            # Обработчик помощи
│   │   └── generate.js        # Генерация контента
│   ├── middleware/
│   │   └── checkSubscription.js  # Проверка подписки
│   └── services/
│       └── openrouter.js      # Интеграция с OpenRouter
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## 🔧 Настройка и кастомизация

### Изменение лимита генераций

Измените значение `MONTHLY_LIMIT` в `.env`:
```env
MONTHLY_LIMIT=20
```

### Изменение модели OpenRouter

Выберите модель из списка: https://openrouter.ai/models

Например:
```env
# Claude 3.5 Sonnet (рекомендуется)
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet

# GPT-4 Turbo
OPENROUTER_MODEL=openai/gpt-4-turbo

# GPT-3.5 Turbo (дешевле)
OPENROUTER_MODEL=openai/gpt-3.5-turbo
```

### Добавление новых типов контента

Отредактируйте файл `src/services/openrouter.js`:

1. Добавьте системный промпт в `SYSTEM_PROMPTS`
2. Добавьте тип в `CONTENT_TYPES`
3. Добавьте кнопку в `src/handlers/start.js`
4. Добавьте обработчик в `src/bot.js`

## 🐛 Решение проблем

### Бот не отвечает на команды

1. Проверьте, что бот запущен: `pm2 list` или проверьте консоль
2. Убедитесь, что BOT_TOKEN правильный
3. Проверьте логи: `pm2 logs` или консоль

### Ошибка "Не удалось проверить подписку"

1. Убедитесь, что бот добавлен в канал как администратор
2. Проверьте правильность PREMIUM_CHANNEL_ID
3. ID канала должен начинаться с `-100`

### Ошибка OpenRouter API

1. Проверьте баланс на https://openrouter.ai/account
2. Убедитесь, что API ключ активен
3. Проверьте доступность выбранной модели

### Ошибка подключения к базе данных

Если возникает ошибка PostgreSQL:
```bash
# Проверьте что PostgreSQL запущен
# macOS:
brew services list

# Linux:
sudo systemctl status postgresql

# Проверьте DATABASE_URL в .env
echo $DATABASE_URL

# Для Docker:
docker ps | grep postgres
```

## 💰 Стоимость использования

OpenRouter взимает плату за использование API в зависимости от модели:

- Claude 3.5 Sonnet: ~$3 за 1M токенов (вход), ~$15 за 1M токенов (выход)
- GPT-4 Turbo: ~$10 за 1M токенов (вход), ~$30 за 1M токенов (выход)
- GPT-3.5 Turbo: ~$0.50 за 1M токенов (вход/выход)

Средняя генерация: ~500-1000 токенов (вход) + ~1500-2000 токенов (выход)

**Примерная стоимость:**
- Claude 3.5 Sonnet: $0.02-0.04 за генерацию
- GPT-4 Turbo: $0.05-0.08 за генерацию
- GPT-3.5 Turbo: $0.001-0.002 за генерацию

## 📊 Мониторинг

### Просмотр статистики использования

База данных PostgreSQL содержит:
- Список пользователей
- История всех генераций
- Текущие состояния пользователей

Для просмотра данных используйте `psql` или любой PostgreSQL клиент:

**Локально:**
```bash
# Подключение к базе
psql postgresql://postgres:postgres@localhost:5432/pomoshnik

# Посмотреть всех пользователей
SELECT * FROM users;

# Статистика генераций по пользователям
SELECT user_id, COUNT(*) as count
FROM generations
GROUP BY user_id;

# Генерации за текущий месяц
SELECT * FROM generations
WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_TIMESTAMP);
```

**Railway:**
```bash
# Получите DATABASE_URL из Variables и подключитесь
railway connect postgres
# или используйте веб-интерфейс Railway для просмотра данных
```

## 🔐 Безопасность

- ✅ Никогда не коммитьте файл `.env` в git
- ✅ Храните API ключи в безопасности
- ✅ Регулярно проверяйте баланс OpenRouter
- ✅ Ограничьте доступ к PostgreSQL (используйте пароли)
- ✅ Делайте резервные копии базы данных (Railway делает автоматически)

## 📝 Лицензия

ISC

## 🤝 Поддержка

Если у вас возникли вопросы или проблемы:
1. Проверьте раздел "Решение проблем"
2. Изучите логи бота
3. Обратитесь к документации OpenRouter и Grammy

---

Создано с ❤️ для воспитателей детских садов
