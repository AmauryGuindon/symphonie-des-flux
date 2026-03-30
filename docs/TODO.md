# Dany1st Barber — Tâches futures

## Côté client

### Fidélité & récompenses
- [ ] Historique détaillé des points (raison du gain, date, montant)
- [X] Afficher les points qu'on gagnerait avec chaque prestation avant de réserver
- [ ] Email automatique lors d'un changement de palier (Bronze → Argent, etc.)

### Réservation
- [X] Rappel SMS/email 24h avant le RDV *(envoi automatique à 9h, anti-doublon `reminderSent`)*
- [ ] Liste d'attente si tous les créneaux d'une journée sont pris
- [ ] Récurrence : "reprendre le même RDV chaque mois"

### Compte
- [X] Système de notifications in-app (cloche) : palier atteint, points gagnés, RDV confirmé
- [ ] Photo de profil
- [ ] PWA installable sur téléphone (icône écran d'accueil, sans App Store) — `ng add @angular/pwa`

---

## Côté backoffice

### Gestion clients
- [X] Fiche client enrichie : notes internes (ex. "préfère les tempes rasées")
- [X] Recherche et filtres clients : par palier, dernière visite, points
- [ ] Export CSV de la base clients

### Comptabilité
- [X] Graphiques CA par prestation (donut chart SVG)
- [X] Comparatif mois N vs mois N-1 (badge ▲/▼ % sur le KPI principal)
- [X] Suivi des RDV annulés et leur impact sur le CA

### Planning
- [X] Vue agenda semaine (vision d'ensemble des RDV)
- [X] Blocage de plages horaires ponctuelles depuis l'UI (congés, fermeture exceptionnelle)

### Galerie
- [X] Réorganisation des photos par drag & drop
- [X] Catégories (Coupe, Barbe, Dégradé…)

---

## Priorités suggérées

| Priorité | Tâche | Impact |
|----------|-------|--------|
| ✅ Fait | Rappels RDV 24h avant | Réduit les no-shows |
| ✅ Fait | Fiche client avec notes internes | Améliore la qualité de service |
| ✅ Fait | Notifications in-app | Meilleure expérience client |
| ✅ Fait | Graphiques CA par prestation + comparatif + annulés | Aide à décider quoi promouvoir |
| ✅ Fait | Drag & drop galerie + catégories | Confort d'utilisation |
| ✅ Fait | Recherche & filtres clients | Meilleur suivi par palier |
| ✅ Fait | Vue agenda semaine | Vision globale des RDV |
| 🟡 Basse | Récurrence RDV | Fidélisation |
