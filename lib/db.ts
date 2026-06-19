// Direct Turso HTTP API via native fetch — no @libsql/client needed.
// Avoids the "@libsql/client migration jobs 400" issue in Vercel serverless.

type HranaValue =
  | { type: 'null' }
  | { type: 'integer'; value: string }
  | { type: 'float'; value: number }
  | { type: 'text'; value: string }
  | { type: 'blob'; base64: string }

function toHranaValue(v: unknown): HranaValue {
  if (v === null || v === undefined) return { type: 'null' }
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' }
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { type: 'integer', value: String(v) }
    return { type: 'float', value: v }
  }
  if (typeof v === 'string') return { type: 'text', value: v }
  return { type: 'text', value: String(v) }
}

function fromHranaValue(v: HranaValue): unknown {
  if (v.type === 'null') return null
  if (v.type === 'integer') return parseInt(v.value, 10)
  if (v.type === 'float') return v.value
  if (v.type === 'text') return v.value
  return v.base64 // blob
}

async function tursoRequest(statements: Array<{ sql: string; args?: unknown[] }>) {
  const rawUrl = process.env.TURSO_DATABASE_URL!
  const url = rawUrl.replace(/^libsql:\/\//, 'https://')
  const token = process.env.TURSO_AUTH_TOKEN!

  const requests = statements.map(stmt => ({
    type: 'execute' as const,
    stmt: {
      sql: stmt.sql,
      args: (stmt.args ?? []).map(toHranaValue),
    },
  }))

  const res = await fetch(`${url}/v2/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Turso HTTP ${res.status}: ${body}`)
  }

  const data = await res.json() as {
    results: Array<{
      type: 'ok' | 'error'
      response?: { type: string; result: { cols: { name: string }[]; rows: HranaValue[][] } }
      error?: { message: string }
    }>
  }
  return data.results
}

// Tagged template literal helper — same API as before, all routes unchanged
export async function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  let query = ''
  strings.forEach((str, i) => {
    query += str
    if (i < values.length) query += '?'
  })

  const results = await tursoRequest([{ sql: query, args: values }])
  const result = results[0]

  if (result.type === 'error') {
    throw new Error(result.error?.message ?? 'Query error')
  }

  const { cols, rows } = result.response!.result
  return rows.map(row => {
    const obj: Record<string, unknown> = {}
    cols.forEach((col, i) => {
      obj[col.name] = fromHranaValue(row[i])
    })
    return obj
  })
}

export default sql

export async function initDb() {
  // Create core tables (idempotent)
  const results = await tursoRequest([
    {
      sql: `CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        poste TEXT DEFAULT 'Employé',
        token TEXT UNIQUE NOT NULL,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
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
        currency TEXT DEFAULT 'EUR',
        invoice_url TEXT,
        status TEXT DEFAULT 'pending',
        validated_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS fonds_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_name TEXT NOT NULL,
        direction TEXT NOT NULL,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'MAD',
        category TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        validated_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    },
    {
      sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('pin', 'gestion2026')`,
    },
  ])

  for (const r of results) {
    if (r.type === 'error') {
      throw new Error(r.error?.message ?? 'Init error')
    }
  }

  // Migrations: add new columns to existing entries table
  // Errors are ignored when the column already exists
  for (const migSql of [
    `ALTER TABLE entries ADD COLUMN currency TEXT DEFAULT 'EUR'`,
    `ALTER TABLE entries ADD COLUMN invoice_url TEXT`,
  ]) {
    const mResults = await tursoRequest([{ sql: migSql }])
    const r = mResults[0]
    if (r.type === 'error') {
      const msg = r.error?.message ?? ''
      // Ignore "duplicate column name" (column already exists)
      if (!msg.toLowerCase().includes('duplicate column')) {
        throw new Error(msg)
      }
    }
  }
}
