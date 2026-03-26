# Dany1st Barber — Tâches futures

## Côté client

### Fidélité & récompenses
- [ ] Historique détaillé des points (raison du gain, date, montant)
- [ ] Afficher les points qu'on gagnerait avec chaque prestation avant de réserver
- [ ] Email automatique lors d'un changement de palier (Bronze → Argent, etc.)

### Réservation
- [ ] Rappel SMS/email 24h avant le RDV *(la table `reminders` existe déjà en backend)*
- [ ] Liste d'attente si tous les créneaux d'une journée sont pris
- [ ] Récurrence : "reprendre le même RDV chaque mois"

### Compte
- [ ] Système de notifications in-app (cloche) : palier atteint, points gagnés, RDV confirmé
- [ ] Photo de profil

---

## Côté backoffice

### Gestion clients
- [ ] Fiche client enrichie : notes internes (ex. "préfère les tempes rasées"), tags personnalisés
- [ ] Recherche et filtres clients : par palier, dernière visite, points
- [ ] Export CSV de la base clients

### Comptabilité
- [ ] Graphiques CA par prestation (pas seulement le CA global)
- [ ] Comparatif mois N vs mois N-1
- [ ] Suivi des RDV annulés et leur impact sur le CA

### Planning
- [ ] Vue agenda semaine (vision d'ensemble des RDV)
- [ ] Blocage de plages horaires ponctuelles depuis l'UI (congés, fermeture exceptionnelle) *(le champ `closedDates` existe déjà en backend)*

### Galerie
- [ ] Réorganisation des photos par drag & drop
- [ ] Catégories (Coupe, Barbe, Dégradé…)

---

## Priorités suggérées

| Priorité | Tâche | Impact |
|----------|-------|--------|
| 🔴 Haute | Rappels RDV 24h avant | Réduit les no-shows |
| 🔴 Haute | Fiche client avec notes internes | Améliore la qualité de service |
| 🟠 Moyenne | Graphiques CA par prestation | Aide à décider quoi promouvoir |
| 🟠 Moyenne | Notifications in-app | Meilleure expérience client |
| 🟡 Basse | Drag & drop galerie | Confort d'utilisation |
| 🟡 Basse | Récurrence RDV | Fidélisation |
