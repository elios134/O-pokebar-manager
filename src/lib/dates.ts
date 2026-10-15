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

/** Place une heure (ex. "01:30") dans le service : si elle est avant le début, c'est le lendemain. */
export function heureDansService(jour: string, heure: string, debutService: Date) {
  const d = new Date(`${jour}T${heure}`)
  if (d < debutService) d.setDate(d.getDate() + 1)
  return d
}

/** Durée travaillée en heures (pause déduite) */
export function dureeHeures(debut: Date, fin: Date, pauseMinutes = 0) {
  return (fin.getTime() - debut.getTime()) / 3_600_000 - pauseMinutes / 60
}

/** "pause 13:00 – 13:30" pour un horaire, ou "" s'il n'a pas de pause */
export function textePause(h: { pause_debut: string | null; pause_fin: string | null }) {
  if (!h.pause_debut || !h.pause_fin) return ''
  return `pause ${heureLocale(new Date(h.pause_debut))} – ${heureLocale(new Date(h.pause_fin))}`
}

export function formatHeures(h: number) {
  const entier = Math.floor(h)
  const minutes = Math.round((h - entier) * 60)
  if (!entier) return `${minutes} min`
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

/** Date "2026-11-02" → Date locale à minuit */
export const dateDuJour = (jour: string) => new Date(`${jour}T00:00`)

/** Nombre de jours d'un congé, bornes comprises */
export function nbJours(debut: string, fin: string) {
  return Math.round((dateDuJour(fin).getTime() - dateDuJour(debut).getTime()) / 86_400_000) + 1
}

const fmtCourt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtCourtAnnee = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/** "lun. 2 nov. → ven. 6 nov. 2026" */
export function formatPeriode(debut: string, fin: string) {
  if (debut === fin) return fmtCourtAnnee.format(dateDuJour(debut))
  return `${fmtCourt.format(dateDuJour(debut))} → ${fmtCourtAnnee.format(dateDuJour(fin))}`
}

/** Jour suivant au format "2026-11-03" (utile pour les événements « journée entière ») */
export function jourSuivant(jour: string) {
  const d = dateDuJour(jour)
  d.setDate(d.getDate() + 1)
  return jourLocal(d)
}

/** Lien vers la page d'export PDF (semaine par défaut ; l'admin peut filtrer par équipe / employé). */
export function lienImpression(
  jour: Date,
  options: { periode?: 'semaine' | 'mois'; equipe?: string; employe?: string } = {},
) {
  const p = new URLSearchParams({ date: jourLocal(jour), periode: options.periode ?? 'semaine' })
  if (options.equipe) p.set('equipe', options.equipe)
  if (options.employe) p.set('employe', options.employe)
  return `/impression?${p.toString()}`
}
