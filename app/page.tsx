'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (res.ok) {
        router.push('/manager')
      } else {
        setError('PIN incorrect. Réessayez.')
      }
    } catch {
      setError('Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏨</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--terracotta)' }}>
            Riad Anyssates
          </h1>
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.25rem' }}>Espace Manager</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <input
              className="form-input"
              type="password"
              placeholder="Code PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              autoFocus
            />
          </div>

          {error && (
            <p style={{ color: 'var(--red)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              {error}
            </p>
          )}

          <button
            className="btn-primary"
            type="submit"
            disabled={loading || !pin}
            style={{ width: '100%' }}
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '1.25rem' }}>
          Employé ? Utilisez votre lien personnel.
        </p>
      </div>
    </div>
  )
}
