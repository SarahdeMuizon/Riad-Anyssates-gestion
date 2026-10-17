// Contrôle mensuel du relevé Attijari : lecture du relevé (PDF ou photo) par Claude,
// puis rapprochement avec les mouvements bancaires saisis dans l'application.
import Anthropic from '@anthropic-ai/sdk'

export interface StatementLine { date: string; label: string; debit: number; credit: number }
export interface StatementExtract { opening_balance: number; closing_balance: number; lines: StatementLine[] }

export interface AppMovement {
  id: number; date: string; type: 'cb' | 'cash'; amount: number
  payment: string | null; label: string
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['opening_balance', 'closing_balance', 'lines'],
  properties: {
    opening_balance: { type: 'number', description: 'Solde de début de période (0 si absent)' },
    closing_balance: { type: 'number', description: 'Solde de fin de période (0 si absent)' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'label', 'debit', 'credit'],
        properties: {
          date: { type: 'string', description: "Date d'opération au format AAAA-MM-JJ" },
          label: { type: 'string', description: "Libellé de l'opération, tel qu'écrit sur le relevé" },
          debit: { type: 'number', description: 'Montant au débit en MAD (0 si aucun)' },
          credit: { type: 'number', description: 'Montant au crédit en MAD (0 si aucun)' },
        },
      },
    },
  },
}

// Lecture du relevé : toutes les opérations, sans les lignes de report ni de solde
export async function extractStatement(dataUrl: string, period: string): Promise<StatementExtract> {
  const comma = dataUrl.indexOf(',')
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'))
  const data = dataUrl.slice(comma + 1)
  const file = mime === 'application/pdf'
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mime as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data } }

  const client = new Anthropic()
  const stream = client.beta.messages.stream({
    model: 'claude-opus-5-5',
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        file,
        {
          type: 'text',
          text: `Voici le relevé de compte Attijariwafa bank du riad pour ${period} (AAAA-MM). ` +
            `Liste toutes les opérations, dans l'ordre du relevé, avec leur date d'opération, leur libellé ` +
            `et leur montant au débit ou au crédit en dirhams. N'inclus pas les lignes de solde, de report ` +
            `ou de total. Indique aussi le solde de début et de fin de période.`,
        },
      ],
    }],
  })
  const msg = await stream.finalMessage()
  if (msg.stop_reason === 'refusal') throw new Error('Lecture du relevé refusée')
  if (msg.stop_reason === 'max_tokens') throw new Error('Relevé trop long pour être lu en une fois')
  const text = msg.content.find(b => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('Réponse vide')
  const parsed = JSON.parse(text.text) as StatementExtract
  parsed.lines = parsed.lines.filter(l => (l.debit || 0) > 0 || (l.credit || 0) > 0)
  return parsed
}

// ── Rapprochement ──────────────────────────────────────────────────────────────

// Remises de cartes bancaires : le CMI et American Express versent les paiements par lots,
// on les compare donc au total des encaissements carte, pas ligne à ligne.
const CARD_REMITTANCE = /\b(CMI|AMEX|AMERICAN\s*EXPRESS|REMISE\s*(CB|CARTE|TPE)|TPE)\b/i

const r2 = (n: number) => Math.round(n * 100) / 100
const days = (a: string, b: string) => Math.abs(Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86_400_000

export interface CheckReport {
  matched: number
  missingInApp: StatementLine[]                                  // sur le relevé, pas dans l'application
  missingOnStatement: AppMovement[]                              // dans l'application, pas sur le relevé
  amountMismatch: { line: StatementLine; movement: AppMovement }[] // même opération, montant différent
  totals: { statementDebit: number; appDebit: number; statementCredit: number; appCredit: number }
  cards: { statement: number; app: number; lines: StatementLine[] }
  balances: { opening: number; closing: number }
  bigDifference: boolean
}

export function reconcile(ext: StatementExtract, movements: AppMovement[], period: string): CheckReport {
  const inMonth = (d: string) => d.slice(0, 7) === period
  const isCardCredit = (l: StatementLine) => l.credit > 0 && CARD_REMITTANCE.test(l.label)
  const cardLines = ext.lines.filter(isCardCredit)
  const lines = ext.lines.filter(l => !isCardCredit(l))
  const cardMovements = movements.filter(m => m.type === 'cash' && m.payment === 'CB')
  const pool = movements.filter(m => !(m.type === 'cash' && m.payment === 'CB'))

  const used = new Set<number>()
  const sideOf = (l: StatementLine) => (l.debit > 0 ? 'cb' : 'cash')
  const amountOf = (l: StatementLine) => (l.debit > 0 ? l.debit : l.credit)
  const nearest = (l: StatementLine, ok: (m: AppMovement) => boolean) => pool
    .filter(m => !used.has(m.id) && m.type === sideOf(l) && ok(m))
    .sort((a, b) => days(a.date, l.date) - days(b.date, l.date))[0]

  // 1) même montant, à 7 jours près (délai de passage en banque)
  const unmatched: StatementLine[] = []
  let matched = 0
  for (const l of [...lines].sort((a, b) => a.date.localeCompare(b.date))) {
    const m = nearest(l, m => Math.abs(m.amount - amountOf(l)) < 0.01 && days(m.date, l.date) <= 7)
    if (m) { used.add(m.id); matched++ } else unmatched.push(l)
  }
  // 2) montant proche (écart de saisie), à 5 jours près
  const missingInApp: StatementLine[] = []
  const amountMismatch: CheckReport['amountMismatch'] = []
  for (const l of unmatched) {
    const a = amountOf(l)
    const m = nearest(l, m => Math.abs(m.amount - a) <= Math.max(100, a * 0.2) && days(m.date, l.date) <= 5)
    if (m) { used.add(m.id); amountMismatch.push({ line: l, movement: m }) } else missingInApp.push(l)
  }

  const monthPool = pool.filter(m => inMonth(m.date))
  const missingOnStatement = monthPool.filter(m => !used.has(m.id))
  const totals = {
    statementDebit: r2(lines.reduce((s, l) => s + l.debit, 0)),
    appDebit: r2(monthPool.filter(m => m.type === 'cb').reduce((s, m) => s + m.amount, 0)),
    statementCredit: r2(lines.reduce((s, l) => s + l.credit, 0)),
    appCredit: r2(monthPool.filter(m => m.type === 'cash').reduce((s, m) => s + m.amount, 0)),
  }
  const cards = {
    statement: r2(cardLines.reduce((s, l) => s + l.credit, 0)),
    app: r2(cardMovements.filter(m => inMonth(m.date)).reduce((s, m) => s + m.amount, 0)),
    lines: cardLines,
  }
  const big = (a: number, b: number) => Math.abs(a - b) > Math.max(500, Math.abs(a) * 0.05)
  return {
    matched, missingInApp, missingOnStatement, amountMismatch, totals, cards,
    balances: { opening: ext.opening_balance, closing: ext.closing_balance },
    bigDifference: big(totals.statementDebit, totals.appDebit) || big(totals.statementCredit, totals.appCredit) || big(cards.statement, cards.app),
  }
}
