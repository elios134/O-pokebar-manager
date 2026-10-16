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
const BUREAU = { width: 1280, height: 900 }, TEL = { width: 390, height: 844 }
const fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const jl = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const auj = new Date(); auj.setHours(0, 0, 0, 0)
const lundi = new Date(auj); lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7))
// Tous les jours du mois en cours
const joursDuMois = []
for (let d = new Date(auj.getFullYear(), auj.getMonth(), 1); d.getMonth() === auj.getMonth(); d.setDate(d.getDate() + 1)) joursDuMois.push(new Date(d))
const lundis = joursDuMois.filter((d) => d.getDay() === 1), dimanches = joursDuMois.filter((d) => d.getDay() === 0)
const caseDu = (page, nom, d) => page.getByRole('button', { name: `${nom}, ${fmtLong.format(d)} :` })
const horairesDu = (db, id, d) => { const f = new Date(d); f.setDate(f.getDate() + 1); return db.shifts.filter((s) => s.employe_id === id && new Date(s.debut) >= d && new Date(s.debut) < f) }
const heure = (iso) => new Date(iso).getHours()
const contient = async (loc, mot) => (await loc.getAttribute('aria-label')).includes(mot)

const db = creerBase()
// Congé accepté de Léa le 20 du mois (case bloquée)
const jourConge = new Date(auj.getFullYear(), auj.getMonth(), 20)
db.conges.push({ id: 'cL', employe_id: 'L', debut: jl(jourConge), fin: jl(jourConge), motif: null, statut: 'accepte', reponse: null, cree_le: auj.toISOString(), traite_le: null })

