import { chromium } from 'playwright'
import { creerBase, brancher } from './faux-supabase.mjs'
const B = process.env.ADRESSE ?? 'http://localhost:5180', CAP = process.argv[2] ?? 'tests/e2e/captures'
let ok = 0, ko = 0
const verif = (nom, cond) => { cond ? ok++ : ko++; console.log(cond ? '✔' : '✘', nom) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
async function ouvrir(db, taille, sw = 'block', userAgent) {
  const ctx = await browser.newContext({ viewport: taille, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: sw, ...(userAgent ? { userAgent } : {}) })
  const page = await ctx.newPage(); await brancher(page, db); page.on('dialog', (d) => d.accept())
  return { ctx, page }
}
async function connecter(page, email) {
  await page.goto(B + '/connexion')
  await page.getByLabel('Email').fill(email); await page.getByLabel('Mot de passe', { exact: true }).fill('secret')
  await page.getByRole('button', { name: 'Se connecter' }).click()
}
const BUREAU = { width: 1280, height: 900 }, TEL = { width: 390, height: 844 }
const db = creerBase()

// ---------- Bouton Installer (navigateur sans installation directe, comme Brave) ----------
{
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36'
  const { ctx, page } = await ouvrir(db, TEL, 'block', ANDROID)
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  const bouton = page.getByRole('button', { name: 'Installer' })
  await bouton.waitFor({ timeout: 5000 }).catch(() => {})
  verif('bouton Installer visible même sans installation directe', await bouton.isVisible())
  await bouton.click()
  const aide = page.getByRole('dialog', { name: "Installer l'application" })
  verif('installer : explications affichées', (await aide.innerText()).includes('écran'))
  await page.screenshot({ path: `${CAP}/mob-installer.png` })
  await aide.getByRole('button', { name: "J'ai compris" }).click()
  verif('après les explications, le bouton quitte l’en-tête', (await bouton.count()) === 0)
  await page.locator('nav.fixed').getByRole('link', { name: 'Compte' }).click(); await page.waitForURL('**/mon-compte')
  await page.getByRole('button', { name: 'Installer sur cet appareil' }).waitFor({ timeout: 5000 }).catch(() => {})
  await page.screenshot({ path: `${CAP}/mob-compte-installer.png`, fullPage: true })
  verif('installation toujours possible depuis « Mon compte »', await page.getByRole('button', { name: 'Installer sur cet appareil' }).isVisible())
  await ctx.close()
}

// ---------- Ordinateur sans installation directe : pas de bouton dans l'en-tête ----------
{
  const { ctx, page } = await ouvrir(db, BUREAU)
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  await page.locator('.fc-event').first().waitFor()
  verif('ordinateur : pas de bouton Installer dans l’en-tête', (await page.locator('header').getByRole('button', { name: 'Installer' }).count()) === 0)
}

// ---------- Employé : demander un congé ----------
{
  const { ctx, page } = await ouvrir(db, TEL)
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  await page.locator('nav.fixed').getByRole('link', { name: 'Congés', exact: true }).click(); await page.waitForURL('**/mes-conges')
  await page.getByText(/aucune demande de congé/).waitFor({ timeout: 5000 }).catch(() => {})
  verif('mes congés : vide au départ', (await page.getByText(/aucune demande de congé/).count()) === 1)
  await page.getByRole('button', { name: 'Demander un congé' }).click()
  const f = page.getByRole('dialog')
  await f.getByLabel('Du').fill('2026-12-21'); await f.getByLabel('Au (inclus)').fill('2026-12-24')
  verif('demande : 4 jours comptés', (await f.innerText()).includes('4 jours'))
  await f.getByLabel('Motif (facultatif)').fill('Noël')
  await page.screenshot({ path: `${CAP}/mob-demande-conge.png` })
  await f.getByRole('button', { name: 'Envoyer la demande' }).click(); await f.waitFor({ state: 'detached' })
  verif('demande : enregistrée en attente', db.conges.some((c) => c.employe_id === 'L' && c.motif === 'Noël' && c.statut === 'en_attente'))
  verif('demande : affichée « En attente »', (await page.locator('main li', { hasText: 'Noël' }).innerText()).includes('En attente'))
  // deuxième demande puis annulation
  await page.getByRole('button', { name: 'Demander un congé' }).click()
  await page.getByRole('dialog').getByLabel('Du').fill('2027-01-05'); await page.getByRole('dialog').getByLabel('Au (inclus)').fill('2027-01-05')
  await page.getByRole('dialog').getByLabel('Motif (facultatif)').fill('RDV')
  await page.getByRole('dialog').getByRole('button', { name: 'Envoyer la demande' }).click(); await page.getByRole('dialog').waitFor({ state: 'detached' })
  await page.locator('main li', { hasText: 'RDV' }).getByRole('button', { name: 'Annuler la demande' }).click()
  await page.getByText('Demande annulée.').waitFor()
  verif('annulation : demande retirée', !db.conges.some((c) => c.motif === 'RDV'))
  await page.screenshot({ path: `${CAP}/mob-mes-conges.png`, fullPage: true })
  await ctx.close()
}

// ---------- Admin : équipes ----------
{
  const { ctx, page } = await ouvrir(db, BUREAU)
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')
  await page.locator('header nav').getByLabel('2 en attente').waitFor({ timeout: 5000 }).catch(() => {})
  verif('menu : pastille 2 congés en attente', (await page.locator('header nav').getByRole('link', { name: /Congés/ }).innerText()).includes('2'))
  await page.locator('header nav').getByRole('link', { name: 'Employés' }).click(); await page.waitForURL('**/admin/employes')
  await page.getByText('karim@x.fr').waitFor()
  await page.getByRole('button', { name: /Équipes/ }).click()
  await page.getByLabel('Nom de la nouvelle équipe').fill('Cuisine'); await page.getByRole('button', { name: 'Créer', exact: true }).click()
  await page.getByText('Équipe Cuisine créée.').waitFor()
  verif('équipe créée', db.equipes.some((e) => e.nom === 'Cuisine'))
  await page.getByLabel('Nom de la nouvelle équipe').fill('Cuisine'); await page.getByRole('button', { name: 'Créer', exact: true }).click()
  await page.getByText('Une équipe porte déjà ce nom.').waitFor()
  verif('équipe en double refusée', db.equipes.filter((e) => e.nom === 'Cuisine').length === 1)
  const cuisine = db.equipes.find((e) => e.nom === 'Cuisine').id
  await page.getByLabel('Équipe de Karim Benali').selectOption({ label: 'Cuisine' })
  await page.getByText("Karim est dans l'équipe Cuisine.").waitFor()
  verif('Karim mis dans Cuisine', db.profiles.find((p) => p.id === 'K').equipe_id === cuisine)
  await page.getByLabel('Filtrer par équipe').selectOption({ label: 'Équipe Cuisine' })
  const lignes = page.locator('main > ul > li')
  verif('filtre équipe : seul Karim', (await lignes.count()) === 1 && (await lignes.innerText()).includes('Karim'))
  await page.getByLabel('Filtrer par équipe').selectOption('')
  await page.getByRole('button', { name: 'Créer un compte' }).click()
  const f = page.getByRole('dialog')
  await f.getByLabel('Prénom').fill('Tom'); await f.getByLabel('Nom', { exact: true }).fill('Lefèvre')
  await f.getByLabel('Email').fill('tom@x.fr'); await f.getByLabel('Mot de passe provisoire').fill('motdepasse1')
  await f.getByLabel('Équipe').selectOption({ label: 'Cuisine' })
  await f.getByRole('button', { name: 'Créer le compte' }).click(); await f.waitFor({ state: 'detached' })
  await page.getByText('tom@x.fr').waitFor()
  verif('compte créé directement dans une équipe', db.profiles.find((p) => p.email === 'tom@x.fr')?.equipe_id === cuisine)
  await page.screenshot({ path: `${CAP}/web-employes-equipes.png`, fullPage: true })

  // ---------- Admin : congés ----------
  await page.locator('header nav').getByRole('link', { name: /Congés/ }).click(); await page.waitForURL('**/admin/conges')
  const carte = page.locator('main li', { hasText: 'Léa Martin' })
  await carte.waitFor()
  await page.locator('main > ul > li', { hasText: 'Karim' }).waitFor()
  await page.locator('main > ul > li', { hasText: 'Léa' }).waitFor()
  const nbCartes = await page.locator('main > ul > li').count()
  verif('congés : 2 demandes en attente', nbCartes === 2)
  await page.screenshot({ path: `${CAP}/web-admin-conges.png`, fullPage: true })
  await carte.getByLabel("Message pour l'employé (facultatif)").fill('Bonnes fêtes')
  await carte.getByRole('button', { name: 'Accepter' }).click()
  await page.getByText('Congé de Léa accepté.').waitFor()
  const noel = db.conges.find((c) => c.motif === 'Noël')
  verif('congé accepté avec message', noel.statut === 'accepte' && noel.reponse === 'Bonnes fêtes')
  await page.locator('main li', { hasText: 'Karim' }).getByRole('button', { name: 'Refuser' }).click()
  await page.getByText('Congé de Karim refusé.').waitFor()
  verif('congé refusé', db.conges.find((c) => c.id === 'c1').statut === 'refuse')
  await page.waitForTimeout(400)
  verif('pastille disparue (plus rien en attente)', !(await page.locator('header nav').getByRole('link', { name: /Congés/ }).innerText()).match(/\d/))
  await page.getByRole('tab', { name: 'Traitées' }).click()
  verif('onglet traitées : 2 demandes', (await page.locator('main > ul > li').count()) === 2)

  // ---------- Admin : planning par équipe puis par employé ----------
  await page.locator('header nav').getByRole('link', { name: 'Planning' }).click(); await page.waitForURL('**/admin/planning')
  const lignesGrille = () => page.locator('tbody th[scope="row"]').allInnerTexts()
  await page.locator('tbody th[scope="row"]').first().waitFor()
  await page.getByLabel('Équipe', { exact: true }).selectOption({ label: 'Cuisine' })
  const noms = await lignesGrille()
  verif('planning filtré par équipe : Karim et Tom', noms.length === 2 && noms.some((n) => n.includes('Karim')) && noms.some((n) => n.includes('Tom')))
  const choix = await page.getByLabel('Employé', { exact: true }).locator('option').allInnerTexts()
  verif('sous-filtre : seulement les employés de l’équipe (+ Tous)', choix.length === 3 && choix[0] === 'Tous les employés' && choix.some((t) => t.includes('Karim')) && choix.some((t) => t.includes('Tom')) && !choix.some((t) => t.includes('Léa')))
  await page.getByLabel('Employé', { exact: true }).selectOption({ label: 'Tom Lefèvre' })
  verif('équipe + employé : une seule ligne', (await lignesGrille()).length === 1)
  await page.getByLabel('Équipe', { exact: true }).selectOption({ label: 'Toutes les équipes' })
  verif('changer d’équipe remet « Tous les employés »', (await page.getByLabel('Employé', { exact: true }).inputValue()) === '')
  await page.screenshot({ path: `${CAP}/web-filtres-planning.png` })
  await ctx.close()
}

// ---------- Employé : voit la réponse et le congé dans son planning ----------
{
  const { ctx, page } = await ouvrir(db, BUREAU)
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  await page.locator('header nav').getByRole('link', { name: 'Congés', exact: true }).click()
  const c = page.locator('main li', { hasText: 'Noël' }); await c.waitFor()
  verif('employé : congé « Accepté » + réponse visible', (await c.innerText()).includes('Accepté') && (await c.innerText()).includes('Bonnes fêtes'))
  await page.locator('header nav').getByRole('link', { name: 'Planning', exact: true }).click()
  await page.locator('.fc-event').first().waitFor()
  await page.getByRole('button', { name: 'Mois' }).click()
  // aller jusqu'à décembre
  for (let i = 0; i < 4 && !(await page.locator('.fc-toolbar-title').innerText()).toLowerCase().includes('décembre'); i++) {
    await page.locator('.fc-next-button').click(); await page.waitForTimeout(300)
  }
  verif('employé : congé visible dans le calendrier de décembre', (await page.locator('.fc-event.conge').count()) > 0)
  await page.screenshot({ path: `${CAP}/web-conge-calendrier.png` })
  await ctx.close()
}
console.log(`\n${ok} ok, ${ko} échec(s)`)
await browser.close()
process.exitCode = ko ? 1 : 0
