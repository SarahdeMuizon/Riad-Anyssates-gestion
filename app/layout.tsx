import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Riad Anyssates – Gestion',
  description: 'Application de gestion des dépenses et encaissements',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
