import { chromium } from 'playwright'
import { creerBase, brancher } from './faux-supabase.mjs'
const B = process.env.ADRESSE ?? 'http://localhost:5180', CAP = process.argv[2] ?? 'tests/e2e/captures'
let ok = 0, ko = 0
const verif = (nom, cond) => { cond ? ok++ : ko++; console.log(cond ? '✔' : '✘', nom) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const db = creerBase()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'allow' })
await ctx.grantPermissions(['notifications'], { origin: B })
// Le vrai service d'envoi (Google, Apple…) n'est pas joignable ici : on imite l'abonnement du navigateur.
await ctx.addInitScript(() => {
  if (!('PushManager' in self)) return
  const faux = {
    endpoint: 'https://push.exemple/telephone-de-test',
    toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'cleP', auth: 'cleA' } } },
    async unsubscribe() { localStorage.removeItem('faux-abo'); return true },
  }
  PushManager.prototype.getSubscription = async () => (localStorage.getItem('faux-abo') ? faux : null)
  PushManager.prototype.subscribe = async () => { localStorage.setItem('faux-abo', '1'); return faux }
})
const page = await ctx.newPage(); await brancher(page, db); page.on('dialog', (d) => d.accept())
const abonnes = () => (db.abonnements ?? []).map((a) => a.profil_id).join(',')
async function connecter(email) {
  await page.goto(B + '/connexion')
  await page.getByLabel('Email').fill(email); await page.getByLabel('Mot de passe', { exact: true }).fill('secret')
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

await connecter('lea@x.fr'); await page.waitForURL('**/mon-planning')
const bandeau = page.getByText('Être prévenu sur ce téléphone quand votre planning change ?')
await bandeau.waitFor({ timeout: 8000 }).catch(() => {})
verif('planning : proposition d’activer les notifications', await bandeau.isVisible())
await page.screenshot({ path: `${CAP}/notif-bandeau.png` })
await page.getByRole('button', { name: 'Activer', exact: true }).click()
await bandeau.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
verif('activer : le téléphone est enregistré pour Léa', abonnes() === 'L')
verif('activer : la proposition disparaît', (await bandeau.count()) === 0)

await page.goto(B + '/mon-compte')
await page.getByText('Activées sur cet appareil').waitFor({ timeout: 8000 }).catch(() => {})
verif('mon compte : notifications indiquées comme activées', (await page.getByText('Activées sur cet appareil').count()) === 1)
await page.screenshot({ path: `${CAP}/notif-compte.png`, fullPage: true })
await page.getByRole('button', { name: 'Désactiver les notifications' }).click()
await page.getByRole('button', { name: 'Activer les notifications' }).waitFor()
verif('désactiver : le téléphone n’est plus enregistré', abonnes() === '')
await page.getByRole('button', { name: 'Activer les notifications' }).click()
await page.getByRole('button', { name: 'Désactiver les notifications' }).waitFor()
verif('réactiver depuis Mon compte', abonnes() === 'L')

// Déconnexion : plus de notifications de Léa sur ce téléphone ; un autre compte qui se connecte les reçoit.
await page.getByRole('button', { name: 'Se déconnecter' }).click(); await page.waitForURL('**/connexion')
verif('déconnexion : le téléphone ne reçoit plus celles de Léa', abonnes() === '')
await connecter('karim@x.fr'); await page.waitForURL('**/mon-planning')
await page.waitForFunction(() => true); await page.waitForTimeout(1500)
verif('connexion de Karim : le téléphone lui est relié automatiquement', abonnes() === 'K')

// Le service worker sait afficher une notification reçue
const sw = await (await page.request.get(B + '/sw.js')).text()
const pushSw = await (await page.request.get(B + '/push-sw.js')).text()
verif('service worker : gestion des notifications chargée', sw.includes('push-sw.js') && pushSw.includes("addEventListener('push'"))
const cdp = await ctx.newCDPSession(page)
const enregistrements = []
cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => enregistrements.push(...e.registrations))
await cdp.send('ServiceWorker.enable')
await page.waitForTimeout(500)
const reg = enregistrements.find((r) => !r.isDeleted)
if (reg) {
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin: new URL(B).origin, registrationId: reg.registrationId,
    data: JSON.stringify({ id: 'n1', titre: 'Horaire modifié', texte: 'Maintenant le 22/10 de 10:00 à 15:00', lien: '/mon-planning' }),
  })
  await page.waitForTimeout(800)
  const affichees = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => `${n.title}|${n.body}`))
  verif('notification reçue : affichée avec titre et texte', affichees.includes('Horaire modifié|Maintenant le 22/10 de 10:00 à 15:00'))
} else verif('service worker trouvé pour simuler une notification', false)

await browser.close()
console.log(`\n${ok} ok, ${ko} échec(s)`)
process.exitCode = ko ? 1 : 0
