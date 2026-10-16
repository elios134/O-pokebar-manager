import { chromium } from 'playwright'
import { creerBase, brancher } from './faux-supabase.mjs'
const B = process.env.ADRESSE ?? 'http://localhost:5180', CAP = process.argv[2] ?? 'tests/e2e/captures'
let ok = 0, ko = 0
const verif = (nom, cond) => { cond ? ok++ : ko++; console.log(cond ? '✔' : '✘', nom) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const db = creerBase()
db.conges.push({ id: 'c9', employe_id: 'K', debut: db.shifts[0].debut.slice(0, 10), fin: db.shifts[0].debut.slice(0, 10), motif: null, statut: 'accepte', reponse: null, cree_le: '', traite_le: '' })
async function ouvrir(taille) {
  const ctx = await browser.newContext({ viewport: taille, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' })
  const page = await ctx.newPage(); await brancher(page, db)
  await page.addInitScript(() => { window.__imprime = 0; window.print = () => { window.__imprime++ } })
  return { ctx, page }
}
async function connecter(page, email) {
  await page.goto(B + '/connexion')
  await page.getByLabel('Email').fill(email); await page.getByLabel('Mot de passe', { exact: true }).fill('secret')
  await page.getByRole('button', { name: 'Se connecter' }).click()
}
{
  const { ctx, page } = await ouvrir({ width: 1280, height: 900 })
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')
  await page.getByRole('button', { name: /^Léa Martin, lundi/ }).waitFor()
  await page.getByRole('button', { name: 'Exporter en PDF' }).click(); await page.waitForURL('**/impression?*')
  await page.locator('tbody tr').first().waitFor()
  const texte = await page.locator('table').innerText()
  verif('tableau : Léa 09:00–17:00 avec pause', texte.includes('09:00–17:00') && texte.includes('pause 12:00–13:00'))
  verif('tableau : service de nuit 18:00–02:00', texte.includes('18:00–02:00'))
  verif('tableau : congé de Karim affiché', (await page.locator('tbody tr', { hasText: 'Karim' }).innerText()).includes('Congé'))
  verif('total Léa : 15 h (pause déduite)', (await page.locator('tbody tr', { hasText: 'Léa' }).innerText()).includes('15 h'))
  await page.getByRole('button', { name: 'Enregistrer en PDF / Imprimer' }).click()
  verif('bouton ouvre l’impression', (await page.evaluate(() => window.__imprime)) === 1)
  await page.screenshot({ path: `${CAP}/web-impression.png`, fullPage: true })
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: `${CAP}/planning.pdf`, format: 'A4', landscape: true, printBackground: true })
  verif('PDF généré', true)
  await page.emulateMedia({ media: 'screen' })
  // Mois entier
  await page.getByRole('button', { name: 'Mois', exact: true }).click()
  await page.getByRole('heading', { name: /Planning d.octobre 2026/i }).waitFor()
  verif('mois : titre « Planning d’octobre 2026 »', true)
  verif('mois : un tableau par semaine (5 semaines en octobre 2026)', (await page.locator('main section, div section').filter({ has: page.locator('table') }).count()) >= 5)
  verif('mois : total du mois affiché', (await page.getByRole('heading', { name: 'Total du mois' }).count()) === 1)
  await page.screenshot({ path: `${CAP}/web-impression-mois.png`, fullPage: true })
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: `${CAP}/planning-mois.pdf`, format: 'A4', landscape: true, printBackground: true })
  await page.emulateMedia({ media: 'screen' })
  // Filtre équipe puis employé (admin)
  await page.getByLabel('Équipe', { exact: true }).selectOption({ label: 'Salle' })
  await page.waitForTimeout(300)
  const lignesSalle = await page.locator('section').first().locator('tbody tr').allInnerTexts()
  verif('équipe Salle : seulement Léa', lignesSalle.length === 1 && lignesSalle[0].includes('Léa'))
  verif('sous-titre indique l’équipe', (await page.locator('h1 + p').innerText()).includes('Équipe Salle'))
  await page.getByLabel('Équipe', { exact: true }).selectOption({ label: 'Toutes les équipes' })
  await page.getByLabel('Employé', { exact: true }).selectOption({ label: 'Karim Benali' })
  await page.waitForTimeout(300)
  const lignesKarim = await page.locator('section').first().locator('tbody tr').allInnerTexts()
  verif('employé Karim : une seule ligne', lignesKarim.length === 1 && lignesKarim[0].includes('Karim'))
  await page.getByRole('button', { name: 'Semaine', exact: true }).click()
  await page.getByRole('button', { name: 'Semaine suivante' }).click()
  await page.getByText('Aucun horaire', { exact: false }).first().waitFor({ timeout: 3000 }).catch(() => {})
  verif('semaine suivante : change la période', page.url() !== '' && !(await page.locator('table').innerText()).includes('09:00–17:00'))
  await ctx.close()
}
{
  const { ctx, page } = await ouvrir({ width: 390, height: 844 })
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  await page.getByRole('button', { name: 'Exporter en PDF' }).click(); await page.waitForURL('**/impression?*')
  await page.locator('tbody tr').first().waitFor()
  await page.locator('tbody tr', { hasText: 'Léa' }).waitFor()
  verif('employé : seulement sa ligne', (await page.locator('tbody tr').count()) === 1 && (await page.locator('tbody tr').innerText()).includes('Léa'))
  await page.screenshot({ path: `${CAP}/mob-impression.png`, fullPage: true })
  await ctx.close()
}
console.log(`\n${ok} ok, ${ko} échec(s)`)
await browser.close()
process.exitCode = ko ? 1 : 0
