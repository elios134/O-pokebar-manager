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
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const lundi = new Date(); lundi.setHours(0, 0, 0, 0); lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7))
const jour = (n) => { const d = new Date(lundi); d.setDate(d.getDate() + n); return d }
const jl = (n) => { const d = jour(n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
// Horaires d'un employé qui commencent le jour n (0 = lundi de cette semaine)
const horairesDu = (db, id, n) => db.shifts.filter((s) => s.employe_id === id && new Date(s.debut) >= jour(n) && new Date(s.debut) < jour(n + 1))
  .sort((a, b) => new Date(a.debut) - new Date(b.debut))
const heure = (iso) => { const d = new Date(iso); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` }
const caseDe = (page, nom, n) => page.getByRole('button', { name: new RegExp(`^${nom}, ${JOURS[n]} `) })

const db = creerBase()
db.conges.push({ id: 'c3', employe_id: 'A', debut: jl(3), fin: jl(3), motif: null, statut: 'en_attente', reponse: null, cree_le: jour(0).toISOString(), traite_le: null })
db.conges.push({ id: 'c2', employe_id: 'K', debut: jl(4), fin: jl(4), motif: null, statut: 'accepte', reponse: null, cree_le: jour(0).toISOString(), traite_le: null })

// ---------- Ordinateur ----------
{
  const { ctx, page } = await ouvrir(db, BUREAU)
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')
  await caseDe(page, 'Léa Martin', 0).waitFor({ timeout: 8000 })
  verif('la grille est la page Planning de l’admin', true)
  verif('demande de congé en attente signalée (pas bloquée)', (await caseDe(page, 'Ana Dupont', 3).getAttribute('aria-label')).includes('demande de congé en attente') && await caseDe(page, 'Ana Dupont', 3).isEnabled())
  const lignes = await page.locator('tbody th[scope="row"]').allInnerTexts()
  verif('une ligne par employé actif (pas Zoé, désactivée)', lignes.length === 3 && !lignes.join().includes('Zoé'))
  verif('regroupé par équipe', (await page.locator('tbody th[scope="colgroup"]').allInnerTexts()).join('|').toLowerCase() === 'salle|sans équipe')
  verif('horaire existant affiché (9h–17h)', (await caseDe(page, 'Léa Martin', 0).innerText()).includes('9h–17h'))
  verif('pas de case de congé modifiable', await caseDe(page, 'Karim Benali', 4).isDisabled())
  verif('horaires types chargés', (await page.getByRole('region', { name: 'Horaires types' }).getByRole('button').count()) === 7)

  // Pinceau
  await page.getByRole('button', { name: /^O Ouverture/ }).click()
  await caseDe(page, 'Karim Benali', 2).click(); await caseDe(page, 'Karim Benali', 3).click()
  await caseDe(page, 'Karim Benali', 4).click({ force: true }).catch(() => {})
  verif('pinceau : cases remplies avec « O »', (await caseDe(page, 'Karim Benali', 2).innerText()).startsWith('O'))
  verif('pinceau : congé non rempli', (await caseDe(page, 'Karim Benali', 4).innerText()).includes('Congé'))
  verif('barre « 2 cases modifiées »', (await page.getByText('2 cases modifiées').count()) === 1)
  verif('rien envoyé avant « Enregistrer »', horairesDu(db, 'K', 2).length === 0)
  await page.screenshot({ path: `${CAP}/grille-bureau-pinceau.png`, fullPage: true })
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText(/Planning enregistré/).waitFor()
  verif('enregistré : Karim mercredi 10:00 – 15:00', horairesDu(db, 'K', 2).map((s) => heure(s.debut) + '-' + heure(s.fin)).join() === '10:00-15:00')
  verif('enregistré : Karim jeudi aussi', horairesDu(db, 'K', 3).length === 1)

  // Sélection puis horaire type
  await page.getByRole('button', { name: /^O Ouverture/ }).click()
  verif('pinceau désactivé', (await page.getByRole('button', { name: /^O Ouverture/ }).getAttribute('aria-pressed')) === 'false')
  await caseDe(page, 'Ana Dupont', 0).click(); await caseDe(page, 'Ana Dupont', 1).click()
  verif('sélection : 2 cases choisies', (await page.getByText('2 cases choisies').count()) >= 1)
  await page.getByRole('button', { name: /^C Coupure/ }).click()
  verif('sélection remplie en coupure', (await caseDe(page, 'Ana Dupont', 1).innerText()).startsWith('C'))
  verif('total Ana : 16 h', (await page.locator('tr', { has: page.getByRole('rowheader', { name: /Ana Dupont/ }) }).locator('td').last().innerText()) === '16 h')

  // Clavier
  await caseDe(page, 'Léa Martin', 0).focus(); await page.keyboard.press('s')
  verif('clavier : lettre S remplit la case', (await caseDe(page, 'Léa Martin', 0).innerText()).startsWith('S'))
  await caseDe(page, 'Karim Benali', 1).focus(); await page.keyboard.press('Delete')
  verif('clavier : Suppr vide la case', (await caseDe(page, 'Karim Benali', 1).innerText()).trim() === '+')
  await page.keyboard.press('ArrowRight')
  verif('clavier : flèche droite déplace la case active', await caseDe(page, 'Karim Benali', 2).evaluate((e) => e === document.activeElement))

  // Heures et note
  await caseDe(page, 'Ana Dupont', 5).click()
  await page.getByRole('button', { name: 'Heures et note…' }).first().click()
  const f = page.getByRole('dialog', { name: 'Heures et note' })
  await f.getByLabel('Début', { exact: true }).fill('09:00'); await f.getByLabel('Fin', { exact: true }).fill('13:30')
  await f.getByRole('button', { name: 'Remplir la case' }).click(); await f.waitFor({ state: 'detached' })
  verif('heures libres : 9h–13h30', (await caseDe(page, 'Ana Dupont', 5).innerText()).includes('9h–13h30'))
  // Service de nuit avec pause après minuit et note
  await caseDe(page, 'Ana Dupont', 6).click()
  await page.getByRole('button', { name: 'Heures et note…' }).first().click()
  await f.getByLabel('Début', { exact: true }).fill('20:00'); await f.getByLabel('Fin', { exact: true }).fill('02:00')
  await f.getByRole('button', { name: '+ Ajouter une pause' }).click()
  await f.getByLabel('Début de pause').fill('03:00'); await f.getByLabel('Fin de pause').fill('03:30')
  verif('pause hors du service : refusée', (await f.innerText()).includes("La pause doit être dans l'horaire.") && await f.getByRole('button', { name: 'Remplir la case' }).isDisabled())
  await f.getByLabel('Début de pause').fill('00:30'); await f.getByLabel('Fin de pause').fill('01:00')
  await f.getByLabel('Note (facultatif)').fill('Soirée')
  await f.getByRole('button', { name: 'Remplir la case' }).click(); await f.waitFor({ state: 'detached' })
  verif('note : visible dans la description de la case', (await caseDe(page, 'Ana Dupont', 6).getAttribute('aria-label')).includes('« Soirée »'))
  // Un horaire type posé sur une case garde la note
  await caseDe(page, 'Ana Dupont', 6).focus(); await page.keyboard.press('s')
  verif('horaire type : la note est gardée', (await caseDe(page, 'Ana Dupont', 6).getAttribute('aria-label')).includes('« Soirée »'))
  await caseDe(page, 'Ana Dupont', 6).focus(); await page.keyboard.press('Delete')
  await caseDe(page, 'Ana Dupont', 6).click()
  await page.getByRole('button', { name: 'Heures et note…' }).first().click()
  await f.getByLabel('Début', { exact: true }).fill('20:00'); await f.getByLabel('Fin', { exact: true }).fill('02:00')
  await f.getByRole('button', { name: '+ Ajouter une pause' }).click()
  await f.getByLabel('Début de pause').fill('00:30'); await f.getByLabel('Fin de pause').fill('01:00')
  await f.getByLabel('Note (facultatif)').fill('Soirée')
  await f.getByRole('button', { name: 'Remplir la case' }).click(); await f.waitFor({ state: 'detached' })
  await page.screenshot({ path: `${CAP}/grille-bureau-avant-enregistrement.png`, fullPage: true })
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText(/Planning enregistré/).waitFor()
  verif('Ana : 2 horaires lundi (coupure)', horairesDu(db, 'A', 0).map((s) => heure(s.debut)).join() === '11:00,18:00')
  verif('Léa lundi : horaire modifié en Soir, sans pause', (() => { const s = db.shifts.find((x) => x.id === 's1'); return heure(s.debut) === '18:00' && s.pause_debut === null })())
  verif('Karim mardi : horaire supprimé', horairesDu(db, 'K', 1).length === 0)
  verif('Ana samedi : 9:00 – 13:30', horairesDu(db, 'A', 5).map((s) => heure(s.debut) + '-' + heure(s.fin)).join() === '9:00-13:30')
  const nuit = horairesDu(db, 'A', 6)[0]
  verif('nuit : 6 h, se termine le lendemain', nuit && new Date(nuit.fin) - new Date(nuit.debut) === 6 * 3600e3)
  verif('nuit : pause de 30 min après minuit', nuit && nuit.pause_minutes === 30 && new Date(nuit.pause_debut).getDate() !== new Date(nuit.debut).getDate())
  verif('nuit : note enregistrée', nuit && nuit.note === 'Soirée')

  // Export PDF depuis la grille
  await page.getByRole('button', { name: 'Exporter en PDF' }).click(); await page.waitForURL('**/impression?*')
  verif('export PDF : semaine affichée', page.url().includes(`date=${jl(0)}`) && page.url().includes('periode=semaine'))
  await page.goBack(); await caseDe(page, 'Léa Martin', 0).waitFor()

  // Copier la semaine précédente (vers la semaine suivante)
  await page.getByRole('button', { name: 'Semaine suivante' }).click()
  await caseDe(page, 'Karim Benali', 2).waitFor()
  verif('semaine suivante : horaire existant de Karim mercredi', (await caseDe(page, 'Karim Benali', 2).innerText()).includes('13h–21h'))
  await page.getByRole('button', { name: 'Copier la semaine précédente' }).click()
  await page.getByText(/Semaine précédente copiée/).waitFor()
  verif('copie : Karim mercredi devient « O »', (await caseDe(page, 'Karim Benali', 2).innerText()).startsWith('O'))
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText(/Planning enregistré/).waitFor()
  verif('copie enregistrée : Ana lundi prochain en coupure', horairesDu(db, 'A', 7).length === 2)
  verif('copie enregistrée : horaire de Karim modifié (pas doublé)', horairesDu(db, 'K', 9).length === 1 && horairesDu(db, 'K', 9)[0].id === 's4')

  // Horaires types
  await page.getByRole('button', { name: 'Gérer les horaires types' }).click()
  const g = page.getByRole('dialog', { name: 'Horaires types' })
  await g.getByRole('button', { name: '+ Nouvel horaire type' }).click()
  await g.getByLabel('Nom').fill('Brunch'); await g.getByLabel('Lettre').fill('o')
  await g.getByLabel('Début', { exact: true }).fill('09:00'); await g.getByLabel('Fin', { exact: true }).fill('14:00')
  await g.getByRole('button', { name: "Créer l'horaire type" }).click()
  await g.getByText('La lettre O est déjà prise.').waitFor()
  verif('horaire type : lettre déjà prise refusée', true)
  await g.getByLabel('Lettre').fill('B')
  await g.getByRole('button', { name: "Créer l'horaire type" }).click()
  await g.getByText('Brunch').waitFor()
  verif('horaire type créé', db.modeles_horaires.some((m) => m.code === 'B' && m.creneaux[0].debut === '09:00'))
  await page.screenshot({ path: `${CAP}/grille-bureau-horaires-types.png` })
  await g.getByRole('button', { name: 'Fermer' }).click()
  verif('nouveau pinceau dans la barre', (await page.getByRole('button', { name: /^B Brunch/ }).count()) === 1)
  await ctx.close()
}

// ---------- Téléphone ----------
{
  const { ctx, page } = await ouvrir(db, TEL)
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')
  await page.goto(B + '/admin/grille'); await page.waitForURL('**/admin/planning')
  verif('ancienne adresse /admin/grille → Planning', true)
  await caseDe(page, 'Karim Benali', 5).waitFor({ timeout: 8000 })
  await caseDe(page, 'Karim Benali', 5).click(); await caseDe(page, 'Karim Benali', 6).click()
  const feuille = page.locator('div.fixed', { hasText: 'cases choisies' })
  verif('mobile : feuille « 2 cases choisies »', await feuille.isVisible())
  await page.screenshot({ path: `${CAP}/grille-mobile-selection.png` })
  await feuille.getByRole('button', { name: /^Soir/ }).click()
  verif('mobile : cases remplies', (await caseDe(page, 'Karim Benali', 6).innerText()).startsWith('S'))
  await page.screenshot({ path: `${CAP}/grille-mobile-a-enregistrer.png` })
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText(/Planning enregistré/).waitFor()
  verif('mobile : enregistré', horairesDu(db, 'K', 5).length === 1 && horairesDu(db, 'K', 6).length === 1)
  await ctx.close()
}

// ---------- Employé : pas d'accès ----------
{
  const { ctx, page } = await ouvrir(db, TEL)
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  await page.goto(B + '/admin/grille'); await page.waitForTimeout(800)
  verif('employé : grille inaccessible', !page.url().includes('/admin/grille'))
  await ctx.close()
}

await browser.close()
console.log(`\n${ok} ok, ${ko} échec(s)`)
process.exitCode = ko ? 1 : 0
