// Lance tous les tests navigateur : construit l'appli avec une fausse base (aucune donnée réelle touchée),
// la sert en local, puis exécute chaque fichier de test.
// Utilisation : npm run test:e2e   (CHROMIUM_PATH=/chemin/vers/chrome si Chromium n'est pas installé par Playwright)
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ici = dirname(fileURLToPath(import.meta.url))
const racine = join(ici, '..', '..')
const sortie = join(racine, 'node_modules', '.tests-e2e')
const captures = join(ici, 'captures')
const port = 5180
mkdirSync(captures, { recursive: true })

// 1. Construction avec une fausse adresse Supabase : toutes les requêtes sont interceptées par faux-supabase.mjs
const env = { ...process.env, VITE_SUPABASE_URL: 'http://faux-supabase.test', VITE_SUPABASE_ANON_KEY: 'cle-test' }
const build = spawnSync('npx', ['vite', 'build', '--outDir', sortie, '--emptyOutDir', '--logLevel', 'error'], {
  cwd: racine,
  env,
  stdio: 'inherit',
})
if (build.status !== 0) process.exit(1)

// 2. Serveur local
const serveur = spawn('npx', ['vite', 'preview', '--outDir', sortie, '--port', String(port), '--strictPort'], {
  cwd: racine,
  env,
  stdio: 'ignore',
})
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(`http://localhost:${port}/`)).ok) break
  } catch {
    /* pas encore prêt */
  }
  await new Promise((r) => setTimeout(r, 200))
}

// 3. Chaque fichier de test, avec le fuseau horaire de Paris
const fichiers = readdirSync(ici).filter((f) => /^\d\d-.*\.mjs$/.test(f)).sort()
let echecs = 0
for (const f of fichiers) {
  console.log(`\n=== ${f}`)
  const r = spawnSync('node', [join(ici, f), captures], {
    cwd: racine,
    env: { ...process.env, TZ: 'Europe/Paris', ADRESSE: `http://localhost:${port}` },
    stdio: 'inherit',
  })
  if (r.status !== 0) echecs++
}
serveur.kill()
console.log(echecs ? `\n${echecs} fichier(s) de test en échec.` : '\nTous les tests sont passés.')
process.exit(echecs ? 1 : 0)
