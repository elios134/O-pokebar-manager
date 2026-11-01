import { chromium } from 'playwright'
import { creerBase, brancher } from './faux-supabase.mjs'
const B = process.env.ADRESSE ?? 'http://localhost:5180', CAP = process.argv[2] ?? 'tests/e2e/captures'
let ok = 0, ko = 0
const verif = (nom, cond) => { if (cond) ok++; else ko++; console.log(cond ? '✔' : '✘', nom) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
async function ouvrir(db, taille) {
  const ctx = await browser.newContext({ viewport: taille, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' })
  const page = await ctx.newPage(); await brancher(page, db)
  return { ctx, page }
}
async function connecter(page, email) {
  await page.goto(B + '/connexion')
  await page.getByLabel('Email').fill(email); await page.getByLabel('Mot de passe', { exact: true }).fill('secret')
  await page.getByRole('button', { name: 'Se connecter' }).click()
}
const TEL = { width: 390, height: 844 }
const a = (jours, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + jours); d.setHours(h, m, 0, 0); return d.toISOString() }

const db = creerBase()
// Équipe Salle (EQ1) : Léa et Karim. Équipe Cuisine (EQ2) : Chloé.
db.equipes.push({ id: 'EQ2', nom: 'Cuisine', cree_le: a(0, 0) })
db.profiles.find((p) => p.id === 'K').equipe_id = 'EQ1'
db.profiles.find((p) => p.id === 'C').equipe_id = 'EQ2'
const horaire = (id, emp, j, h1, h2) => ({ id, employe_id: emp, debut: a(j, h1), fin: a(j, h2), note: null, pause_minutes: 0, pause_debut: null, pause_fin: null, cree_le: a(0, 0) })
db.shifts = [] // seulement les horaires de ce test
db.shifts.push(horaire('t1', 'K', 0, 11, 15), horaire('t2', 'L', 0, 9, 17), horaire('t3', 'C', 0, 10, 14), horaire('t4', 'K', 1, 18, 23))

{
  const { ctx, page } = await ouvrir(db, TEL)
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  await page.getByRole('button', { name: "Voir l'équipe du jour" }).click()
  const f = page.getByRole('dialog', { name: 'Équipe Salle' })
  const liste = f.getByRole('list', { name: "Équipe du jour : Aujourd'hui" })
  await liste.waitFor()
  const texte = await liste.innerText()
  verif('équipe du jour : Léa (vous) et Karim, par heure de début', /Léa Martin[\s\S]*09:00[\s\S]*Karim Benali[\s\S]*11:00/.test(texte) && texte.includes('(vous)'))
  verif('équipe du jour : Chloé (autre équipe) n’apparaît pas', !texte.includes('Chloé'))
  await page.screenshot({ path: `${CAP}/equipe-du-jour.png` })
  verif('seulement « Aujourd’hui » et « Demain »', (await f.getByRole('tab').count()) === 2 && (await f.getByRole('button', { name: /Jour (précédent|suivant)/ }).count()) === 0)
  await f.getByRole('tab', { name: 'Demain' }).click()
  verif('demain : Léa ne travaille pas, elle ne voit pas l’équipe', await f.getByText(/Vous ne travaillez pas demain/).waitFor({ timeout: 3000 }).then(() => true, () => false))
  verif('demain : Karim n’apparaît pas', (await f.getByText('Karim Benali').count()) === 0)
  await ctx.close()
}

{
  const { ctx, page } = await ouvrir(db, TEL)
  await connecter(page, 'chef@x.fr'); await page.waitForURL('**/mon-planning')
  await page.getByRole('button', { name: "Voir l'équipe du jour" }).click()
  const liste = page.getByRole('dialog', { name: 'Équipe Cuisine' }).getByRole('list')
  await liste.waitFor()
  const texte = await liste.innerText()
  verif('Chloé ne voit que son équipe', texte.includes('Chloé') && !texte.includes('Léa') && !texte.includes('Karim'))
  await ctx.close()
}

{
  const { ctx, page } = await ouvrir(db, TEL)
  await connecter(page, 'karim@x.fr'); await page.waitForURL('**/mon-planning')
  await page.getByRole('button', { name: "Voir l'équipe du jour" }).click()
  const f = page.getByRole('dialog', { name: 'Équipe Salle' })
  await f.getByRole('tab', { name: 'Demain' }).click()
  const liste = f.getByRole('list', { name: 'Équipe du jour : Demain' })
  verif('Karim voit demain (il y travaille) : lui seul, 18:00', await liste.waitFor({ timeout: 3000 }).then(() => true, () => false) && /Karim Benali[\s\S]*18:00/.test(await liste.innerText()))
  await ctx.close()
}

{
  db.profiles.find((p) => p.id === 'K').equipe_id = null
  const { ctx, page } = await ouvrir(db, TEL)
  await connecter(page, 'karim@x.fr'); await page.waitForURL('**/mon-planning')
  await page.getByRole('button', { name: "Voir l'équipe du jour" }).click()
  verif('sans équipe : message pour demander une équipe', await page.getByText("Vous n'êtes dans aucune équipe").waitFor({ timeout: 3000 }).then(() => true, () => false))
  await ctx.close()
}

await browser.close()
console.log(`\n${ok} ok, ${ko} échec(s)`)
process.exitCode = ko ? 1 : 0
