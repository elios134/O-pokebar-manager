import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { creerBase, brancher } from './faux-supabase.mjs'
const B = process.env.ADRESSE ?? 'http://localhost:5180', CAP = process.argv[2] ?? 'tests/e2e/captures'
let ok = 0, ko = 0
const verif = (nom, cond) => { if (cond) ok++; else ko++; console.log(cond ? '✔' : '✘', nom) }
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
const attendre = (loc, ms = 3000) => loc.waitFor({ timeout: ms }).then(() => true, () => false)
const BUREAU = { width: 1280, height: 900 }, TEL = { width: 390, height: 844 }
const jl = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const auj = new Date(); auj.setHours(12, 0, 0, 0)
const dans = (n) => { const d = new Date(auj); d.setDate(d.getDate() + n); return d }
const fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

const photo = join(tmpdir(), 'arret-test.png')
writeFileSync(photo, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))
const pdf = join(tmpdir(), 'fiche-test.pdf')
writeFileSync(pdf, '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

const db = creerBase()
// Compteur de Léa depuis 4 mois (le 1er du mois) : 4 × 2,5 = 10 jours acquis.
const depuis = new Date(auj.getFullYear(), auj.getMonth() - 4, 1)
db.profiles.find((p) => p.id === 'L').conges_depuis = jl(depuis)

// ---------- Léa : solde et arrêt maladie (téléphone) ----------
{
  const { ctx, page } = await ouvrir(db, TEL)
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  await page.goto(B + '/mes-conges')
  await page.getByRole('tab', { name: 'Congés' }).waitFor()
  await page.waitForTimeout(500)
  verif('Léa : le compteur de congés n’est pas affiché (réservé à l’admin)', (await page.getByText('Mon solde').count()) === 0)
  await page.getByRole('tab', { name: 'Arrêts maladie' }).click()
  await page.getByRole('button', { name: 'Déclarer un arrêt maladie' }).click()
  const f = page.getByRole('dialog')
  await f.getByLabel('Au (inclus)').fill(jl(dans(2)))
  await f.locator('input[type=file]').setInputFiles(photo)
  await f.getByRole('img', { name: 'Aperçu du fichier choisi' }).waitFor()
  await f.getByLabel('Message (facultatif)').fill('grippe')
  await f.getByRole('button', { name: 'Envoyer' }).click(); await f.waitFor({ state: 'detached' })
  const a = db.arrets_maladie[0]
  verif('arrêt déclaré avec la photo, dans le dossier de Léa', a?.employe_id === 'L' && a.fin === jl(dans(2)) && a.photo?.startsWith('L/') && `arrets/${a.photo}` in db.photos && !a.recu_le)
  verif('Léa : arrêt marqué « Envoyé »', await attendre(page.getByText('Envoyé', { exact: true })))
  verif('mobile : pas de débordement horizontal', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  await page.screenshot({ path: `${CAP}/rh-arret-mobile.png` })
  await ctx.close()
}

// ---------- Admin : arrêt reçu, compteur, document, checklists, grille ----------
{
  const { ctx, page } = await ouvrir(db, BUREAU)
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')

  // La grille bloque les jours d'arrêt.
  const caseLea = page.getByRole('button', { name: `Léa Martin, ${fmtLong.format(auj)} :` })
  verif('grille : jour d’arrêt de Léa verrouillé « Maladie »', await attendre(caseLea) && (await caseLea.isDisabled()) && (await caseLea.innerText()).includes('Maladie'))

  await page.goto(B + '/admin/conges?onglet=maladie')
  await page.getByText('Léa Martin').first().waitFor()
  verif('admin : arrêt « À recevoir »', await page.getByText('À recevoir').isVisible())
  verif('admin : photo de l’arrêt visible', await attendre(page.getByRole('link', { name: /Voir l'arrêt de travail de Léa Martin/ })))
  await page.getByRole('button', { name: 'Arrêt reçu', exact: true }).click()
  await page.getByText(/Arrêt de Léa Martin marqué reçu/).waitFor()
  verif('admin : arrêt marqué reçu', !!db.arrets_maladie[0].recu_le)

  await page.getByRole('tab', { name: 'Compteurs' }).click()
  await page.getByRole('button', { name: 'Corriger le solde de Léa Martin' }).click()
  const panneau = page.getByRole('complementary', { name: 'Solde de Léa Martin' })
  await panneau.getByLabel('Jours (+ ou −)').fill('-1,25')
  await panneau.getByLabel('Motif').fill('Maladie 2 semaines')
  await panneau.getByRole('button', { name: 'Ajouter la correction' }).click()
  await page.getByText(/Solde de Léa corrigé/).waitFor()
  verif('admin : correction enregistrée', db.conges_corrections.length === 1 && Number(db.conges_corrections[0].jours) === -1.25)
  verif('admin : restant recalculé (8,75 j)', await attendre(page.locator('tr', { hasText: 'Léa Martin' }).getByText('8,75 j')))
  await page.screenshot({ path: `${CAP}/rh-compteurs.png`, fullPage: true })

  await page.goto(B + '/admin/employes')
  await page.getByRole('button', { name: 'Documents de Léa Martin' }).click()
  const d = page.getByRole('dialog')
  await d.locator('input[type=file]').setInputFiles(pdf)
  await d.getByRole('button', { name: 'Envoyer à Léa' }).click()
  await d.getByText(/envoyé à Léa/).waitFor()
  const doc = db.documents[0]
  verif('admin : fiche de paie déposée pour Léa', doc?.employe_id === 'L' && doc.type === 'paie' && doc.titre.startsWith('Fiche de paie · ') && `documents/${doc.chemin}` in db.photos)
  await page.keyboard.press('Escape')

  await page.goto(B + '/taches?onglet=gerer')
  await page.getByLabel('Nom de la nouvelle liste').fill('Fermeture')
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  await page.getByRole('region', { name: 'Liste Fermeture' }).waitFor()
  for (const t of ['Couper le gaz', 'Alarme activée']) {
    await page.getByLabel('Nouvelle tâche').fill(t)
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
    await page.getByText(t, { exact: true }).waitFor()
  }
  await page.getByLabel('Nom de la nouvelle liste').fill('Cuisine')
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  await page.getByRole('region', { name: 'Liste Cuisine' }).waitFor()
  await page.getByLabel('Réservée à la cuisine').click()
  await page.waitForFunction(() => document.querySelector('input[type=checkbox]:checked') !== null)
  await page.getByLabel('Nouvelle tâche').fill('Nettoyer la plancha')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await page.getByText('Nettoyer la plancha', { exact: true }).waitFor()
  verif('admin : 2 listes, 3 tâches, « Cuisine » réservée', db.checklists.length === 2 && db.checklist_taches.length === 3 && db.checklists.find((x) => x.nom === 'Cuisine').cuisine_seulement === true)
  await ctx.close()
}

// ---------- Léa : document et checklist ----------
{
  const { ctx, page } = await ouvrir(db, TEL)
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  verif('planning : carte « Checklists du jour » (0/2)', await attendre(page.getByRole('link', { name: /Checklists du jour.*Fermeture.*0\/2/s })))
  await page.goto(B + '/mon-compte')
  verif('compte : 1 nouveau document signalé', await attendre(page.getByRole('link', { name: /Mes documents.*1 nouveau/s })))
  await page.getByRole('link', { name: /Mes documents/ }).click(); await page.waitForURL('**/mes-documents')
  await page.getByText('Nouveau', { exact: true }).waitFor()
  const [onglet] = await Promise.all([ctx.waitForEvent('page'), page.getByRole('link', { name: 'Ouvrir' }).click()])
  await onglet.close()
  await page.waitForTimeout(300)
  verif('document ouvert : « vu » noté', !!db.documents[0].vu_le)

  await page.goto(B + '/taches')
  await page.getByText('Couper le gaz').waitFor()
  verif('Léa : la liste réservée à la cuisine est cachée', (await page.getByText('Nettoyer la plancha').count()) === 0 && (await page.getByRole('tab', { name: /Cuisine/ }).count()) === 0)
  await page.getByLabel(/Couper le gaz/).click()
  await page.getByText(/Léa M\. · \d\d:\d\d/).waitFor()
  verif('Léa coche « Couper le gaz » à son nom', db.checklist_coches.length === 1 && db.checklist_coches[0].coche_par === 'L')
  verif('barre du bas : lien « Tâches »', await page.locator('nav').last().getByRole('link', { name: 'Tâches' }).isVisible())
  await page.screenshot({ path: `${CAP}/checklist-mobile.png` })
  await page.goto(B + '/cuisine/registre'); await page.waitForURL('**/mon-planning')
  verif('Léa : pas d’accès au registre', page.url().endsWith('/mon-planning'))
  await ctx.close()
}

// ---------- Cuisine : fournisseur, livraison, commande, registre ----------
{
  const { ctx, page } = await ouvrir(db, BUREAU)
  await connecter(page, 'chef@x.fr'); await page.waitForURL('**/mon-planning')
  await page.goto(B + '/cuisine?onglet=fournisseurs')
  await page.getByRole('button', { name: 'Ajouter un fournisseur' }).click()
  const f = page.getByRole('dialog')
  await f.getByLabel('Nom').fill('Metro'); await f.getByLabel('Téléphone').fill('01 02 03 04 05')
  await f.getByLabel('Jours de livraison').fill('mardi et vendredi')
  await f.getByRole('button', { name: 'Enregistrer' }).click(); await f.waitFor({ state: 'detached' })
  verif('cuisine : fournisseur ajouté', db.fournisseurs.length === 1 && db.fournisseurs[0].telephone === '01 02 03 04 05')
  verif('cuisine : bouton « Appeler »', (await page.getByRole('link', { name: /Appeler/ }).getAttribute('href')) === 'tel:0102030405')
  verif('cuisine : pas de bouton « Supprimer » (admin seulement)', (await page.getByRole('button', { name: 'Supprimer Metro' }).count()) === 0)

  await page.getByRole('tab', { name: 'Livraisons' }).click()
  const l = page.getByRole('form', { name: 'Nouvelle livraison' })
  await l.getByLabel('Fournisseur').selectOption({ label: 'Metro' })
  await l.locator('input[type=file]').setInputFiles(photo)
  await l.getByLabel('Température (°C)').fill('9,5')
  await l.getByLabel('N° de lot').fill('L2610')
  await l.getByLabel('Livraison conforme').uncheck()
  await l.getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByText(/Livraison Metro enregistrée/).waitFor()
  const x = db.livraisons[0]
  verif('livraison enregistrée (Metro, 9,5 °C, lot, photo, non conforme)', x?.fournisseur === 'Metro' && Number(x.temperature) === 9.5 && x.lot === 'L2610' && x.conforme === false && `dlc/${x.photo}` in db.photos)
  verif('livraison non conforme : admin prévenu', (db.notifications ?? []).some((n) => n.titre === 'Livraison non conforme'))
  verif('livraison affichée « Non conforme »', await attendre(page.getByText('Non conforme', { exact: true })))

  await page.getByRole('tab', { name: 'À commander' }).click()
  await page.getByLabel('Produit').fill('Riz')
  await page.getByLabel('Fournisseur').selectOption({ label: 'Metro' })
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await page.getByRole('button', { name: 'Retirer Riz' }).waitFor()
  verif('commande rattachée à Metro, liste groupée par fournisseur', db.commandes[0]?.fournisseur_id === db.fournisseurs[0].id && await page.getByRole('region', { name: 'À commander' }).getByText('Metro', { exact: true }).isVisible())

  await page.goto(B + '/taches')
  verif('cuisine : voit aussi la liste réservée à la cuisine', await attendre(page.getByRole('tab', { name: /Cuisine/ })))

  await page.goto(B + '/cuisine')
  await page.getByRole('link', { name: 'Registre PDF' }).click(); await page.waitForURL('**/cuisine/registre')
  await page.getByRole('heading', { name: /4\. Checklists/ }).waitFor()
  const texte = await page.locator('article').innerText()
  verif('registre : livraisons, checklists et températures', texte.includes('Metro') && texte.includes('L2610') && texte.includes('Fermeture') && texte.includes('Températures des frigos'))
  await page.getByLabel('Livraisons').uncheck()
  verif('registre : une partie peut être retirée', !(await page.locator('article').innerText()).includes('L2610'))
  await page.screenshot({ path: `${CAP}/registre.png`, fullPage: true })
  await ctx.close()
}

await browser.close()
console.log(`\n${ok} ok, ${ko} échec(s)`)
process.exitCode = ko ? 1 : 0
