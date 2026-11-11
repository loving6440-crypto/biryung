import pg from 'pg';
import { hashPassword, verifyPassword, normalizeUsername, validateUsername, COLORS } from './auth.mjs';
const { Pool } = pg;
export let pool = null;
export async function initDatabase() {
  if (!process.env.DATABASE_URL) return false;
  pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_SIZE || 10), connectionTimeoutMillis: 8000, idleTimeoutMillis: 30000 });
  await pool.query('SELECT 1');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS biryeong_users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(24) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name VARCHAR(40) NOT NULL,
      bio VARCHAR(300) NOT NULL DEFAULT '',
      avatar_symbol VARCHAR(16) NOT NULL DEFAULT '✦',
      accent VARCHAR(7) NOT NULL DEFAULT '#d4b078',
      role VARCHAR(12) NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS biryeong_sessions (
      token_hash VARCHAR(64) PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES biryeong_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS biryeong_sessions_expiry_idx ON biryeong_sessions(expires_at);
    CREATE TABLE IF NOT EXISTS biryeong_posts (
      id BIGSERIAL PRIMARY KEY,
      author_id BIGINT NOT NULL REFERENCES biryeong_users(id),
      body VARCHAR(500) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS biryeong_posts_author_id_idx ON biryeong_posts(author_id,id DESC);
    CREATE TABLE IF NOT EXISTS biryeong_post_replies (
      id BIGSERIAL PRIMARY KEY,
      post_id BIGINT NOT NULL REFERENCES biryeong_posts(id) ON DELETE CASCADE,
      author_id BIGINT NOT NULL REFERENCES biryeong_users(id),
      body VARCHAR(500) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS biryeong_post_replies_post_idx ON biryeong_post_replies(post_id,id ASC);
    CREATE TABLE IF NOT EXISTS biryeong_memos (
      id BIGSERIAL PRIMARY KEY,
      author_id BIGINT NOT NULL REFERENCES biryeong_users(id),
      title VARCHAR(100) NOT NULL,
      body VARCHAR(3000) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS biryeong_memo_comments (
      id BIGSERIAL PRIMARY KEY,
      memo_id BIGINT NOT NULL REFERENCES biryeong_memos(id) ON DELETE CASCADE,
      parent_id BIGINT REFERENCES biryeong_memo_comments(id) ON DELETE CASCADE,
      author_id BIGINT NOT NULL REFERENCES biryeong_users(id),
      body VARCHAR(1200) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS biryeong_comments_memo_idx ON biryeong_memo_comments(memo_id,id ASC);
    CREATE TABLE IF NOT EXISTS biryeong_dm_threads (
      id BIGSERIAL PRIMARY KEY,
      user_low_id BIGINT NOT NULL REFERENCES biryeong_users(id),
      user_high_id BIGINT NOT NULL REFERENCES biryeong_users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT biryeong_dm_order CHECK(user_low_id < user_high_id),
      CONSTRAINT biryeong_dm_pair UNIQUE(user_low_id,user_high_id)
    );
    CREATE INDEX IF NOT EXISTS biryeong_dm_low_idx ON biryeong_dm_threads(user_low_id,updated_at DESC);
    CREATE INDEX IF NOT EXISTS biryeong_dm_high_idx ON biryeong_dm_threads(user_high_id,updated_at DESC);
    CREATE TABLE IF NOT EXISTS biryeong_dm_messages (
      id BIGSERIAL PRIMARY KEY,
      thread_id BIGINT NOT NULL REFERENCES biryeong_dm_threads(id) ON DELETE CASCADE,
      sender_id BIGINT NOT NULL REFERENCES biryeong_users(id),
      body VARCHAR(2000) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS biryeong_dm_messages_thread_idx ON biryeong_dm_messages(thread_id,id DESC);
    CREATE TABLE IF NOT EXISTS biryeong_admin_dm_audit (
      id BIGSERIAL PRIMARY KEY,
      admin_id BIGINT NOT NULL REFERENCES biryeong_users(id),
      thread_id BIGINT NOT NULL REFERENCES biryeong_dm_threads(id),
      accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const adminName = normalizeUsername(process.env.BIRYEONG_ADMIN_USERNAME);
  const adminPassword = process.env.BIRYEONG_ADMIN_PASSWORD;
  if (adminName || adminPassword) {
    if (!validateUsername(adminName) || typeof adminPassword !== 'string' || adminPassword.length < 12) throw new Error('운영자 계정은 BIRYEONG_ADMIN_USERNAME(영문/숫자/밑줄, 3~24자) 및 12자 이상 BIRYEONG_ADMIN_PASSWORD를 모두 설정해야 합니다.');
    const existing = await pool.query('SELECT id,role,password_hash FROM biryeong_users WHERE username=$1', [adminName]);
    if (existing.rows.length && existing.rows[0].role !== 'admin') throw new Error('운영자 계정명과 이미 가입된 일반 계정명이 충돌합니다. 다른 BIRYEONG_ADMIN_USERNAME을 설정하세요.');
    if (!existing.rows.length) {
      await pool.query('INSERT INTO biryeong_users(username,password_hash,display_name,role,accent) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [adminName, await hashPassword(adminPassword), '비령 운영자', 'admin', COLORS[0]]);
    } else if (!(await verifyPassword(adminPassword, existing.rows[0].password_hash))) {
      await pool.query('UPDATE biryeong_users SET password_hash=$1,updated_at=NOW() WHERE id=$2 AND role=$3', [await hashPassword(adminPassword), existing.rows[0].id, 'admin']);
      await pool.query('DELETE FROM biryeong_sessions WHERE user_id=$1',[existing.rows[0].id]);
    }
  }
  await pool.query('DELETE FROM biryeong_sessions WHERE expires_at < NOW()');
  return true;
}
export async function query(sql, params = []) {
  if (!pool) throw Object.assign(new Error('database_not_configured'), { status: 503 });
  return pool.query(sql, params);
}
