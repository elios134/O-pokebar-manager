import { chromium } from 'playwright'
import { creerBase, brancher } from './faux-supabase.mjs'
const B = process.env.ADRESSE ?? 'http://localhost:5180', CAP = process.argv[2] ?? 'tests/e2e/captures'
let ok = 0, ko = 0
const verif = (nom, cond) => { cond ? ok++ : ko++; console.log(cond ? '✔' : '✘', nom) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const db = creerBase()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'allow' })
const page = await ctx.newPage(); await brancher(page, db); page.on('dialog', (d) => d.accept())

await page.goto(B + '/connexion')
await page.getByLabel('Email').fill('lea@x.fr'); await page.getByLabel('Mot de passe', { exact: true }).fill('secret')
await page.getByRole('button', { name: 'Se connecter' }).click(); await page.waitForURL('**/mon-planning')
await page.locator('.fc-event').first().waitFor()
await page.evaluate(() => navigator.serviceWorker.ready)
await page.reload(); await page.locator('.fc-event').first().waitFor()
verif('pas de message de mise à jour au départ', (await page.getByText('Une nouvelle version est disponible.').count()) === 0)
verif('planning gardé sur l’appareil', await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('opk:planning:'))))

// Sans réseau
await ctx.setOffline(true); db.horsLigne = true
await page.reload()
await page.locator('.fc-event').first().waitFor({ timeout: 8000 }).catch(() => {})
verif('hors connexion : l’app s’ouvre et reste connectée', page.url().includes('/mon-planning'))
verif('hors connexion : bandeau « Pas de connexion internet »', (await page.getByText('Pas de connexion internet.').count()) === 1)
verif('hors connexion : les 2 horaires de la semaine affichés', (await page.locator('.fc-event').count()) === 2)
verif('hors connexion : date du planning enregistré indiquée', (await page.getByText(/Hors connexion : planning enregistré sur ce téléphone le/).count()) === 1)
verif('hors connexion : heures de la semaine calculées', !(await page.locator('aside').innerText()).includes('…'))
await page.screenshot({ path: `${CAP}/hors-ligne.png` })

// Session expirée pendant qu'on est hors connexion : on montre quand même le planning gardé
await page.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => /^sb-.*-auth-token$/.test(x))
  const s = JSON.parse(localStorage.getItem(k)); s.expires_at = Math.floor(Date.now() / 1000) - 60; localStorage.setItem(k, JSON.stringify(s))
})
await page.reload()
await page.locator('.fc-event').first().waitFor({ timeout: 8000 }).catch(() => {})
verif('session expirée hors connexion : planning toujours visible', page.url().includes('/mon-planning') && (await page.locator('.fc-event').count()) === 2)

// Retour du réseau
await ctx.setOffline(false); db.horsLigne = false
await page.getByText('Pas de connexion internet.').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
verif('réseau revenu : bandeau parti', (await page.getByText('Pas de connexion internet.').count()) === 0)

// Déconnexion : tout ce qui était gardé est effacé
await page.goto(B + '/mon-compte'); await page.getByRole('button', { name: 'Se déconnecter' }).click()
await page.waitForURL('**/connexion')
verif('déconnexion : données gardées effacées', await page.evaluate(() => !Object.keys(localStorage).some((k) => k.startsWith('opk:'))))

await browser.close()
console.log(`\n${ok} ok, ${ko} échec(s)`)
process.exitCode = ko ? 1 : 0
