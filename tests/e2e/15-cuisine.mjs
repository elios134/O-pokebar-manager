import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
const BUREAU = { width: 1280, height: 900 }, TEL = { width: 390, height: 844 }
const jl = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const demain = new Date(); demain.setDate(demain.getDate() + 1)
// Petite image d'étiquette (PNG 1×1)
const photo = join(tmpdir(), 'etiquette-test.png')
writeFileSync(photo, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))

const db = creerBase()

// ---------- Admin : crée un frigo ----------
{
  const { ctx, page } = await ouvrir(db, BUREAU)
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')
  verif('admin : lien « Cuisine » dans le menu', await page.locator('header nav').getByRole('link', { name: /Cuisine/ }).waitFor({ timeout: 3000 }).then(() => true, () => false))
  await page.goto(B + '/cuisine?onglet=temperatures')
  await page.getByRole('button', { name: 'Gérer les frigos' }).click()
  const f = page.getByRole('dialog')
  await f.getByLabel('Nom').fill('Frigo cuisine'); await f.getByLabel('Mini (°C)').fill('0'); await f.getByLabel('Maxi (°C)').fill('4')
  await f.getByRole('button', { name: 'Ajouter le frigo' }).click()
  await f.getByText('Frigo cuisine').waitFor()
  verif('frigo créé (0 à 4 °C)', db.frigos.length === 1 && Number(db.frigos[0].temp_min) === 0 && Number(db.frigos[0].temp_max) === 4)
  await page.keyboard.press('Escape')
  await ctx.close()
}

// ---------- Cuisinier : DLC, température, commande ----------
{
  const { ctx, page } = await ouvrir(db, TEL)
  await connecter(page, 'chef@x.fr'); await page.waitForURL('**/mon-planning')
  const lien = page.getByRole('link', { name: /Cuisine/ }).first()
  verif('cuisine : lien « Cuisine » visible', await lien.waitFor({ timeout: 3000 }).then(() => true, () => false))
  verif('cuisine : badge (1 frigo pas relevé)', await page.waitForFunction((el) => el.innerText.includes('1'), await lien.elementHandle(), { timeout: 3000 }).then(() => true, () => false))
  await lien.click(); await page.waitForURL('**/cuisine')

  // DLC avec photo
  await page.getByRole('button', { name: 'Ajouter un produit' }).click()
  const d = page.getByRole('dialog')
  await d.locator('input[type=file]').setInputFiles(photo)
  await d.getByRole('img', { name: "Photo de l'étiquette" }).waitFor()
  await d.getByLabel('Produit').fill('Crème fraîche'); await d.getByLabel('DLC').fill(jl(demain))
  await d.getByRole('button', { name: 'Ajouter', exact: true }).click(); await d.waitFor({ state: 'detached' })
  const p = db.dlc_produits[0]
  verif('DLC enregistrée avec la photo', p?.nom === 'Crème fraîche' && p.dlc === jl(demain) && p.photo && `dlc/${p.photo}` in db.photos && p.ajoute_par === 'C')
  await page.getByText('Crème fraîche', { exact: true }).waitFor()
  verif('DLC : étiquette « Demain »', await page.locator('li', { hasText: 'Crème fraîche' }).getByText('Demain').isVisible())
  const vignette = page.getByRole('button', { name: /Voir la photo de l'étiquette : Crème fraîche/ })
  await vignette.locator('img').waitFor()
  verif('DLC : photo affichée', await vignette.locator('img').evaluate((i) => i.complete && i.naturalWidth > 0))
  await page.screenshot({ path: `${CAP}/cuisine-dlc.png` })

  // Température hors limites puis correction
  await page.getByRole('tab', { name: 'Températures' }).click()
  await page.getByText("Pas encore relevé aujourd'hui").waitFor()
  await page.getByLabel('Température de Frigo cuisine (°C)').fill('7,5')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText(/hors limites\. Votre responsable est prévenu/).waitFor()
  verif('relevé 7,5 °C enregistré', db.releves_temperature.length === 1 && Number(db.releves_temperature[0].temperature) === 7.5)
  await page.getByLabel('Température de Frigo cuisine (°C)').fill('3')
  await page.getByRole('button', { name: 'Corriger', exact: true }).click()
  await page.getByText(/3,0 °C enregistré/).waitFor()
  verif('relevé corrigé, toujours un seul par jour', db.releves_temperature.length === 1 && Number(db.releves_temperature[0].temperature) === 3)
  verif('saisie invalide refusée', await (async () => { await page.getByLabel('Température de Frigo cuisine (°C)').fill('abc'); return page.getByRole('button', { name: 'Corriger', exact: true }).isDisabled() })())
  await page.screenshot({ path: `${CAP}/cuisine-temperatures.png` })

  // Produit à commander
  await page.getByRole('tab', { name: 'À commander' }).click()
  await page.getByLabel('Produit').fill('Saumon'); await page.getByLabel('Quantité').fill('3 kg')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await page.getByRole('button', { name: 'Retirer Saumon' }).waitFor()
  verif('commande ajoutée', db.commandes.length === 1 && db.commandes[0].statut === 'a_commander' && db.commandes[0].demande_par === 'C')
  verif('cuisine : pas de bouton « Commandé »', (await page.getByRole('button', { name: 'Commandé', exact: true }).count()) === 0)
  verif('cuisine : peut retirer sa demande', await page.getByRole('button', { name: 'Retirer Saumon' }).isVisible())
  verif('mobile : pas de débordement horizontal', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  await page.screenshot({ path: `${CAP}/cuisine-commandes.png` })
  await ctx.close()
}

// ---------- Admin : coche Commandé puis Reçu, retire la DLC ----------
{
  const { ctx, page } = await ouvrir(db, BUREAU)
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')
  await page.goto(B + '/cuisine?onglet=commandes')
  await page.getByText('Demandé par Chloé Chef').waitFor().catch(() => {})
  await page.getByRole('button', { name: 'Commandé', exact: true }).click()
  await page.getByRole('region', { name: 'Commandé, en attente de livraison' }).getByText('Saumon').waitFor()
  verif('admin : commande passée en « Commandé »', db.commandes[0].statut === 'commande' && !!db.commandes[0].commande_le)
  await page.getByRole('button', { name: 'Reçu', exact: true }).click()
  await page.getByRole('region', { name: 'Reçu (7 derniers jours)' }).getByText('Saumon').waitFor()
  verif('admin : commande reçue', db.commandes[0].statut === 'recu' && !!db.commandes[0].recu_le)

  await page.getByRole('tab', { name: 'DLC' }).click()
  await page.getByRole('button', { name: 'Utilisé / jeté' }).click()
  await page.getByText('Crème fraîche retiré de la liste.').waitFor()
  verif('DLC retirée de la liste', !!db.dlc_produits[0].retire_le && (await page.locator('li', { hasText: 'Crème fraîche' }).count()) === 0)
  await ctx.close()
}

// ---------- Employé simple : pas d'accès ----------
{
  const { ctx, page } = await ouvrir(db, BUREAU)
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  verif('employé : pas de lien « Cuisine »', (await page.getByRole('link', { name: /Cuisine/ }).count()) === 0)
  await page.goto(B + '/cuisine'); await page.waitForURL('**/mon-planning')
  verif('employé : /cuisine renvoie vers son planning', page.url().endsWith('/mon-planning'))
  await ctx.close()
}

await browser.close()
console.log(`\n${ok} ok, ${ko} échec(s)`)
process.exitCode = ko ? 1 : 0
