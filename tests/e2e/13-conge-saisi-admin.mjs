import { chromium } from 'playwright'
import { creerBase, brancher } from './faux-supabase.mjs'
const B = process.env.ADRESSE ?? 'http://localhost:5180', CAP = process.argv[2] ?? 'tests/e2e/captures'
let ok = 0, ko = 0
const verif = (nom, cond) => { cond ? ok++ : ko++; console.log(cond ? '✔' : '✘', nom) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const db = creerBase()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' })
const page = await ctx.newPage(); await brancher(page, db); page.on('dialog', (d) => d.accept())
const jl = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const lundi = new Date(); lundi.setHours(0, 0, 0, 0); lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7))
const mardi = new Date(lundi); mardi.setDate(mardi.getDate() + 1)

await page.goto(B + '/connexion')
await page.getByLabel('Email').fill('admin@x.fr'); await page.getByLabel('Mot de passe', { exact: true }).fill('secret')
await page.getByRole('button', { name: 'Se connecter' }).click(); await page.waitForURL('**/admin/planning')
await page.goto(B + '/admin/conges')
await page.getByRole('button', { name: 'Ajouter un congé' }).click()
const f = page.getByRole('dialog', { name: 'Ajouter un congé' })
await f.getByLabel('Employé').selectOption({ label: 'Karim Benali' })
await f.getByLabel('Du', { exact: true }).fill(jl(lundi)); await f.getByLabel('Au (inclus)').fill(jl(mardi))
await f.getByLabel('Motif (facultatif)').fill('Arrêt maladie')
const alerte = f.getByText(/horaire déjà prévu pendant ce congé/)
await alerte.waitFor({ timeout: 5000 }).catch(() => {})
verif('horaire de Karim pendant le congé signalé', await alerte.isVisible())
verif('« Les retirer du planning » coché par défaut', await f.getByRole('checkbox').isChecked())
await page.screenshot({ path: `${CAP}/web-ajout-conge-admin.png` })
await f.getByRole('button', { name: 'Enregistrer le congé' }).click(); await f.waitFor({ state: 'detached' })
const c = db.conges.find((x) => x.motif === 'Arrêt maladie')
verif('congé enregistré directement accepté', c && c.employe_id === 'K' && c.statut === 'accepte' && c.debut === jl(lundi) && c.fin === jl(mardi))
verif('horaire de Karim retiré du planning', !db.shifts.some((s) => s.id === 's3'))
verif('message de confirmation', (await page.getByRole('status').innerText()).includes('1 horaire retiré'))
verif('affiché dans « Traitées »', (await page.getByRole('tab', { name: 'Traitées' }).getAttribute('aria-selected')) === 'true' && (await page.locator('main li', { hasText: 'Arrêt maladie' }).count()) === 1)

// Dans la grille du planning, la case est bloquée en « Congé »
await page.goto(B + '/admin/planning')
const cas = page.getByRole('button', { name: /^Karim Benali, mardi .*en congé/ })
await cas.waitFor({ timeout: 8000 }).catch(() => {})
verif('grille : jour de congé bloqué', (await cas.count()) === 1 && await cas.isDisabled())

await browser.close()
console.log(`\n${ok} ok, ${ko} échec(s)`)
process.exitCode = ko ? 1 : 0
