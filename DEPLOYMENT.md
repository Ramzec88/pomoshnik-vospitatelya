# 🚀 Инструкция по деплою

Подробная инструкция по развертыванию бота "Помощник воспитателя" на различных платформах.

## 📋 Содержание

- [Railway (рекомендуется)](#railway)
- [Render](#render)
- [VPS (собственный сервер)](#vps)
- [Решение проблем](#troubleshooting)

---

## Railway

Railway — рекомендуемая платформа для деплоя. Бесплатный план: $5 кредитов в месяц.

### Шаг 1: Подготовка

1. Создайте аккаунт на [railway.app](https://railway.app)
2. Установите Railway CLI (опционально):
   ```bash
   npm install -g @railway/cli
   ```

### Шаг 2: Создание проекта

**Через веб-интерфейс:**

1. Зайдите на [railway.app](https://railway.app)
2. Нажмите "New Project"
3. Выберите "Deploy from GitHub repo"
4. Выберите репозиторий `pomoshnik-vospitatelya`
5. Railway автоматически определит Node.js проект

**Через CLI:**

```bash
# В директории проекта
railway login
railway init
railway up
```

### Шаг 3: Настройка переменных окружения

В Railway Dashboard → Variables, добавьте:

```env
BOT_TOKEN=ваш_токен_бота
PREMIUM_CHANNEL_ID=-1001234567890
OPENROUTER_API_KEY=ваш_ключ_openrouter
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
MONTHLY_LIMIT=10
```

**ВАЖНО:** Переменная `PORT` не нужна - Railway установит её автоматически.

### Шаг 4: Настройка Health Check

1. Откройте Settings → Healthcheck
2. Установите:
   - **Health Check Path:** `/health`
   - **Health Check Timeout:** 60 секунд
   - **Health Check Interval:** 300 секунд (5 минут)

Это предотвратит автоматическую остановку контейнера!

### Шаг 5: Настройка Restart Policy

1. Settings → Deploy
2. **Restart Policy:** Always
3. **Restart Policy Max Retries:** 3

Теперь при падении бота Railway автоматически перезапустит его.

### Шаг 6: Деплой

Railway автоматически задеплоит бота при:
- Push в main ветку (если настроен auto-deploy)
- Ручном триггере через Dashboard

Проверьте логи: Dashboard → Deployments → View Logs

### Проверка работы

```bash
# Проверьте health endpoint
curl https://ваш-домен.railway.app/health

# Должен вернуть:
# {"status":"ok","bot":"running","uptime":123.45,"timestamp":"2024-..."}
```

---

## Render

Render предоставляет бесплатный план с ограничениями (засыпает после 15 мин неактивности).

### Шаг 1: Создание Web Service

1. Зайдите на [render.com](https://render.com)
2. New → Web Service
3. Подключите GitHub репозиторий
4. Настройки:
   - **Name:** pomoshnik-vospitatelya
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free

### Шаг 2: Переменные окружения

Добавьте в Environment:

```env
BOT_TOKEN=ваш_токен
PREMIUM_CHANNEL_ID=-100...
OPENROUTER_API_KEY=sk-...
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
MONTHLY_LIMIT=10
```

### Шаг 3: Health Check

Render → Settings → Health Check Path: `/health`

**ВАЖНО:** На бесплатном плане Render всё равно будет засыпать, но health check поможет быстрее проснуться при запросе.

### Шаг 4: Деплой

Нажмите "Create Web Service" — Render задеплоит автоматически.

---

## VPS

Деплой на собственном сервере (Ubuntu/Debian).

### Требования

- Ubuntu 20.04+ или Debian 11+
- Node.js 18+
- PM2 (рекомендуется)

### Шаг 1: Установка Node.js

```bash
# Установка Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка
node --version
npm --version
```

### Шаг 2: Клонирование репозитория

```bash
cd /opt
sudo git clone https://github.com/ваш-username/pomoshnik-vospitatelya.git
cd pomoshnik-vospitatelya
sudo chown -R $USER:$USER .
```

### Шаг 3: Установка зависимостей

```bash
npm install --production
```

### Шаг 4: Настройка .env

```bash
cp .env.example .env
nano .env
```

Заполните все переменные.

### Шаг 5: Установка PM2

```bash
sudo npm install -g pm2
```

### Шаг 6: Запуск с PM2

```bash
# Запуск
pm2 start src/bot.js --name pomoshnik-vospitatelya

# Автозапуск при перезагрузке
pm2 startup
pm2 save

# Просмотр логов
pm2 logs pomoshnik-vospitatelya

# Мониторинг
pm2 monit
```

### Шаг 7: Nginx (опционально)

Если хотите добавить домен к health check:

```nginx
server {
    listen 80;
    server_name bot.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Troubleshooting

### Бот останавливается на Railway

**Причина:** Нет активного HTTP порта или health check не настроен.

**Решение:**
1. Убедитесь, что в коде есть HTTP-сервер (уже добавлен)
2. Настройте Health Check Path: `/health` в Railway Settings
3. Проверьте, что переменная PORT не установлена вручную

### Ошибка "FOREIGN KEY constraint failed"

**Причина:** Попытка сохранить данные для несуществующего пользователя.

**Решение:** Уже исправлено в коде - пользователь создаётся автоматически.

### Бот не отвечает на сообщения

**Проверки:**
1. Логи: `pm2 logs` или Railway Dashboard
2. Проверьте BOT_TOKEN
3. Убедитесь, что бот не забанен Telegram
4. Проверьте, что PREMIUM_CHANNEL_ID правильный

### Health check возвращает 404

**Причина:** Запрос идёт не на `/health` или `/`

**Решение:**
```bash
# Правильно
curl https://your-app.railway.app/health

# Неправильно
curl https://your-app.railway.app/api/health
```

### Бот перезапускается постоянно

**Причина:** Ошибка в конфигурации или база данных заблокирована.

**Решение:**
1. Проверьте логи: найдите ошибку
2. Убедитесь, что все переменные окружения заданы
3. Удалите `users.db` и перезапустите (данные будут потеряны)
4. Проверьте права на запись в директорию

### OpenRouter API ошибка

**Причина:** Нет баланса или неверный API ключ.

**Решение:**
1. Проверьте баланс на https://openrouter.ai/account
2. Проверьте API ключ в переменных окружения
3. Убедитесь, что выбранная модель доступна

---

## Мониторинг и логи

### Railway
```bash
# Через CLI
railway logs

# Через Dashboard
Dashboard → Deployments → View Logs
```

### Render
```bash
# Только через Dashboard
Dashboard → Logs
```

### VPS с PM2
```bash
# Просмотр логов
pm2 logs pomoshnik-vospitatelya

# Только ошибки
pm2 logs pomoshnik-vospitatelya --err

# Последние 100 строк
pm2 logs pomoshnik-vospitatelya --lines 100

# Мониторинг в реальном времени
pm2 monit
```

---

## Обновление бота

### Railway
Автоматически при push в GitHub (если настроен auto-deploy).

Вручную:
```bash
railway up
```

### Render
Автоматически при push в GitHub.

Вручную: Dashboard → Manual Deploy → Deploy latest commit

### VPS
```bash
cd /opt/pomoshnik-vospitatelya
git pull
npm install
pm2 restart pomoshnik-vospitatelya
```

---

## Резервное копирование

База данных `users.db` содержит все данные пользователей.

### Backup на VPS
```bash
# Создание backup
cp users.db users.db.backup.$(date +%Y%m%d)

# Автоматический backup (cron)
crontab -e

# Добавьте:
0 2 * * * cd /opt/pomoshnik-vospitatelya && cp users.db users.db.backup.$(date +\%Y\%m\%d)
```

### Backup на Railway/Render
Используйте Railway Volumes или скачивайте базу вручную через CLI:

```bash
# Railway
railway run cat users.db > users.db.backup
```

---

## Полезные ссылки

- [Railway Documentation](https://docs.railway.app)
- [Render Documentation](https://render.com/docs)
- [PM2 Documentation](https://pm2.keymetrics.io/docs)
- [Grammy Documentation](https://grammy.dev)
- [OpenRouter API](https://openrouter.ai/docs)
