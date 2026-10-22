import { chromium } from 'playwright'
import { creerBase, brancher } from './faux-supabase.mjs'
const B = process.env.ADRESSE ?? 'http://localhost:5180', CAP = process.argv[2] ?? 'tests/e2e/captures'
let ok = 0, ko = 0
const verif = (nom, cond) => { cond ? ok++ : ko++; console.log(cond ? '✔' : '✘', nom) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const jl = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const lundi = new Date(); lundi.setHours(0, 0, 0, 0); lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7))
const jour = (n) => { const d = new Date(lundi); d.setDate(d.getDate() + n); return jl(d) }

for (const [nom, taille] of [['ordinateur', { width: 1280, height: 900 }], ['téléphone', { width: 390, height: 844 }]]) {
  const db = creerBase()
  const ctx = await browser.newContext({ viewport: taille, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' })
  const page = await ctx.newPage(); await brancher(page, db)
  await page.goto(B + '/connexion')
  await page.getByLabel('Email').fill('lea@x.fr'); await page.getByLabel('Mot de passe', { exact: true }).fill('secret')
  await page.getByRole('button', { name: 'Se connecter' }).click(); await page.waitForURL('**/mon-planning')
  await page.getByRole('button', { name: 'Mois' }).click()
  await page.locator('.fc-daygrid-event').first().waitFor()
  const cellule = (j) => page.locator(`td.fc-daygrid-day[data-date="${j}"] .fc-daygrid-day-frame`)

  // Clic sur le lundi (horaire avec pause et note)
  await cellule(jour(0)).click({ position: { x: 4, y: 4 } })
  const f = page.getByRole('dialog')
  await f.waitFor()
  const t = await f.innerText()
  verif(`${nom} : détail du jour (heures, pause, temps de travail, note)`, t.includes('09:00 – 17:00') && t.toLowerCase().includes('pause 12:00 – 13:00') && t.includes('7 h') && t.includes('Ouverture'))
  await page.screenshot({ path: `${CAP}/detail-jour-${nom === 'ordinateur' ? 'web' : 'mobile'}.png` })
  await f.getByRole('button', { name: 'Fermer', exact: true }).last().click(); await f.waitFor({ state: 'detached' })

  // Service de nuit (jeudi 18:00 – 02:00), en cliquant sur l'horaire lui-même
  await cellule(jour(3)).locator('.fc-daygrid-event').first().click()
  await f.waitFor()
  verif(`${nom} : service de nuit indiqué « lendemain »`, (await f.innerText()).includes('18:00 – 02:00') && (await f.innerText()).includes('lendemain'))
  await page.keyboard.press('Escape'); await f.waitFor({ state: 'detached' })

  // Jour sans service
  await cellule(jour(2)).click({ position: { x: 4, y: 4 } })
  await f.waitFor()
  verif(`${nom} : jour sans service`, (await f.innerText()).includes('Pas de service ce jour-là.'))
  await ctx.close()
}

await browser.close()
console.log(`\n${ok} ok, ${ko} échec(s)`)
process.exitCode = ko ? 1 : 0
