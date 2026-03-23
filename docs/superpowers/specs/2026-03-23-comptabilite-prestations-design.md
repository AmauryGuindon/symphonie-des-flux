# Design — Comptabilité & Gestion des Prestations

**Date :** 2026-03-23
**Projet :** Dany1st Barber — Backoffice
**Statut :** Validé

---

## Contexte

Le backoffice existe déjà avec les sections : Dashboard, Clients, Fidélité, Parrainages, Rendez-vous, Horaires.

Deux nouvelles fonctionnalités sont demandées :
1. **Comptabilité** — visualiser les revenus et exporter pour la déclaration d'impôts (micro-entrepreneur)
2. **Gestion des prestations** — ajouter, modifier et désactiver des services avec leurs prix

---

## Décisions de design

- **Deux pages séparées** dans la sidebar (pas de tabs, pas d'intégration dans l'existant)
- **Revenus uniquement** (pas de suivi des dépenses pour l'instant — Dany travaille seul, pas de local)
- **Export CSV + PDF** (print CSS) pour les déclarations fiscales
- **Ajout/suppression manuelle de visites** depuis la page comptabilité
- **Soft delete** pour les prestations (champ `active: boolean`) — l'historique des visites passées est préservé

---

## Page 1 — Comptabilité (`/admin/comptabilite`)

### Objectif
Permettre à Dany de suivre ses revenus par période et d'exporter les données pour son comptable / sa déclaration d'impôts.

### Structure UI

**En-tête**
- Titre "Comptabilité"
- Boutons "⬇ CSV" et "⬇ PDF" (top right)

**Filtre de période**
- Toggle : Mois / Trimestre / Année
- Sélecteur de date (ex : "Mars 2026", "T1 2026", "2026")

**4 KPIs**
- Revenu de la période sélectionnée
- Revenu du trimestre en cours
- Revenu de l'année en cours
- Nombre de visites sur la période

**Breakdown par prestation**
- Liste des prestations avec montant total et barre de progression relative

**Breakdown par mode de paiement**
- Espèces / Virement / En ligne avec montant et pourcentage

**Tableau historique des visites**
- Colonnes : Date, Client, Prestation, Mode de paiement, Montant
- Bouton "Supprimer" sur chaque ligne (suppression avec confirmation)
- Bouton "Ajouter une visite" (modal : client, prestation, prix, mode de paiement, date)

**Export**
- CSV : téléchargement du tableau des visites de la période sélectionnée
- PDF : `window.print()` avec CSS `@media print` dédié (masque sidebar, boutons, filtres)

### Backend

**Nouveaux endpoints dans `AdminController` :**

```
GET  /admin/accounting?period=month&date=2026-03
     → { kpis, byService, byPayment, visits[] }

POST /admin/accounting/visits
     Body: { clientId?, clientName, serviceType, price, paymentMethod, visitDate }
     → appelle AdminService.createManualVisit() (nouvelle méthode)
       • crée une Visit avec tous les champs fournis
       • si clientId fourni : appelle usersService.recordVisit() pour mettre à jour lastVisitAt et visitCount
       • si clientId absent : enregistre la visite avec clientName seulement (walk-in)

DELETE /admin/accounting/visits/:id
     → supprime la Visit
```

**Logique d'agrégation** (dans `AdminService`) :
- Utilise `visitDate` si présent, sinon `createdAt` pour filtrer les visites
- `period=month&date=YYYY-MM` → filtre du 1er au dernier jour du mois
- `period=quarter&date=YYYY-QN` → filtre sur 3 mois (Q1=jan-mar, Q2=avr-jun, Q3=jul-sep, Q4=oct-déc)
- `period=year&date=YYYY` → filtre du 1er jan au 31 déc

**Modifications du schéma `Visit`** :
- Ajouter `paymentMethod: string` (optionnel, défaut `'especes'`, enum `['especes','virement','en_ligne']`)
- Ajouter `clientName: string` (optionnel, pour les visites sans compte client lié)
- Ajouter `visitDate: string` (format `YYYY-MM-DD`, optionnel) — champ explicite pour la date de la visite, car `createdAt` est géré automatiquement par Mongoose `timestamps: true` et n'est pas modifiable. L'agrégation utilisera `visitDate` en priorité, sinon `createdAt`.

**Note data historique :** Les visites existantes n'auront pas `paymentMethod` ni `visitDate`. Le breakdown par paiement affichera les anciennes visites comme "Inconnu/Espèces" — comportement accepté et documenté dans l'UI.

---

## Page 2 — Prestations (`/admin/prestations`)

### Objectif
Permettre à Dany de gérer le catalogue de services : créer, modifier les prix/points, et désactiver sans perdre l'historique.

### Structure UI

**En-tête**
- Titre "Prestations"
- Bouton "+ Ajouter une prestation" (ouvre un formulaire inline ou modal)

**Tableau des prestations actives**
- Colonnes : Nom, Prix, Points fidélité, Actions
- Action "Modifier" → formulaire inline ou modal pré-rempli
- Action "Désactiver" → confirmation, puis `active: false`

**Section prestations désactivées**
- Repliée par défaut, affiche le nombre "(N)"
- Chaque ligne : nom barré, prix, bouton "Réactiver"

**Formulaire ajouter/modifier (modal)**
- Champs : Nom, Prix (€), Points fidélité
- Boutons : Enregistrer / Annuler

### Backend

**Modification du schéma `ServiceConfig`** :
```typescript
@Prop({ default: true }) active: boolean;
```

**Migration des services existants** : `onModuleInit` dans `AdminService` utilise `$setOnInsert` — les 6 services déjà seedés n'auront pas `active: true`. Ajouter une étape de migration dans `onModuleInit` :
```typescript
await this.serviceConfigModel.updateMany(
  { active: { $exists: false } },
  { $set: { active: true } },
);
```

**Nouveaux endpoints dans `AdminController` :**
```
POST  /admin/services
      Body: { name, price, loyaltyPoints }
      → crée une ServiceConfig avec active: true

PATCH /admin/services/:id/toggle
      → inverse le champ active (active ↔ inactive)
```

**Endpoints existants mis à jour :**
```
GET /admin/services → filtre par active: true pour les clients (endpoint public)
                      retourne tout (actif + inactif) pour l'admin
```

**Endpoint public (booking)** : `GET /appointments/services` filtre `{ active: true }` pour ne montrer que les prestations actives aux clients.

---

## Données existantes réutilisées

| Donnée | Source |
|---|---|
| Prix des visites | `Visit.price` |
| Type de prestation | `Visit.serviceType` |
| Date de visite | `Visit.createdAt` |
| Catalogue de services | `ServiceConfig` (name, price, loyaltyPoints) |
| Authentification admin | JWT + RolesGuard existants |

---

## Ce qui n'est PAS dans ce scope

- Suivi des dépenses / charges
- Calcul automatique de TVA ou cotisations URSSAF
- Intégration comptable externe (Pennylane, etc.)
- Graphiques animés (barres de progression statiques suffisent)
- Notifications ou alertes de revenus

---

## Fichiers à créer / modifier

### Backend
- `backend/src/visits/schemas/visit.schema.ts` — ajouter `paymentMethod`, `clientName`, `visitDate`
- `backend/src/services/schemas/service-config.schema.ts` — ajouter `active`
- `backend/src/admin/admin.service.ts` — méthodes accounting + services CRUD
- `backend/src/admin/admin.controller.ts` — nouveaux endpoints
- `backend/src/admin/dto/record-visit.dto.ts` — ajouter `paymentMethod`, `visitDate`
- `backend/src/admin/dto/create-manual-visit.dto.ts` — NOUVEAU (clientId optionnel, clientName, serviceType, price, paymentMethod, visitDate)
- `backend/src/admin/dto/create-service.dto.ts` — NOUVEAU
- `backend/src/appointments/appointments.service.ts` — filtrer `active: true` sur les services publics

### Frontend
- `src/app/services/admin.service.ts` — mettre à jour l'interface `Visit` (ajouter `paymentMethod`, `clientName`, `visitDate`)
- `src/app/services/accounting.service.ts` — NOUVEAU (appels API comptabilité, réutilise l'interface Visit de admin.service.ts)
- `src/app/components/admin/accounting/` — NOUVEAU (component + html + scss)
- `src/app/components/admin/services/` — NOUVEAU (component + html + scss)
- `src/app/app.routes.ts` — 2 nouvelles routes enfants admin
- `src/app/components/admin/admin.component.html` — 2 nouveaux liens sidebar
