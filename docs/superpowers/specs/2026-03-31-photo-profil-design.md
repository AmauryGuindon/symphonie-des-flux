# Photo de profil — Design Spec
Date : 2026-03-31

## Contexte

L'appli Dany1st Barber (Angular + NestJS + MongoDB) permet aux clients de gérer leur compte. Il n'existe pas encore de photo de profil. Cette fonctionnalité ajoute un avatar circulaire sur la page compte, avec upload et suppression.

---

## Périmètre

- Upload d'une photo de profil par le client connecté
- Suppression de la photo (retour aux initiales)
- Affichage uniquement sur la page compte (pas dans la navbar)
- Stockage local pour l'instant, migrable vers Cloudinary en prod (voir TODO)

---

## Architecture

Un `StorageService` backend abstrait le stockage. Il expose deux méthodes :
- `save(file: Express.Multer.File): string` — enregistre le fichier, retourne l'URL publique
- `delete(url: string): void` — supprime le fichier à partir de son URL

Aujourd'hui : stockage disque dans `uploads/profile/`. La migration vers Cloudinary ne touchera que ce service.

---

## Backend

### 1. StorageService (`backend/src/common/storage/storage.service.ts`)
- `save(file)` : génère un nom unique `{timestamp}-{random}.{ext}`, écrit dans `uploads/profile/`, retourne `/uploads/profile/{filename}`
- `delete(url)` : extrait le nom de fichier depuis l'URL, supprime le fichier sur disque (silencieux si inexistant)

### 2. User schema (`backend/src/users/schemas/user.schema.ts`)
- Ajout : `profilePictureUrl?: string` (optionnel, pas de valeur par défaut)

### 3. Endpoints (`backend/src/users/users.controller.ts`)
Deux nouveaux endpoints protégés par JWT :

**`POST /users/me/profile-picture`**
- Multer `FileInterceptor` : dossier `uploads/profile/`, max 5MB, images uniquement
- Supprime l'ancienne photo via `StorageService.delete()` si elle existe
- Sauvegarde la nouvelle via `StorageService.save()`
- Met à jour `user.profilePictureUrl` en base
- Retourne `{ profilePictureUrl: string }`

**`DELETE /users/me/profile-picture`**
- Supprime le fichier via `StorageService.delete()`
- Met `user.profilePictureUrl` à `undefined` en base
- Retourne `{ profilePictureUrl: null }`

### 4. UsersService (`backend/src/users/users.service.ts`)
- Ajout : `updateProfilePicture(userId, url | null)` — simple `findByIdAndUpdate`

### 5. Static assets
- `uploads/profile/` servi statiquement (déjà configuré globalement dans `main.ts` pour `uploads/`)

---

## Frontend

### 1. User model (`src/app/models/user.model.ts`)
- Ajout : `profilePictureUrl?: string`

### 2. AuthService (`src/app/services/auth.service.ts`)
- `uploadProfilePicture(file: File)` : POST multipart `/api/users/me/profile-picture`, met à jour le signal `_user` avec la nouvelle URL, persiste dans localStorage
- `deleteProfilePicture()` : DELETE `/api/users/me/profile-picture`, vide `profilePictureUrl` dans le signal et localStorage

### 3. AccountComponent — UI avatar

**Sans photo :** cercle 96px, fond `#1a1a1a`, initiales en doré (`var(--gold)`), font-size 1.4rem, letter-spacing 0.05em.

**Avec photo :** même cercle, `object-fit: cover`, `border-radius: 50%`.

**Hover :** overlay semi-transparent + icône crayon centré. Curseur pointer. Clic → déclenche un `<input type="file" accept="image/*">` caché.

**Bouton supprimer :** visible uniquement si photo existante. Texte "Supprimer la photo", petit, couleur `#e74c3c`, discret (sous l'avatar). Confirmation non requise (action réversible par re-upload).

**États de chargement :** pendant l'upload, le cercle affiche un spinner à la place des initiales/photo.

---

## Gestion d'erreurs

- Fichier trop lourd (> 5MB) → message d'erreur sous l'avatar
- Format non supporté → même traitement
- Erreur réseau → message générique, pas de changement d'état UI

---

## Ce qui ne change pas

- Le PATCH `/api/users/me` existant n'est pas modifié
- La galerie admin n'est pas affectée
- La navbar reste inchangée
