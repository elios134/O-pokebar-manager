import { chromium } from 'playwright'
import { creerBase, brancher } from './faux-supabase.mjs'
const B = process.env.ADRESSE ?? 'http://localhost:5180', CAP = process.argv[2] ?? 'tests/e2e/captures'
let ok = 0, ko = 0
const verif = (nom, cond) => { cond ? ok++ : ko++; console.log(cond ? '✔' : '✘', nom) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const db = creerBase()
async function ouvrir(taille) {
  const ctx = await browser.newContext({ viewport: taille, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' })
  const page = await ctx.newPage(); await brancher(page, db); return { ctx, page }
}
async function connecter(page, email) {
  await page.goto(B + '/connexion')
  await page.getByLabel('Email').fill(email); await page.getByLabel('Mot de passe', { exact: true }).fill('secret')
  await page.getByRole('button', { name: 'Se connecter' }).click()
}
{
  const { ctx, page } = await ouvrir({ width: 1280, height: 900 })
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')
  verif('menu admin sans « Échanges »', (await page.locator('header nav').getByRole('link', { name: /Échanges/ }).count()) === 0)
  await page.goto(B + '/admin/echanges'); await page.waitForURL('**/admin/planning')
  verif('ancienne adresse des échanges → renvoyée au planning', true)
  await page.locator('header nav').getByRole('link', { name: 'Employés' }).click(); await page.getByText('karim@x.fr').waitFor()
  // Changer l'email de Karim
  await page.locator('main > ul > li', { hasText: 'Karim' }).getByRole('button', { name: 'Modifier' }).click()
  const f = page.getByRole('dialog')
  await f.getByLabel('Email de connexion').fill('lea@x.fr'); await f.getByRole('button', { name: 'Changer' }).click()
  await f.getByRole('alert').waitFor()
  verif('email déjà pris : refusé avec message', (await f.getByRole('alert').innerText()).includes('existe déjà'))
  await f.getByLabel('Email de connexion').fill('karim.b@opokebar.fr'); await f.getByRole('button', { name: 'Changer' }).click()
  await f.waitFor({ state: 'detached' })
  verif('email de Karim changé', db.profiles.find((p) => p.id === 'K').email === 'karim.b@opokebar.fr' && db.comptes['karim.b@opokebar.fr'] === 'K')
  await page.getByText('karim.b@opokebar.fr').first().waitFor()
  // Supprimer Léa
  await page.locator('main > ul > li', { hasText: 'Léa' }).getByRole('button', { name: 'Modifier' }).click()
  const f2 = page.getByRole('dialog')
  await f2.getByRole('button', { name: 'Supprimer Léa Martin' }).click()
  verif('suppression : demande de confirmation', (await f2.getByRole('alert').innerText()).includes('ne peut pas être annulée'))
  await page.screenshot({ path: `${CAP}/web-supprimer.png` })
  await f2.getByRole('button', { name: 'Non, garder' }).click()
  verif('« Non, garder » : rien supprimé', db.profiles.some((p) => p.id === 'L'))
  await f2.getByRole('button', { name: 'Supprimer Léa Martin' }).click()
  await f2.getByRole('button', { name: 'Oui, supprimer' }).click(); await f2.waitFor({ state: 'detached' })
  verif('Léa supprimée avec ses horaires', !db.profiles.some((p) => p.id === 'L') && !db.shifts.some((x) => x.employe_id === 'L'))
  await page.getByText('Compte de Léa Martin supprimé.').waitFor()
  verif('Léa n’est plus dans la liste', (await page.locator('main > ul > li', { hasText: 'Léa' }).count()) === 0)
  // Sur soi-même : pas de suppression
  await page.locator('main > ul > li', { hasText: '(vous)' }).getByRole('button', { name: 'Modifier' }).click()
  verif('sur soi-même : pas de bouton supprimer', (await page.getByRole('dialog').getByRole('button', { name: /Supprimer/ }).count()) === 0)
  await page.keyboard.press('Escape')
  // Mon compte admin : changer son email
  await page.goto(B + '/mon-compte'); await page.getByRole('heading', { name: 'Mes informations' }).waitFor()
  await page.getByLabel('Email de connexion').fill('patron@opokebar.fr'); await page.getByRole('button', { name: 'Changer', exact: true }).click()
  await page.getByText('Email changé').waitFor()
  verif('admin : son propre email changé', db.comptes['patron@opokebar.fr'] === 'A')
  await page.screenshot({ path: `${CAP}/web-mon-compte-admin.png`, fullPage: true })
  await ctx.close()
}
{
  const { ctx, page } = await ouvrir({ width: 390, height: 844 })
  await connecter(page, 'karim.b@opokebar.fr'); await page.waitForURL('**/mon-planning')
  verif('Karim se connecte avec son nouvel email', true)
  verif('menu employé sans « Échanges »', (await page.locator('nav.fixed').getByRole('link', { name: /Échanges/ }).count()) === 0)
  await page.locator('nav.fixed').getByRole('link', { name: 'Compte' }).click(); await page.getByRole('heading', { name: 'Mes informations' }).waitFor()
  verif('employé : ne peut pas changer son email lui-même', (await page.getByLabel('Email de connexion').count()) === 0)
  await ctx.close()
}
console.log(`\n${ok} ok, ${ko} échec(s)`)
await browser.close()
process.exitCode = ko ? 1 : 0
