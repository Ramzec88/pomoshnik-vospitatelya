import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, '../../users.db'));

// Создание таблиц при первом запуске
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS user_states (
      user_id INTEGER PRIMARY KEY,
      state TEXT,
      data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );
  `);

  console.log('База данных инициализирована');
}

// Получение или создание пользователя
export function getOrCreateUser(userId, userData = {}) {
  const stmt = db.prepare('SELECT * FROM users WHERE user_id = ?');
  let user = stmt.get(userId);

  if (!user) {
    const insert = db.prepare(`
      INSERT INTO users (user_id, username, first_name, last_name)
      VALUES (?, ?, ?, ?)
    `);
    insert.run(userId, userData.username, userData.first_name, userData.last_name);
    user = stmt.get(userId);
  }

  return user;
}

// Подсчет генераций за текущий месяц
export function getMonthlyGenerationsCount(userId) {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM generations
    WHERE user_id = ?
    AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `);

  const result = stmt.get(userId);
  return result.count;
}

// Добавление записи о генерации
export function addGeneration(userId, contentType) {
  const stmt = db.prepare(`
    INSERT INTO generations (user_id, content_type)
    VALUES (?, ?)
  `);

  stmt.run(userId, contentType);
}

// Получение оставшихся генераций
export function getRemainingGenerations(userId, monthlyLimit) {
  const used = getMonthlyGenerationsCount(userId);
  return Math.max(0, monthlyLimit - used);
}

// Сохранение состояния пользователя
export function saveUserState(userId, state, data = null) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO user_states (user_id, state, data, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);

  stmt.run(userId, state, data ? JSON.stringify(data) : null);
}

// Получение состояния пользователя
export function getUserState(userId) {
  const stmt = db.prepare('SELECT * FROM user_states WHERE user_id = ?');
  const result = stmt.get(userId);

  if (!result) return null;

  return {
    state: result.state,
    data: result.data ? JSON.parse(result.data) : null,
  };
}

// Удаление состояния пользователя
export function clearUserState(userId) {
  const stmt = db.prepare('DELETE FROM user_states WHERE user_id = ?');
  stmt.run(userId);
}

export default db;
