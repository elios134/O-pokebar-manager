import { chromium } from 'playwright'
import { creerBase, brancher } from './faux-supabase.mjs'
const B = process.env.ADRESSE ?? 'http://localhost:5180', CAP = process.argv[2] ?? 'tests/e2e/captures'
let ok = 0, ko = 0
const verif = (nom, cond) => { cond ? ok++ : ko++; console.log(cond ? '✔' : '✘', nom) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
async function ouvrir(db, taille) {
  const ctx = await browser.newContext({ viewport: taille, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' })
  const page = await ctx.newPage(); await brancher(page, db); page.on('dialog', (d) => d.accept())
  return { ctx, page }
}
async function connecter(page, email) {
  await page.goto(B + '/connexion')
  await page.getByLabel('Email').fill(email); await page.getByLabel('Mot de passe', { exact: true }).fill('secret')
  await page.getByRole('button', { name: 'Se connecter' }).click()
}
const db = creerBase()

// ---------- Employé (téléphone) ----------
{
  const { ctx, page } = await ouvrir(db, { width: 390, height: 844 })
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  await page.locator('nav.fixed').getByRole('link', { name: 'Acomptes' }).click(); await page.waitForURL('**/mes-acomptes')
  await page.getByText(/aucune demande d'acompte/).waitFor()
  verif('menu employé : lien Acomptes', true)
  await page.getByRole('button', { name: 'Demander un acompte' }).click()
  const f = page.getByRole('dialog', { name: 'Demander un acompte' })
  verif('montant obligatoire', await f.getByRole('button', { name: 'Envoyer la demande' }).isDisabled())
  await f.getByLabel('Montant (€)').fill('150'); await f.getByLabel('Motif (facultatif)').fill('Réparation voiture')
  await page.screenshot({ path: `${CAP}/mob-demande-acompte.png` })
  await f.getByRole('button', { name: 'Envoyer la demande' }).click(); await f.waitFor({ state: 'detached' })
  verif('demande enregistrée (150 €, en attente)', db.acomptes.some((a) => a.employe_id === 'L' && a.montant === 150 && a.statut === 'en_attente'))
  verif('demande affichée « 150,00 € · En attente »', (await page.locator('main li').first().innerText()).replace(/\s/g, ' ').includes('150,00 €') && (await page.locator('main li').first().innerText()).includes('En attente'))
  verif('une seule demande à la fois : bouton bloqué', await page.getByRole('button', { name: 'Demander un acompte' }).isDisabled())
  await page.screenshot({ path: `${CAP}/mob-mes-acomptes.png`, fullPage: true })
  await ctx.close()
}

// ---------- Admin ----------
{
  const { ctx, page } = await ouvrir(db, { width: 1280, height: 900 })
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')
  const lien = page.locator('header nav').getByRole('link', { name: /Acomptes/ })
  await page.waitForTimeout(800)
  verif('menu admin : pastille 1 acompte en attente', (await lien.innerText()).includes('1'))
  await lien.click(); await page.waitForURL('**/admin/acomptes')
  const carte = page.locator('main li', { hasText: 'Léa Martin' })
  await carte.waitFor()
  verif('carte : montant et motif', (await carte.innerText()).replace(/\s/g, ' ').includes('150,00 €') && (await carte.innerText()).includes('Réparation voiture'))
  await carte.getByLabel("Message pour l'employé (facultatif)").fill('Versé vendredi')
  await page.screenshot({ path: `${CAP}/web-admin-acomptes.png` })
  await carte.getByRole('button', { name: 'Accepter' }).click()
  await page.getByText('Acompte de Léa accepté.').waitFor()
  const a = db.acomptes.find((x) => x.employe_id === 'L')
  verif('acompte accepté avec message', a.statut === 'accepte' && a.reponse === 'Versé vendredi')
  await page.waitForTimeout(400)
  verif('pastille disparue', !(await lien.innerText()).match(/\d/))
  await page.getByRole('tab', { name: 'Traitées' }).click()
  verif('onglet traitées : la demande y est', (await page.locator('main > ul > li').count()) === 1)
  await ctx.close()
}

// ---------- Employé : voit la réponse et peut redemander ----------
{
  const { ctx, page } = await ouvrir(db, { width: 1280, height: 900 })
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  await page.goto(B + '/mes-acomptes'); await page.locator('main li').first().waitFor()
  const t = await page.locator('main li').first().innerText()
  verif('réponse visible : Accepté + message', t.includes('Accepté') && t.includes('Versé vendredi'))
  verif('nouvelle demande possible', await page.getByRole('button', { name: 'Demander un acompte' }).isEnabled())
  await page.getByRole('button', { name: 'Demander un acompte' }).click()
  await page.getByLabel('Montant (€)').fill('80,5')
  await page.getByRole('button', { name: 'Envoyer la demande' }).click(); await page.getByRole('dialog').waitFor({ state: 'detached' })
  verif('montant à virgule accepté (80,50 €)', db.acomptes.some((x) => x.montant === 80.5))
  await page.locator('main li', { hasText: '80,50' }).getByRole('button', { name: 'Annuler la demande' }).click()
  await page.getByText('Demande annulée.').waitFor()
  verif('annulation d’une demande en attente', !db.acomptes.some((x) => x.montant === 80.5))
  await ctx.close()
}

await browser.close()
console.log(`\n${ok} ok, ${ko} échec(s)`)
process.exitCode = ko ? 1 : 0
