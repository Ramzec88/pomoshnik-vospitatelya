# 🚀 Настройка UptimeRobot для постоянной работы бота

Railway на бесплатном плане усыпляет контейнеры без внешней активности.
UptimeRobot будет пинговать ваш бот каждые 5 минут, предотвращая засыпание.

## 📝 Инструкция:

### 1. Регистрация на UptimeRobot

1. Перейдите: https://uptimerobot.com/
2. Нажмите **Sign Up** (регистрация бесплатная)
3. Подтвердите email

### 2. Создание монитора

1. После входа нажмите **+ Add New Monitor**
2. Заполните форму:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** `Pomoshnik Vospitatelya Bot`
   - **URL:** `https://pomoshnik-vospitatelya-production.up.railway.app/health`
   - **Monitoring Interval:** 5 minutes (минимум для бесплатного плана)
   - **Monitor Timeout:** 30 seconds
   - **HTTP Method:** GET
3. Нажмите **Create Monitor**

### 3. Проверка

После создания монитора:
- Статус должен стать **Up** через 1-2 минуты
- UptimeRobot будет пинговать `/health` каждые 5 минут
- Ваш бот НИКОГДА не заснет! 🎉

### 4. Опционально: Email уведомления

UptimeRobot может присылать email, если бот упадет:
- В настройках монитора включите **Alert Contacts**
- Добавьте свой email

## ✅ Результат

После настройки UptimeRobot:
- ✅ Бот работает 24/7
- ✅ Не засыпает от неактивности
- ✅ Вы получаете уведомления, если что-то сломается
- ✅ Полностью бесплатно (до 50 мониторов)

## 🔍 Проверка работы

После настройки протестируйте:
1. Подождите 10-15 минут
2. Напишите боту в Telegram
3. Бот должен ответить мгновенно! ⚡

## 📊 Альтернативы UptimeRobot

Если UptimeRobot не подходит:
- **Cron-Job.org** (https://cron-job.org)
- **Pingdom** (https://pingdom.com)
- **StatusCake** (https://statuscake.com)

Все работают аналогично - пингуют ваш `/health` endpoint.