// ---------- Ordinateur ----------
{
  const { ctx, page } = await ouvrir(db, BUREAU)
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')

  // Contrat de Léa dans la page Employés
  await page.locator('header nav').getByRole('link', { name: 'Employés' }).click(); await page.getByText('lea@x.fr').waitFor()
  await page.locator('main > ul > li', { hasText: 'Léa' }).getByRole('button', { name: 'Modifier' }).click()
  const f = page.getByRole('dialog')
  await f.getByLabel('Contrat (heures par semaine)').fill('35')
  await f.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await f.waitFor({ state: 'detached' })
  verif('contrat de Léa enregistré (35 h)', db.profiles.find((p) => p.id === 'L').heures_contrat === 35)

  // Depuis la grille de l'équipe, clic sur le nom de Léa
  await page.locator('header nav').getByRole('link', { name: 'Planning' }).click(); await page.waitForURL('**/admin/planning')
  await page.locator('tbody th[scope="row"]').first().waitFor()
  await page.locator('tbody th[scope="row"]').getByRole('button', { name: /Léa Martin/ }).click()
  await page.waitForURL(/vue=employe/)
  await caseDu(page, 'Léa Martin', lundi).waitFor()
  verif('clic sur le nom → vue par employé de Léa', page.url().includes('employe=L') && (await page.getByLabel('Employé', { exact: true }).inputValue()) === 'L')
  verif('« Par employé » actif', (await page.getByRole('button', { name: 'Par employé' }).getAttribute('aria-pressed')) === 'true')
  verif('mois affiché par défaut', (await page.getByRole('button', { name: 'Mois', exact: true }).getAttribute('aria-pressed')) === 'true')
  verif('contrat affiché', (await page.getByText('Contrat 35 h / sem.').count()) === 1)
  verif('horaire existant de Léa affiché', (await caseDu(page, 'Léa Martin', lundi).innerText()).includes('9h–17h'))
  verif('jour de congé bloqué', await caseDu(page, 'Léa Martin', jourConge).isDisabled())
  const nbLignes = await page.locator('tbody tr:not(.sm\\:hidden)').count()
  verif('une ligne par semaine du mois (4 à 6)', nbLignes >= 4 && nbLignes <= 6)

  // Semaine type au pinceau (enregistrée tout de suite)
  const type = page.getByRole('region', { name: 'Semaine type de Léa' })
  await page.getByRole('button', { name: /^O Ouverture/ }).click()
  await type.getByRole('button', { name: /lundi/ }).click(); await type.getByRole('button', { name: /mardi/ }).click()
  await page.getByRole('button', { name: /^J Journée/ }).click()
  await type.getByRole('button', { name: /vendredi/ }).click()
  await page.getByRole('button', { name: /^J Journée/ }).click() // pinceau désactivé
  await page.waitForTimeout(300)
  const st = db.profiles.find((p) => p.id === 'L').semaine_type
  verif('semaine type enregistrée', st && st[0][0].debut === '10:00' && st[1].length === 1 && st[2].length === 0 && st[4][0].fin === '18:00')
  verif('semaine type : total 17 h 30 affiché', (await type.innerText()).includes('17 h 30'))
  await page.screenshot({ path: `${CAP}/employe-semaine-type.png`, fullPage: true })

  // Seulement les jours vides : le lundi déjà rempli ne bouge pas
  await type.getByRole('button', { name: 'Seulement les jours vides' }).click()
  await page.getByText(/Semaine type appliquée/).waitFor()
  verif('jours vides : l’horaire existant est gardé', (await caseDu(page, 'Léa Martin', lundi).innerText()).includes('9h–17h'))
  verif('jours vides : les autres lundis remplis', await contient(caseDu(page, 'Léa Martin', lundis.find((d) => d.getTime() !== lundi.getTime())), 'Ouverture'))
  // Tout le mois
  await type.getByRole('button', { name: 'Appliquer à tout le mois' }).click()
  verif('tout le mois : le lundi devient « O »', await contient(caseDu(page, 'Léa Martin', lundi), 'Ouverture'))
  verif('tout le mois : le congé reste bloqué', (await caseDu(page, 'Léa Martin', jourConge).innerText()).includes('Congé'))
  await page.screenshot({ path: `${CAP}/employe-mois.png`, fullPage: true })

  // Colonne « Dim » à la gomme, semaine entière au pinceau
  await page.getByRole('button', { name: 'Gomme' }).click()
  await page.getByRole('columnheader').getByRole('button', { name: 'Dim' }).click()
  await page.getByRole('button', { name: 'Gomme' }).click()
  verif('colonne Dim : tous les dimanches vidés', (await caseDu(page, 'Léa Martin', dimanches[0]).innerText()).trim().endsWith('+'))
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText(/Planning enregistré/).waitFor()
  verif('enregistré : chaque lundi du mois à 10:00', lundis.every((d) => { const h = horairesDu(db, 'L', d); return h.length === 1 && heure(h[0].debut) === 10 }))
  verif('enregistré : le lundi existant modifié, pas doublé', db.shifts.some((s) => s.id === 's1' && heure(s.debut) === 10))
  verif('enregistré : rien le jour de congé', horairesDu(db, 'L', jourConge).length === 0)
  verif('enregistré : aucun dimanche', dimanches.every((d) => horairesDu(db, 'L', d).length === 0))

  // Clic sur une semaine sans pinceau = sélection, puis horaire type
  const ligneSem = page.locator('tbody tr', { has: caseDu(page, 'Léa Martin', lundi) })
  await ligneSem.locator('th[scope="row"] button').click()
  verif('clic sur la semaine : jours choisis', (await page.getByText(/cases? choisies?/).first().innerText()).match(/\d+/) !== null)
  await page.getByRole('button', { name: /^S Soir/ }).click()
  verif('semaine remplie en « S »', await contient(caseDu(page, 'Léa Martin', lundi), 'Soir'))
  await page.getByRole('button', { name: 'Annuler', exact: true }).click()
  verif('annuler : retour à l’enregistré', await contient(caseDu(page, 'Léa Martin', lundi), 'Ouverture'))

  // Vue semaine
  await page.getByRole('button', { name: 'Semaine', exact: true }).click()
  await caseDu(page, 'Léa Martin', lundi).waitFor()
  verif('vue semaine : une seule semaine', (await page.locator('tbody th[scope="row"]').count()) === 1)
  verif('vue semaine : titre « Sem. »', (await page.getByRole('button', { name: /^Sem\. \d+ ·/ }).count()) === 1)
  await page.screenshot({ path: `${CAP}/employe-semaine.png`, fullPage: true })

  // Employé suivant
  await page.getByRole('button', { name: 'Employé suivant' }).click()
  verif('employé suivant : Zoé désactivée sautée, retour à Ana', await page.waitForFunction(() => document.querySelector('#vue-employe')?.value === 'A', null, { timeout: 3000 }).then(() => true, () => false))

  // Export PDF de l'employé
  await page.getByRole('button', { name: 'Exporter en PDF' }).click(); await page.waitForURL('**/impression?*')
  verif('export PDF : employé et période', page.url().includes('employe=A') && page.url().includes('periode=semaine'))
  await ctx.close()
}

// ---------- Téléphone ----------
{
  const { ctx, page } = await ouvrir(db, TEL)
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')
  await page.goto(B + '/admin/planning?vue=employe&employe=K')
  await caseDu(page, 'Karim Benali', lundi).waitFor()
  verif('mobile : pas de débordement horizontal', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  const semaine = page.locator('tr.sm\\:hidden', { hasText: /Sem\./ }).first()
  await semaine.getByRole('button').click()
  verif('mobile : semaine touchée → feuille de choix', await page.locator('div.fixed', { hasText: /cases? choisies?/ }).isVisible())
  await page.screenshot({ path: `${CAP}/employe-mobile.png` })
  await page.locator('div.fixed', { hasText: /cases? choisies?/ }).getByRole('button', { name: /^Midi/ }).click()
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText(/Planning enregistré/).waitFor()
  verif('mobile : semaine enregistrée en Midi', db.shifts.filter((s) => s.employe_id === 'K' && new Date(s.debut).getHours() === 11).length >= 1)
  await ctx.close()
}

await browser.close()
console.log(`\n${ok} ok, ${ko} échec(s)`)
process.exitCode = ko ? 1 : 0
