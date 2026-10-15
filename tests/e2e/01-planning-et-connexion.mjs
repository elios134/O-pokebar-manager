import { chromium } from 'playwright'
import { creerBase, brancher } from './faux-supabase.mjs'
const B = process.env.ADRESSE ?? 'http://localhost:5180', CAP = process.argv[2] ?? 'tests/e2e/captures'
let ok = 0, ko = 0
const verif = (nom, cond) => { cond ? ok++ : ko++; console.log(cond ? '✔' : '✘', nom) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })

async function ouvrir(db, taille) {
  const ctx = await browser.newContext({ viewport: taille, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' })
  const page = await ctx.newPage(); await brancher(page, db)
  page.on('dialog', (d) => d.accept())
  return { ctx, page }
}
async function connecter(page, email) {
  await page.goto(B + '/connexion')
  await page.getByLabel('Email').fill(email); await page.getByLabel('Mot de passe', { exact: true }).fill('secret')
  await page.getByRole('button', { name: 'Se connecter' }).click()
}
const BUREAU = { width: 1280, height: 860 }, TEL = { width: 390, height: 844 }

// ---------- Employé, ordinateur ----------
{
  const db = creerBase(); const { ctx, page } = await ouvrir(db, BUREAU)
  await page.goto(B + '/connexion'); await page.screenshot({ path: `${CAP}/web-connexion.png` })
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  await page.locator('.fc-event').first().waitFor()
  verif('employé : voit 2 horaires cette semaine', (await page.locator('.fc-event').count()) === 2)
  verif('employé : ne voit pas ceux de Karim', !(await page.locator('.fc').innerText()).includes('Karim'))
  await page.getByText('16 h').first().waitFor({ timeout: 3000 }).catch(() => {})
  verif('employé : total semaine 15 h (pause d’1 h déduite)', (await page.locator('aside').innerText()).includes('15 h'))
  verif('employé : 2 services', (await page.locator('aside').innerText()).includes('2 services'))
  await page.screenshot({ path: `${CAP}/web-mon-planning.png` })
  await page.getByRole('button', { name: 'Mois' }).click(); await page.waitForTimeout(300)
  verif('employé : vue mois', (await page.locator('.fc-dayGridMonth-view').count()) === 1)
  await page.getByRole('button', { name: /suivant|next/i }).click().catch(()=>{})
  await ctx.close()
}

// ---------- Employé, téléphone ----------
{
  const db = creerBase(); const { ctx, page } = await ouvrir(db, TEL)
  await page.goto(B + '/connexion')
  const mdp = page.getByLabel('Mot de passe', { exact: true })
  await mdp.fill('abc')
  verif('mot de passe masqué par défaut', (await mdp.getAttribute('type')) === 'password')
  await page.getByRole('button', { name: 'Afficher le mot de passe' }).click()
  verif('bouton œil : mot de passe visible', (await mdp.getAttribute('type')) === 'text')
  await page.screenshot({ path: `${CAP}/mob-connexion.png` })
  await page.getByRole('button', { name: 'Masquer le mot de passe' }).click()
  verif('bouton œil : remasqué', (await mdp.getAttribute('type')) === 'password')
  await connecter(page, 'lea@x.fr'); await page.waitForURL('**/mon-planning')
  await page.locator('.fc-list-event').first().waitFor()
  verif('téléphone : vue liste par défaut', (await page.locator('.fc-list').count()) === 1)
  await page.screenshot({ path: `${CAP}/mob-mon-planning.png`, fullPage: true })
  await ctx.close()
}

// ---------- Admin, ordinateur ----------
{
  const db = creerBase(); const { ctx, page } = await ouvrir(db, BUREAU)
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')
  await page.locator('.fc-event').first().waitFor()
  const nb = await page.locator('.fc-event').count()
  verif('admin : voit les 3 horaires de la semaine (tous employés)', nb === 3)
  await page.screenshot({ path: `${CAP}/web-admin-planning.png` })

  verif('filtres : « Toutes les équipes » et « Tous les employés » par défaut',
    (await page.getByLabel('Équipe', { exact: true }).inputValue()) === '' && (await page.getByLabel('Employé', { exact: true }).inputValue()) === '')
  await page.getByLabel('Employé', { exact: true }).selectOption({ label: 'Karim Benali' }); await page.waitForTimeout(400)
  verif('filtre employé : seulement Karim', (await page.locator('.fc-event').count()) === 1 && (await page.locator('.fc-event').innerText()).includes('Karim'))
  await page.getByLabel('Employé', { exact: true }).selectOption({ label: 'Tous les employés' }); await page.waitForTimeout(400)
  verif('« Tous les employés » : tout réapparaît', (await page.locator('.fc-event').count()) === 3)

  // Ajouter
  await page.getByRole('button', { name: 'Ajouter un horaire' }).first().click()
  const f = page.getByRole('dialog')
  await f.getByLabel('Employé').selectOption({ label: 'Karim Benali' })
  const auj = new Date(); const jour = `${auj.getFullYear()}-${String(auj.getMonth()+1).padStart(2,'0')}-${String(auj.getDate()).padStart(2,'0')}`
  await f.getByLabel('Date').fill(jour)
  await f.getByLabel('Début', { exact: true }).fill('20:00'); await f.getByLabel('Fin', { exact: true }).fill('02:00')
  verif('formulaire : indique fin le lendemain', (await f.innerText()).includes('se termine le lendemain'))
  await f.getByRole('button', { name: '+ Ajouter une pause' }).click()
  verif('pause proposée au milieu du service (23:00)', (await f.getByLabel('Début de pause').inputValue()) === '23:00')
  await f.getByLabel('Début de pause').fill('00:30'); await f.getByLabel('Fin de pause').fill('01:00')
  verif('formulaire : temps de travail pause déduite', (await f.innerText()).includes('Temps de travail : 5 h 30 (sur 6 h)'))
  await f.getByLabel('Note (facultatif)').fill('Soirée')
  await page.screenshot({ path: `${CAP}/web-ajout-horaire.png` })
  await f.getByRole('button', { name: 'Enregistrer' }).click()
  await f.waitFor({ state: 'detached' })
  const cree = db.shifts.find((s) => s.note === 'Soirée')
  verif('ajout : enregistré en base', !!cree && cree.employe_id === 'K')
  verif('ajout : durée 6 h (passe minuit)', cree && (new Date(cree.fin) - new Date(cree.debut)) === 6*3600e3)
  verif('ajout : pause de 30 min enregistrée', cree && cree.pause_minutes === 30)
  verif('ajout : pause placée après minuit (00:30 le lendemain)', cree && new Date(cree.pause_debut).getHours() === 0 && new Date(cree.pause_debut).getDate() !== new Date(cree.debut).getDate())
  await page.waitForTimeout(400)
  verif('ajout : apparaît dans le calendrier', (await page.locator('.fc-event', { hasText: 'Soirée' }).count()) === 1)

  // Modifier
  await page.locator('.fc-event', { hasText: 'Ouverture' }).click()
  const f2 = page.getByRole('dialog')
  verif('modifier : formulaire prérempli', (await f2.getByLabel('Début', { exact: true }).inputValue()) === '09:00')
  verif('modifier : pause préremplie (12:00 – 13:00)', (await f2.getByLabel('Début de pause').inputValue()) === '12:00' && (await f2.getByLabel('Fin de pause').inputValue()) === '13:00')
  await f2.getByLabel('Début de pause').fill('08:00')
  verif('pause hors du service : message', (await f2.innerText()).includes("La pause doit être comprise dans l'horaire"))
  verif('pause hors du service : bouton Enregistrer bloqué', await f2.getByRole('button', { name: 'Enregistrer' }).isDisabled())
  await f2.getByLabel('Début de pause').fill('12:00')
  await f2.getByRole('button', { name: 'Retirer la pause' }).click()
  await f2.getByLabel('Fin', { exact: true }).fill('09:30')
  verif('service court sans pause : 30 min de travail', (await f2.innerText()).includes('Temps de travail : 30 min'))
  await f2.getByLabel('Fin', { exact: true }).fill('17:00')
  await f2.getByRole('button', { name: '+ Ajouter une pause' }).click()
  await f2.getByLabel('Début de pause').fill('14:00'); await f2.getByLabel('Fin de pause').fill('14:45')
  await f2.getByLabel('Début', { exact: true }).fill('10:00'); await f2.getByRole('button', { name: 'Enregistrer' }).click()
  await f2.waitFor({ state: 'detached' })
  const s1 = db.shifts.find((s) => s.id === 's1')
  verif('modifier : enregistré', new Date(s1.debut).getHours() === 10)
  verif('modifier : pause déplacée à 14:00 – 14:45 (45 min)', new Date(s1.pause_debut).getHours() === 14 && s1.pause_minutes === 45)
  await page.waitForTimeout(300)
  verif('calendrier : pause dessinée dans l’horaire', (await page.locator('.fc-event', { hasText: 'Ouverture' }).locator('.pause-bande').count()) === 1)
  await page.screenshot({ path: `${CAP}/web-pause.png` })

  // Supprimer
  await page.waitForTimeout(300)
  await page.locator('.fc-event', { hasText: 'Soirée' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  verif('supprimer : retiré de la base', !db.shifts.some((s) => s.note === 'Soirée'))
  await page.waitForTimeout(300)
  verif('supprimer : retiré du calendrier', (await page.locator('.fc-event', { hasText: 'Soirée' }).count()) === 0)

  // Employés
  await page.getByRole('link', { name: 'Employés' }).click(); await page.waitForURL('**/admin/employes')
  await page.getByText('karim@x.fr').waitFor()
  verif('employés : liste complète', (await page.locator('main li').count()) === 4)
  verif('employés : pas de bouton Désactiver sur soi-même', (await page.locator('li', { hasText: '(vous)' }).getByRole('button', { name: 'Désactiver' }).count()) === 0)
  await page.screenshot({ path: `${CAP}/web-employes.png` })
  await page.getByLabel('Rôle de Karim Benali').selectOption('admin'); await page.getByRole('status').waitFor()
  verif('rôle : Karim devient admin', db.profiles.find((p) => p.id === 'K').role === 'admin')
  await page.locator('li', { hasText: 'Léa Martin' }).getByRole('button', { name: 'Désactiver' }).click()
  await page.locator('li', { hasText: 'Léa Martin' }).getByRole('button', { name: 'Réactiver' }).waitFor()
  verif('statut : Léa désactivée via la fonction serveur', db.profiles.find((p) => p.id === 'L').actif === false && db.appelsFonction.some((a) => a.action === 'statut'))
  await page.getByRole('button', { name: 'Créer un compte' }).click()
  const f3 = page.getByRole('dialog')
  await f3.getByLabel('Prénom').fill('Tom'); await f3.getByLabel('Nom', { exact: true }).fill('Lefèvre')
  await f3.getByLabel('Email').fill('tom@x.fr'); await f3.getByLabel('Mot de passe provisoire').fill('motdepasse1')
  await page.screenshot({ path: `${CAP}/web-creer-compte.png` })
  await f3.getByRole('button', { name: 'Créer le compte' }).click(); await f3.waitFor({ state: 'detached' })
  await page.getByText('tom@x.fr').waitFor()
  verif('création : Tom ajouté', db.profiles.some((p) => p.email === 'tom@x.fr' && p.role === 'employe'))
  await page.getByRole('button', { name: 'Créer un compte' }).click()
  const f4 = page.getByRole('dialog')
  await f4.getByLabel('Prénom').fill('X'); await f4.getByLabel('Nom', { exact: true }).fill('Y')
  await f4.getByLabel('Email').fill('tom@x.fr'); await f4.getByLabel('Mot de passe provisoire').fill('motdepasse1')
  await f4.getByRole('button', { name: 'Créer le compte' }).click()
  await f4.getByRole('alert').waitFor()
  verif('création : email en double refusé avec message clair', (await f4.getByRole('alert').innerText()).includes('existe déjà'))
  await page.keyboard.press('Escape')
  await page.getByPlaceholder('Rechercher un nom…').fill('kar')
  verif('recherche : filtre la liste', (await page.locator('main li').count()) === 1)
  await ctx.close()
}

// ---------- Admin, téléphone ----------
{
  const db = creerBase(); const { ctx, page } = await ouvrir(db, TEL)
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')
  await page.locator('.fc-list-event').first().waitFor()
  await page.screenshot({ path: `${CAP}/mob-admin-planning.png`, fullPage: true })
  verif('téléphone admin : barre de menu en bas', await page.locator('nav.fixed').isVisible())
  await page.getByRole('button', { name: 'Ajouter un horaire' }).click()
  await page.screenshot({ path: `${CAP}/mob-ajout-horaire.png` })
  await page.getByRole('button', { name: 'Fermer' }).click()
  await page.locator('nav.fixed').getByRole('link', { name: 'Employés' }).click(); await page.waitForURL('**/admin/employes')
  await page.getByText('karim@x.fr').waitFor()
  await page.screenshot({ path: `${CAP}/mob-employes.png`, fullPage: true })
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth)
  verif('téléphone : pas de défilement horizontal', largeur <= 390)
  await ctx.close()
}

// ---------- Tablette ----------
{
  const db = creerBase(); const { ctx, page } = await ouvrir(db, { width: 834, height: 1112 })
  await connecter(page, 'admin@x.fr'); await page.waitForURL('**/admin/planning')
  await page.locator('.fc-event').first().waitFor()
  await page.screenshot({ path: `${CAP}/tab-admin-planning.png` })
  await ctx.close()
}

// ---------- Compte désactivé ----------
{
  const db = creerBase(); const { ctx, page } = await ouvrir(db, BUREAU)
  await connecter(page, 'off@x.fr'); await page.getByRole('alert').waitFor()
  verif('compte désactivé : refusé', (await page.getByRole('alert').innerText()).includes('désactivé'))
  await ctx.close()
}
console.log(`\n${ok} ok, ${ko} échec(s)`)
await browser.close()
process.exitCode = ko ? 1 : 0
