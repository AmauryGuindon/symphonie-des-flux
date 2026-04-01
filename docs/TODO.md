# Dany1st Barber — Tâches futures

## Côté client

### Fidélité & récompenses
- [X] Historique détaillé des points (raison du gain, date, montant)
- [X] Afficher les points qu'on gagnerait avec chaque prestation avant de réserver
- [X] Email automatique lors d'un changement de palier (Bronze → Argent, etc.)

### Réservation
- [X] Rappel SMS/email 24h avant le RDV *(envoi automatique à 9h, anti-doublon `reminderSent`)*
- [ ] Liste d'attente si tous les créneaux d'une journée sont pris
- [ ] Récurrence : "reprendre le même RDV chaque mois"

### Compte
- [X] Système de notifications in-app (cloche) : palier atteint, points gagnés, RDV confirmé
- [X] Suppression des notifications (une par une ou tout supprimer) + marquage lu à l'ouverture
- [X] Photo de profil (avatar circulaire avec initiales en fallback, upload/suppression)
- [ ] PWA installable sur téléphone (icône écran d'accueil, sans App Store) — `ng add @angular/pwa`

---

## Côté backoffice

### Gestion clients
- [X] Fiche client enrichie : notes internes (ex. "préfère les tempes rasées")
- [X] Recherche et filtres clients : par palier, dernière visite, points
- [X] Export CSV de la base clients (filtrés, encodage UTF-8 pour Excel)

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
- [ ] Pagination côté public : 12 photos max affichées, bouton "Voir plus" ou pages suivantes

---

## Technique / Infrastructure

- [ ] **Logo dans les emails** : remplacer `cid:logo` par une URL hébergée (`https://ton-domaine.com/assets/logo/logo_dany1st.png`) une fois le site en prod — évite que le logo apparaisse aussi en pièce jointe dans Gmail
- [ ] **Photos de profil — migration stockage** : passer le `StorageService` du stockage local (`uploads/profile/`) vers Cloudinary (ou S3) avant le déploiement en prod — les fichiers locaux ne survivent pas aux redéploiements

---

## Priorités suggérées

| Priorité | Tâche | Impact |
|----------|-------|--------|
| ✅ Fait | Rappels RDV 24h avant | Réduit les no-shows |
| ✅ Fait | Fiche client avec notes internes | Améliore la qualité de service |
| ✅ Fait | Notifications in-app + suppression + marquage lu | Meilleure expérience client |
| ✅ Fait | Graphiques CA par prestation + comparatif + annulés | Aide à décider quoi promouvoir |
| ✅ Fait | Drag & drop galerie + catégories | Confort d'utilisation |
| ✅ Fait | Recherche & filtres clients | Meilleur suivi par palier |
| ✅ Fait | Vue agenda semaine | Vision globale des RDV |
| ✅ Fait | Photo de profil (avatar + upload + suppression) | Expérience personnalisée |
| ✅ Fait | Export CSV clients | Suivi & marketing |
| ✅ Fait | Navigation mois ← → en comptabilité | Ergonomie backoffice |
| 🟡 Basse | Pagination galerie publique | Perf & UX |
| 🟡 Basse | Récurrence RDV | Fidélisation |
| 🟡 Basse | PWA installable | Accessibilité mobile |
