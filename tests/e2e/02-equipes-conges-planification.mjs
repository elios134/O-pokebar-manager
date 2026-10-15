import { chromium } from 'playwright'
import { creerBase, brancher } from './faux-supabase.mjs'
const B = process.env.ADRESSE ?? 'http://localhost:5180', CAP = process.argv[2] ?? 'tests/e2e/captures'
let ok = 0, ko = 0
const verif = (nom, cond) => { cond ? ok++ : ko++; console.log(cond ? '✔' : '✘', nom) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
async function ouvrir(db, taille, sw = 'block') {
  const ctx = await browser.newContext({ viewport: taille, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: sw })
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
  const { ctx, page } = await ouvrir(db, TEL)
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  const bouton = page.getByRole('button', { name: 'Installer' })
  await bouton.waitFor({ timeout: 5000 }).catch(() => {})
  verif('bouton Installer visible même sans installation directe', await bouton.isVisible())
  await bouton.click()
  const aide = page.getByRole('dialog', { name: "Installer l'application" })
  verif('installer : explications affichées', (await aide.innerText()).includes('écran'))
  await page.screenshot({ path: `${CAP}/mob-installer.png` })
  await aide.getByRole('button', { name: "J'ai compris" }).click()
  await ctx.close()
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

  // ---------- Admin : planning par équipe + congé affiché ----------
  await page.locator('header nav').getByRole('link', { name: 'Planning' }).click(); await page.waitForURL('**/admin/planning')
  await page.locator('.fc-event').first().waitFor()
  await page.getByLabel('Équipe', { exact: true }).selectOption({ label: 'Cuisine' }); await page.waitForTimeout(500)
  const textes = await page.locator('.fc-event').allInnerTexts()
  verif('planning filtré par équipe : seulement Karim', textes.length > 0 && textes.every((t) => t.includes('Karim')))
  const choix = await page.getByLabel('Employé', { exact: true }).locator('option').allInnerTexts()
  verif('sous-filtre : seulement les employés de l’équipe (+ Tous)', choix.length === 3 && choix[0] === 'Tous les employés' && choix.some((t) => t.includes('Karim')) && choix.some((t) => t.includes('Tom')) && !choix.some((t) => t.includes('Léa')))
  await page.getByLabel('Employé', { exact: true }).selectOption({ label: 'Tom Lefèvre' }); await page.waitForTimeout(400)
  verif('équipe + employé sans horaire : calendrier vide', (await page.locator('.fc-timegrid-event').count()) === 0)
  await page.getByLabel('Équipe', { exact: true }).selectOption({ label: 'Toutes les équipes' }); await page.waitForTimeout(400)
  verif('changer d’équipe remet « Tous les employés »', (await page.getByLabel('Employé', { exact: true }).inputValue()) === '')
  await page.screenshot({ path: `${CAP}/web-filtres-planning.png` })

  // ---------- Admin : planifier plusieurs jours ----------
  await page.getByRole('button', { name: 'Planifier plusieurs jours' }).click()
  const p = page.getByRole('dialog', { name: 'Planifier plusieurs jours' })
  await p.getByLabel('Employé').selectOption({ label: 'Léa Martin' })
  // mois suivant, jours 3, 4, 5
  await p.getByRole('button', { name: 'Mois suivant' }).click()
  const d = new Date(); const m = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  const j = (n) => `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`
  // Sans pause du tout : on doit pouvoir créer directement
  for (const n of [3, 4, 5]) await p.getByRole('button', { name: j(n), exact: true }).click()
  verif('3 jours choisis', (await p.locator('ul > li').count()) === 3)
  verif('sans pause : aucun champ de pause affiché', (await p.getByLabel('Début de pause').count()) === 0)
  verif('sans pause : bouton Créer actif', await p.getByRole('button', { name: /Créer 3 horaires/ }).isEnabled())
  // Pause ajoutée seulement sur le jour 1 et le jour 2
  const jour1 = p.locator('ul > li').nth(0), jour2 = p.locator('ul > li').nth(1), jour3 = p.locator('ul > li').nth(2)
  await jour1.getByRole('button', { name: '+ Ajouter une pause' }).click()
  verif('pause proposée au milieu de 9h–17h (13:00)', (await jour1.getByLabel('Début de pause').inputValue()) === '13:00')
  await jour1.getByLabel('Début de pause').fill('12:00'); await jour1.getByLabel('Fin de pause').fill('12:30')
  await jour2.getByLabel('Début', { exact: true }).fill('14:00'); await jour2.getByLabel('Fin', { exact: true }).fill('22:00')
  await jour2.getByRole('button', { name: '+ Ajouter une pause' }).click()
  await jour2.getByLabel('Début de pause').fill('12:00')
  verif('jour 2 : pause hors horaire signalée', (await jour2.innerText()).includes("La pause doit être dans l'horaire."))
  verif('bouton créer bloqué tant qu’il y a une erreur', await p.getByRole('button', { name: /Créer 3 horaires/ }).isDisabled())
  await jour2.getByLabel('Début de pause').fill('18:00'); await jour2.getByLabel('Fin de pause').fill('18:45')
  // le jour 3 : on ajoute une pause puis on la retire
  await jour3.getByRole('button', { name: '+ Ajouter une pause' }).click()
  await jour3.getByRole('button', { name: 'Retirer la pause' }).click()
  verif('pause retirée : plus de champs sur le jour 3', (await jour3.getByLabel('Début de pause').count()) === 0)
  verif('total affiché : 7 h 30 + 7 h 15 + 8 h = 22 h 45', (await p.innerText()).includes('Total : 22 h 45'))
  await page.screenshot({ path: `${CAP}/web-planifier.png`, fullPage: true })
  const avant = db.shifts.length
  await p.getByRole('button', { name: /Créer 3 horaires/ }).click(); await p.waitFor({ state: 'detached' })
  const crees = db.shifts.slice(avant)
  verif('3 horaires créés', crees.length === 3 && crees.every((s) => s.employe_id === 'L'))
  const h2 = crees.find((s) => new Date(s.debut).getHours() === 14)
  verif('jour 2 : 14:00–22:00 avec pause 45 min', h2 && new Date(h2.fin).getHours() === 22 && h2.pause_minutes === 45)
  verif('jour 3 : sans pause', crees.filter((s) => s.pause_minutes === 0).length === 1)
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
