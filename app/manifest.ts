import type { MetadataRoute } from 'next'

// Permet d'ajouter l'appli à l'écran d'accueil (nécessaire pour les notifications sur iPhone)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Riad Anyssates – Gestion',
    short_name: 'Anyssates',
    display: 'standalone',
    background_color: '#FAF7F4',
    theme_color: '#C1603A',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }
}
