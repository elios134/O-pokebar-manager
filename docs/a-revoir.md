# Points à revoir

## Compteur de congés (constat du 29/10/2026, rien de corrigé pour l'instant)

Cas signalé : **Charlyne** à **−5 jours**.

- Son congé : du vendredi 6 au mercredi 11 novembre 2026 (saisi par l'admin, accepté).
- Sa semaine type : travaille du lundi au vendredi ; samedi et dimanche = repos.
- Son compteur part du 23/10/2026, **sans solde de départ** saisi.

Pourquoi −5 :
1. **Pas de solde de départ** (cause principale) : acquis = 0, donc 0 − 5 = −5. À corriger par l'admin :
   Congés → Compteurs → « Corriger » → jours = solde réel de l'employé, motif « Solde de départ »,
   et régler « Compteur depuis le » à la date de ce solde. À faire pour **chaque employé**.
2. **Le samedi de repos est compté** : l'app compte du lundi au samedi (règle des jours ouvrables), même si
   l'employé ne travaille jamais ce jour-là.
3. **Le 11 novembre (férié) est compté** : l'app ne connaît pas les jours fériés.

Pour ce congé : l'app retire 5 jours ; 4 selon la règle légale (lundi au samedi, sans le férié) ; 3 en ne
comptant que ses jours de travail.

Correction proposée (pas encore validée par le client) :
- ne compter que les jours de travail habituels (semaine type), jamais les jours fériés ;
- acquis proportionnel au rythme (5 semaines par an) : 2,5 j/mois pour 6 jours par semaine, 2,08 pour 5 jours…

Déjà fait : le compteur est caché aux employés dans l'app (29/10). Reste à le réserver à l'admin
aussi dans la base (fonction `soldes_conges` et table `conges_corrections`), et à couper la notification
« Solde de congés corrigé » envoyée à l'employé.
