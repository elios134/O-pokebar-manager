# Passage sur Cloudflare Pages avec l'adresse planning.opokebar.fr

But : héberger le site gratuitement (usage pour une entreprise autorisé) à l'adresse
**https://planning.opokebar.fr**, à la place de https://o-pokebar-manager-5ir7.vercel.app.

Rien ne change dans la base Supabase : seules l'adresse du site et l'hébergement changent.
On garde Vercel en route pendant la transition, puis on le coupe.

Repère : 👤 = à faire par toi · 🤖 = à me demander (Claude).

---

## 1. Acheter le nom de domaine 👤

- Acheter **opokebar.fr** chez **OVH** (environ 7 à 10 € par an ; Cloudflare ne vend pas
  les adresses en .fr, à notre connaissance).
- Vérifier le prix du **renouvellement**, pas seulement celui de la première année.
- Le titulaire peut être ton beau-frère ou son entreprise (c'est son restaurant).
- Pas besoin d'hébergement ni d'email chez OVH : seulement le nom de domaine.

## 2. Créer le site sur Cloudflare Pages 👤 (je peux te guider écran par écran)

1. Créer un compte gratuit sur https://dash.cloudflare.com.
2. Menu **Workers & Pages** → **Créer** → onglet **Pages** → **Connecter à Git**.
3. Autoriser Cloudflare à lire le dépôt GitHub **elios134/o-pokebar-manager**.
4. Réglages de construction :

   | Réglage | Valeur |
   |---|---|
   | Branche de production | `claude/project-continuation-0q43t2` |
   | Préréglage (framework) | Vite (ou « Aucun ») |
   | Commande de construction | `npm run build` |
   | Dossier de sortie | `dist` |

5. **Variables d'environnement** (les mêmes que sur Vercel ; les copier depuis Vercel →
   Settings → Environment Variables) :

   | Nom | Valeur |
   |---|---|
   | `VITE_SUPABASE_URL` | l'adresse du projet Supabase |
   | `VITE_SUPABASE_ANON_KEY` | la clé publique (« anon ») de Supabase |
   | `NODE_VERSION` | `22` |

6. Lancer le déploiement. Le site est alors disponible à une adresse du type
   `https://o-pokebar-manager.pages.dev` : vérifier que la page de connexion s'affiche.

## 3. Relier planning.opokebar.fr au site 👤

Dans Cloudflare : projet Pages → **Domaines personnalisés** → **Configurer un domaine** →
saisir `planning.opokebar.fr`. Cloudflare indique ensuite quoi faire. Le plus simple :

- **Chez OVH** (Domaines → opokebar.fr → Zone DNS → Ajouter une entrée) : une entrée
  **CNAME** `planning` → `o-pokebar-manager.pages.dev` (l'adresse exacte affichée à l'étape 2).
- Attendre que Cloudflare affiche **Actif** (de quelques minutes à quelques heures).
  Le cadenas (HTTPS) est fourni automatiquement.

## 4. Supabase : autoriser la nouvelle adresse 👤 ou 🤖

Supabase → **Authentication** → **URL Configuration** :

- **Site URL** : `https://planning.opokebar.fr`
- **Redirect URLs** : ajouter `https://planning.opokebar.fr/**`
  (garder l'ancienne adresse Vercel jusqu'à l'étape 7).

Sans ça, les liens « mot de passe oublié » renverraient vers l'ancienne adresse.

## 5. Petite mise à jour du code 🤖

- Remplacer l'ancienne adresse Vercel par `https://planning.opokebar.fr` dans la fonction
  d'envoi des notifications (`supabase/functions/envoyer-push/index.ts`), puis la redéployer.
- Le reste est déjà prêt dans le dépôt : `public/_headers` (pour que les téléphones
  récupèrent toujours la dernière version). Sur Cloudflare Pages, toutes les adresses de
  l'application renvoient vers la page principale sans réglage en plus.

## 6. Vérifier que tout marche 👤 + 🤖

Sur https://planning.opokebar.fr, avec un compte admin, un compte employé et un compte cuisine :

- [ ] Connexion, déconnexion, « mot de passe oublié » (le lien reçu par email ouvre la nouvelle adresse)
- [ ] Ouvrir directement une page (ex. `/mes-conges`) et la recharger : pas de page d'erreur
- [ ] Planning, congés, acomptes, cuisine, checklists
- [ ] Envoi d'une photo (DLC ou arrêt maladie) et d'un document
- [ ] Sur téléphone : installer l'application et activer les notifications, puis en recevoir une
      (ex. l'admin ajoute un horaire)

## 7. Prévenir l'équipe 👤

Message type à envoyer aux employés :

> Le planning change d'adresse : **https://planning.opokebar.fr**.
> Vos identifiants restent les mêmes. Si vous aviez installé l'application sur votre
> téléphone, supprimez l'ancienne icône, installez-la depuis la nouvelle adresse et
> réactivez les notifications dans « Mon compte ».

(Les notifications sont liées à l'adresse du site : il faut les réactiver une fois.)

## 8. Couper Vercel 👤

Une à deux semaines plus tard, quand plus personne n'utilise l'ancienne adresse :

- Supabase → Redirect URLs : retirer l'adresse Vercel.
- Vercel → projet → Settings → **Delete Project**.

---

### Coût après le passage

| Service | Prix |
|---|---|
| Nom de domaine opokebar.fr (OVH) | ≈ 7 à 10 € par an |
| Cloudflare Pages | 0 € |
| Supabase (gratuit) | 0 €, à passer en Pro (≈ 25 $ par mois) quand le client dépose des fiches de paie et autres documents |
