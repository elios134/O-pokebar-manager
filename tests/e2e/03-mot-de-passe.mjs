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
async function connecter(page, email, mdp = 'secret') {
  await page.goto(B + '/connexion')
  await page.getByLabel('Email').fill(email); await page.getByLabel('Mot de passe', { exact: true }).fill(mdp)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}
const BUREAU = { width: 1280, height: 900 }, TEL = { width: 390, height: 844 }
const db = creerBase()

// ---- 1. Changer son mot de passe ----
{
  const { ctx, page } = await ouvrir(db, TEL)
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  await page.locator('nav.fixed').getByRole('link', { name: 'Compte', exact: true }).click(); await page.waitForURL('**/mon-compte')
  await page.getByRole('heading', { name: 'Mes informations' }).waitFor()
  verif('mon compte : infos affichées', (await page.locator('main').innerText()).includes('lea@x.fr'))
  await page.getByText('Salle').waitFor({ timeout: 4000 }).catch(() => {})
  verif('mon compte : équipe affichée', (await page.locator('main').innerText()).includes('Salle'))
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('nouveau123')
  await page.getByLabel('Confirmer le nouveau mot de passe').fill('nouveau12')
  verif('mots de passe différents : message + bouton bloqué', (await page.getByText('ne sont pas identiques').count()) === 1 && await page.getByRole('button', { name: 'Changer le mot de passe' }).isDisabled())
  await page.getByLabel('Confirmer le nouveau mot de passe').fill('nouveau123')
  await page.screenshot({ path: `${CAP}/mob-mon-compte.png`, fullPage: true })
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click()
  await page.getByText('Mot de passe changé').waitFor()
  verif('mot de passe changé', db.motsDePasse?.['lea@x.fr'] === 'nouveau123')
  await page.getByRole('button', { name: 'Se déconnecter' }).click(); await page.waitForURL('**/connexion')
  await connecter(page, 'lea@x.fr', 'secret'); await page.getByRole('alert').waitFor()
  verif('ancien mot de passe refusé', (await page.getByRole('alert').innerText()).includes('incorrect'))
  await connecter(page, 'lea@x.fr', 'nouveau123'); await page.waitForURL('**/mon-planning')
  verif('nouveau mot de passe accepté', true)
  await ctx.close()
}

// ---- 2. Mot de passe oublié ----
{
  const { ctx, page } = await ouvrir(db, TEL)
  await page.goto(B + '/connexion')
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click(); await page.waitForURL('**/mot-de-passe-oublie')
  await page.getByLabel('Email').fill('karim@x.fr'); await page.getByRole('button', { name: 'Envoyer le lien' }).click()
  await page.getByRole('status').waitFor()
  const r = db.recuperations?.[0]
  verif('email de récupération demandé', r?.email === 'karim@x.fr')
  verif('le lien ramène sur /nouveau-mot-de-passe du site', !!r?.redirect?.endsWith('/nouveau-mot-de-passe'))
  await page.screenshot({ path: `${CAP}/mob-mdp-oublie.png` })
  await page.goto(B + '/nouveau-mot-de-passe')
  await page.getByText('Lien expiré').waitFor()
  verif('sans lien valable : « Lien expiré »', true)
  // Lien valable = la personne arrive connectée
  await connecter(page, 'karim@x.fr'); await page.waitForURL('**/mon-planning')
  await page.goto(B + '/nouveau-mot-de-passe')
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('karim2026'); await page.getByLabel('Confirmer').fill('karim2026')
  await page.getByRole('button', { name: 'Enregistrer et continuer' }).click(); await page.waitForURL('**/mon-planning')
  verif('nouveau mot de passe enregistré puis redirection', db.motsDePasse?.['karim@x.fr'] === 'karim2026')
  await ctx.close()
}

// ---- 2 bis + 3. Admin : modifier le nom, donner un mot de passe ----
{
  const { ctx, page } = await ouvrir(db, BUREAU)
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')
  await page.locator('header nav').getByRole('link', { name: 'Employés' }).click(); await page.getByText('karim@x.fr').waitFor()
  await page.locator('main > ul > li', { hasText: 'Karim' }).getByRole('button', { name: 'Modifier' }).click()
  const f = page.getByRole('dialog')
  await f.getByLabel('Prénom').fill('Karim'); await f.getByLabel('Nom', { exact: true }).fill('Benali-Durand')
  await f.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await f.waitFor({ state: 'detached' })
  verif('nom modifié', db.profiles.find((p) => p.id === 'K').nom === 'Benali-Durand')
  await page.getByText('Karim Benali-Durand').first().waitFor()
  verif('liste à jour', true)
  await page.locator('main > ul > li', { hasText: 'Karim' }).getByRole('button', { name: 'Modifier' }).click()
  const f2 = page.getByRole('dialog')
  await f2.getByRole('button', { name: 'Générer' }).click()
  const genere = await f2.getByLabel('Nouveau mot de passe').inputValue()
  verif('mot de passe généré (≥ 8 caractères)', genere.length >= 8)
  await page.screenshot({ path: `${CAP}/web-modifier-employe.png` })
  await f2.getByRole('button', { name: 'Donner ce mot de passe' }).click(); await f2.waitFor({ state: 'detached' })
  verif('mot de passe donné par l’admin', db.motsDePasse?.['karim@x.fr'] === genere)
  verif('message avec le mot de passe à transmettre', (await page.getByRole('status').innerText()).includes(genere))
  await page.locator('main > ul > li', { hasText: '(vous)' }).getByRole('button', { name: 'Modifier' }).click()
  verif('sur son propre compte : pas de « mot de passe oublié » (il passe par Mon compte)', (await page.getByRole('dialog').getByText('Mot de passe oublié ?').count()) === 0)
  await ctx.close()
}
console.log(`\n${ok} ok, ${ko} échec(s)`)
await browser.close()
process.exitCode = ko ? 1 : 0
