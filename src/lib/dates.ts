const deux = (n: number) => String(n).padStart(2, '0')

/** "2026-10-14" en heure locale */
export function jourLocal(d: Date) {
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
}

/** "09:30" en heure locale */
export function heureLocale(d: Date) {
  return `${deux(d.getHours())}:${deux(d.getMinutes())}`
}

/** Construit début / fin à partir du formulaire. Si la fin est avant le début, elle est le lendemain. */
export function construirePlage(jour: string, debut: string, fin: string) {
  const d = new Date(`${jour}T${debut}`)
  const f = new Date(`${jour}T${fin}`)
  if (f <= d) f.setDate(f.getDate() + 1)
  return { debut: d, fin: f }
}

export function dureeHeures(debut: Date, fin: Date) {
  return (fin.getTime() - debut.getTime()) / 3_600_000
}

export function formatHeures(h: number) {
  const entier = Math.floor(h)
  const minutes = Math.round((h - entier) * 60)
  return minutes ? `${entier} h ${deux(minutes)}` : `${entier} h`
}

/** Lundi 00:00 de la semaine de `d` */
export function debutSemaine(d: Date) {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7))
  return r
}

export const formatJour = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
