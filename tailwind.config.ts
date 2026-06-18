import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        terracotta: {
          DEFAULT: '#C1603A',
          dark: '#A04D2C',
          light: '#E8956D',
        },
        gold: '#B8955A',
        'bg-riad': '#FAF7F4',
        'text-riad': '#2C2417',
      },
    },
  },
  plugins: [],
}
export default config
