import { chromium } from 'playwright'
import { creerBase, brancher } from './faux-supabase.mjs'
const B = process.env.ADRESSE ?? 'http://localhost:5180', CAP = process.argv[2] ?? 'tests/e2e/captures'
let ok = 0, ko = 0
const verif = (nom, cond) => { cond ? ok++ : ko++; console.log(cond ? '✔' : '✘', nom) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const db = creerBase()
const il = (min) => new Date(Date.now() - min * 60000).toISOString()
db.notifications = [
  { id: 'n1', destinataire_id: 'L', titre: 'Congé accepté', texte: 'Du 21/12 au 24/12', lien: '/mes-conges', lue: false, cree_le: il(5) },
  { id: 'n2', destinataire_id: 'L', titre: '3 nouveaux horaires', texte: 'À partir du 02/11', lien: '/mon-planning', lue: false, cree_le: il(120) },
  { id: 'n3', destinataire_id: 'L', titre: 'Horaire modifié', texte: null, lien: '/mon-planning', lue: true, cree_le: il(3000) },
  { id: 'n4', destinataire_id: 'K', titre: 'Pour Karim', texte: null, lien: null, lue: false, cree_le: il(1) },
]
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' })
const page = await ctx.newPage(); await brancher(page, db)
await page.goto(B + '/connexion')
await page.getByLabel('Email').fill('lea@x.fr'); await page.getByLabel('Mot de passe', { exact: true }).fill('secret')
await page.getByRole('button', { name: 'Se connecter' }).click(); await page.waitForURL('**/mon-planning')
const cloche = page.getByRole('button', { name: /Notifications/ })
await page.getByRole('button', { name: 'Notifications : 2 non lues' }).waitFor({ timeout: 5000 }).catch(() => {})
verif('cloche : 2 non lues (pas celles de Karim)', (await cloche.getAttribute('aria-label')) === 'Notifications : 2 non lues')
await cloche.click()
const f = page.getByRole('dialog', { name: 'Notifications' })
verif('3 notifications listées', (await f.locator('li').count()) === 3)
verif('date relative affichée', (await f.innerText()).includes('il y a 5 minutes'))
await page.screenshot({ path: `${CAP}/mob-notifications.png` })
await f.getByRole('button', { name: /Congé accepté/ }).click(); await page.waitForURL('**/mes-conges')
verif('clic : ouvre la bonne page', true)
verif('clic : marquée comme lue', db.notifications.find((n) => n.id === 'n1').lue === true)
await page.getByRole('button', { name: 'Notifications : 1 non lue' }).waitFor({ timeout: 5000 }).catch(() => {})
verif('compteur passe à 1', (await cloche.getAttribute('aria-label')) === 'Notifications : 1 non lue')
await cloche.click()
await page.getByRole('button', { name: 'Tout marquer comme lu' }).click()
await page.waitForTimeout(300)
verif('tout lu', db.notifications.filter((n) => n.destinataire_id === 'L').every((n) => n.lue))
verif('notification de Karim intacte', db.notifications.find((n) => n.id === 'n4').lue === false)
await page.keyboard.press('Escape')
verif('compteur à zéro', (await cloche.getAttribute('aria-label')) === 'Notifications')
page.on('dialog', (d) => d.accept())
await cloche.click()
await page.getByRole('button', { name: 'Tout effacer' }).click()
await page.getByText('Aucune notification pour le moment.').waitFor({ timeout: 5000 }).catch(() => {})
verif('tout effacer : liste vide', (await page.getByText('Aucune notification pour le moment.').count()) === 1)
verif('tout effacer : celles de Léa supprimées', !db.notifications.some((n) => n.destinataire_id === 'L'))
verif('tout effacer : celle de Karim intacte', db.notifications.some((n) => n.id === 'n4'))
console.log(`\n${ok} ok, ${ko} échec(s)`)
await browser.close()
process.exitCode = ko ? 1 : 0
