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
      <head>
        {/* Prevent Safari from navigating to dropped files */}
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('dragover', function(e){ e.preventDefault(); }, true);
          document.addEventListener('drop', function(e){ e.preventDefault(); }, true);
        `}} />
      </head>
      <body>{children}</body>
    </html>
  )
}
