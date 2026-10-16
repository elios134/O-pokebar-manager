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
  await page.locator('tbody th[scope="row"]').first().waitFor()
  verif('admin : grille avec tous les employés actifs', (await page.locator('tbody th[scope="row"]').count()) === 3)
  verif('admin : plus de calendrier', (await page.locator('.fc').count()) === 0)
  await page.screenshot({ path: `${CAP}/web-admin-planning.png` })

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
  await page.locator('tbody th[scope="row"]').first().waitFor()
  await page.screenshot({ path: `${CAP}/mob-admin-planning.png`, fullPage: true })
  verif('téléphone admin : barre de menu en bas', await page.locator('nav.fixed').isVisible())
  verif('téléphone admin : la page ne déborde pas (la grille défile dans son cadre)', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390)
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
  await page.locator('tbody th[scope="row"]').first().waitFor()
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
