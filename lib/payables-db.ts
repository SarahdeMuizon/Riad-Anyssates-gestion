import sql from '@/lib/db'

// Rattache à une facture de fin de mois les bons qu'elle reprend (et détache les autres)
export async function linkBons(invoiceId: number, bonIds: unknown[]) {
  await sql`UPDATE payables SET invoice_id = NULL WHERE invoice_id = ${invoiceId}`
  for (const raw of bonIds) {
    const bonId = Number(raw)
    if (Number.isInteger(bonId)) await sql`UPDATE payables SET invoice_id = ${invoiceId} WHERE id = ${bonId} AND kind = 'bon'`
  }
}

// Recalcule l'état d'une facture d'après ses règlements : réglée quand le total payé atteint le montant
export async function refreshPayableStatus(payableId: number) {
  const inv = await sql`SELECT amount FROM payables WHERE id = ${payableId}`
  if (!inv[0]) return
  const pays = await sql`SELECT date, amount, payment, entry_id FROM payable_payments WHERE payable_id = ${payableId} ORDER BY date, id`
  const paid = pays.reduce((s, p) => s + Number(p.amount), 0)
  const last = pays[pays.length - 1]
  if (last && paid >= Number(inv[0].amount) - 0.01) {
    await sql`UPDATE payables SET status = 'paid', paid_date = ${last.date}, payment = ${last.payment}, entry_id = ${last.entry_id} WHERE id = ${payableId}`
  } else {
    await sql`UPDATE payables SET status = 'todo', paid_date = NULL, payment = NULL, entry_id = NULL WHERE id = ${payableId}`
  }
}

// Supprime un règlement et la dépense qu'il avait créée
export async function removePayment(paymentId: number) {
  const rows = await sql`SELECT payable_id, entry_id FROM payable_payments WHERE id = ${paymentId}`
  if (!rows[0]) return
  if (rows[0].entry_id) await sql`DELETE FROM entries WHERE id = ${rows[0].entry_id}`
  await sql`DELETE FROM payable_payments WHERE id = ${paymentId}`
  await refreshPayableStatus(rows[0].payable_id as number)
}
