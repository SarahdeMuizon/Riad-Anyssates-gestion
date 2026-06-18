import { createClient, type InValue } from '@libsql/client'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// Tagged template literal wrapper — same API as @neondatabase/serverless
// so all route files work unchanged
export async function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  let query = ''
  strings.forEach((str, i) => {
    query += str
    if (i < values.length) query += '?'
  })

  const result = await client.execute({
    sql: query,
    args: values as InValue[],
  })

  // Convert Turso Row objects → plain JS objects
  return result.rows.map(row => {
    const obj: Record<string, unknown> = {}
    result.columns.forEach((col, i) => {
      obj[col] = row[i]
    })
    return obj
  })
}

export default sql

export async function initDb() {
  await client.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        poste TEXT DEFAULT 'Employé',
        token TEXT UNIQUE NOT NULL,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('cb', 'cash')),
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        supplier TEXT,
        payment TEXT,
        description TEXT,
        status TEXT DEFAULT 'pending',
        validated_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
      args: [],
    },
    {
      sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('pin', 'gestion2026')`,
      args: [],
    },
  ], 'write')
}
