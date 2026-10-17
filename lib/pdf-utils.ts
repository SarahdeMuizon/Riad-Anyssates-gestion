// Outils communs aux PDF générés dans le navigateur (pdf-lib).

// Les polices standard des PDF ne gèrent que l'alphabet latin (WinAnsi) :
// on remplace les caractères qu'elles ne savent pas dessiner.
export function clean(s: unknown): string {
  return String(s ?? '')
    .replace(/[   ]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/↔/g, '<->').replace(/→/g, '->')
    .replace(/[−–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/×/g, 'x')
    .replace(/[^\x20-\x7E\xA0-\xFF€]/g, '')
}

export const fmtAmount = (n: number) => clean(n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
export const fmtDate = (d: string) => d.split('-').reverse().join('/')
