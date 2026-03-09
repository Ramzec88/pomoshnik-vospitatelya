import pg from 'pg';
const { Pool } = pg;

// Создание пула подключений к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Обработка ошибок пула
pool.on('error', (err) => {
  console.error('Неожиданная ошибка PostgreSQL:', err);
});

// Создание таблиц при первом запуске
export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS generations (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        content_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      );

      ALTER TABLE generations ADD COLUMN IF NOT EXISTS user_text TEXT;

      CREATE TABLE IF NOT EXISTS user_states (
        user_id BIGINT PRIMARY KEY,
        state TEXT,
        data TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_generations_user_date
        ON generations(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_user_states_user
        ON user_states(user_id);
    `);

    console.log('✅ База данных PostgreSQL инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Получение или создание пользователя
export async function getOrCreateUser(userId, userData = {}) {
  const client = await pool.connect();
  try {
    // Попытка получить пользователя
    let result = await client.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Создаем нового пользователя
      await client.query(
        `INSERT INTO users (user_id, username, first_name, last_name)
         VALUES ($1, $2, $3, $4)`,
        [userId, userData.username, userData.first_name, userData.last_name]
      );

      result = await client.query(
        'SELECT * FROM users WHERE user_id = $1',
        [userId]
      );
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

// Подсчет генераций за текущий месяц
export async function getMonthlyGenerationsCount(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT COUNT(*) as count
       FROM generations
       WHERE user_id = $1
       AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_TIMESTAMP)`,
      [userId]
    );

    return parseInt(result.rows[0].count);
  } finally {
    client.release();
  }
}

// Добавление записи о генерации
export async function addGeneration(userId, contentType, userText = null) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO generations (user_id, content_type, user_text)
       VALUES ($1, $2, $3)`,
      [userId, contentType, userText]
    );
  } finally {
    client.release();
  }
}

// Статистика для администратора
export async function getAnalytics() {
  const client = await pool.connect();
  try {
    const [users, total, monthly, byType] = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM users'),
      client.query('SELECT COUNT(*) as count FROM generations'),
      client.query(
        `SELECT COUNT(*) as count FROM generations
         WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_TIMESTAMP)`
      ),
      client.query(
        `SELECT content_type, COUNT(*) as count
         FROM generations
         GROUP BY content_type
         ORDER BY count DESC`
      ),
    ]);

    return {
      totalUsers: parseInt(users.rows[0].count),
      totalGenerations: parseInt(total.rows[0].count),
      monthlyGenerations: parseInt(monthly.rows[0].count),
      byType: byType.rows,
    };
  } finally {
    client.release();
  }
}

// Статистика использования лимитов (без админов) за текущий месяц
export async function getMonthlyUsageStats(adminIds, monthlyLimit) {
  const client = await pool.connect();
  try {
    // Считаем количество обычных пользователей (не админов)
    const usersResult = await client.query(
      `SELECT COUNT(*) as count FROM users WHERE user_id NOT IN (${adminIds.map((_, i) => `$${i + 1}`).join(',')})`,
      adminIds
    );
    const regularUsersCount = parseInt(usersResult.rows[0].count);

    // Считаем использованные запросы за текущий месяц (без админов)
    const usedResult = await client.query(
      `SELECT COUNT(*) as count FROM generations
       WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_TIMESTAMP)
       AND user_id NOT IN (${adminIds.map((_, i) => `$${i + 1}`).join(',')})`,
      adminIds
    );
    const usedRequests = parseInt(usedResult.rows[0].count);

    // Максимально возможное количество запросов
    const maxRequests = regularUsersCount * monthlyLimit;

    // Процент использования
    const usagePercent = maxRequests > 0 ? Math.round((usedRequests / maxRequests) * 100) : 0;

    return {
      regularUsersCount,
      usedRequests,
      maxRequests,
      remainingRequests: Math.max(0, maxRequests - usedRequests),
      usagePercent,
    };
  } finally {
    client.release();
  }
}

// Получение детальной статистики конкретного пользователя
export async function getUserStats(userId, monthlyLimit) {
  const client = await pool.connect();
  try {
    // Информация о пользователе
    const userResult = await client.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return null; // Пользователь не найден
    }

    const user = userResult.rows[0];

    // Всего генераций за все время
    const totalResult = await client.query(
      'SELECT COUNT(*) as count FROM generations WHERE user_id = $1',
      [userId]
    );

    // Генераций за текущий месяц
    const monthlyResult = await client.query(
      `SELECT COUNT(*) as count FROM generations
       WHERE user_id = $1
       AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_TIMESTAMP)`,
      [userId]
    );

    // Последние 10 запросов
    const recentResult = await client.query(
      `SELECT content_type, user_text, created_at
       FROM generations
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    const totalGenerations = parseInt(totalResult.rows[0].count);
    const monthlyGenerations = parseInt(monthlyResult.rows[0].count);
    const remaining = Math.max(0, monthlyLimit - monthlyGenerations);

    return {
      user,
      totalGenerations,
      monthlyGenerations,
      remaining,
      recentRequests: recentResult.rows,
    };
  } finally {
    client.release();
  }
}

// Последние запросы пользователей (с текстом), с поддержкой пагинации
export async function getRecentRequests(limit = 20, offset = 0) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT g.id, g.user_id, u.username, u.first_name, u.last_name,
              g.content_type, g.user_text, g.created_at
       FROM generations g
       JOIN users u ON g.user_id = u.user_id
       ORDER BY g.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// Получение оставшихся генераций
export async function getRemainingGenerations(userId, monthlyLimit) {
  const used = await getMonthlyGenerationsCount(userId);
  return Math.max(0, monthlyLimit - used);
}

// Сохранение состояния пользователя
export async function saveUserState(userId, state, data = null) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO user_states (user_id, state, data, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET state = $2, data = $3, updated_at = CURRENT_TIMESTAMP`,
      [userId, state, data ? JSON.stringify(data) : null]
    );
  } finally {
    client.release();
  }
}

// Получение состояния пользователя
export async function getUserState(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM user_states WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      state: row.state,
      data: row.data ? JSON.parse(row.data) : null,
    };
  } finally {
    client.release();
  }
}

// Удаление состояния пользователя
export async function clearUserState(userId) {
  const client = await pool.connect();
  try {
    await client.query(
      'DELETE FROM user_states WHERE user_id = $1',
      [userId]
    );
  } finally {
    client.release();
  }
}

// Закрытие пула соединений (для graceful shutdown)
export async function closeDatabase() {
  await pool.end();
  console.log('✅ Соединение с PostgreSQL закрыто');
}

export default pool;
