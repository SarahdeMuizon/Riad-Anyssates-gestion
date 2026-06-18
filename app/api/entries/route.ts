import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getManagerSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') // 'cb' | 'cash' | null
    const status = searchParams.get('status') // 'pending' | 'validated' | null
    const employeeName = searchParams.get('employee')
    const token = searchParams.get('token') // for employee auth

    // If employee token provided, restrict to that employee
    if (token) {
      const emp = await sql`SELECT name FROM employees WHERE token = ${token} AND active = 1`
      if (!emp[0]) {
        return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
      }
      const name = emp[0].name as string
      let entries
      if (type) {
        entries = await sql`
          SELECT * FROM entries
          WHERE employee_name = ${name} AND type = ${type}
          ORDER BY created_at DESC
        `
      } else {
        entries = await sql`
          SELECT * FROM entries
          WHERE employee_name = ${name}
          ORDER BY created_at DESC
        `
      }
      return NextResponse.json(entries)
    }

    // Manager auth required otherwise
    const isAuth = await getManagerSession()
    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    let entries
    if (type && status && employeeName) {
      entries = await sql`
        SELECT * FROM entries
        WHERE type = ${type} AND status = ${status} AND employee_name = ${employeeName}
        ORDER BY date DESC, created_at DESC
      `
    } else if (type && status) {
      entries = await sql`
        SELECT * FROM entries
        WHERE type = ${type} AND status = ${status}
        ORDER BY date DESC, created_at DESC
      `
    } else if (type && employeeName) {
      entries = await sql`
        SELECT * FROM entries
        WHERE type = ${type} AND employee_name = ${employeeName}
        ORDER BY date DESC, created_at DESC
      `
    } else if (type) {
      entries = await sql`
        SELECT * FROM entries
        WHERE type = ${type}
        ORDER BY date DESC, created_at DESC
      `
    } else if (status) {
      entries = await sql`
        SELECT * FROM entries
        WHERE status = ${status}
        ORDER BY date DESC, created_at DESC
      `
    } else {
      entries = await sql`
        SELECT * FROM entries
        ORDER BY date DESC, created_at DESC
      `
    }

    return NextResponse.json(entries)
  } catch (error) {
    console.error('GET entries error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, date, amount, category, supplier, payment, description, token, employee_name } = body

    let empName: string

    if (token) {
      // Employee submitting
      const emp = await sql`SELECT name FROM employees WHERE token = ${token} AND active = 1`
      if (!emp[0]) {
        return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
      }
      empName = emp[0].name as string
    } else {
      // Manager submitting
      const isAuth = await getManagerSession()
      if (!isAuth) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      }
      empName = employee_name
    }

    if (!type || !date || !amount || !category || !empName) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO entries (employee_name, type, date, amount, category, supplier, payment, description)
      VALUES (${empName}, ${type}, ${date}, ${amount}, ${category}, ${supplier || null}, ${payment || null}, ${description || null})
      RETURNING *
    `

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('POST entry error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
