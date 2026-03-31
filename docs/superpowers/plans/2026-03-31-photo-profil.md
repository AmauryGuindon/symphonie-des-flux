# Photo de profil — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux clients d'uploader, afficher et supprimer une photo de profil depuis leur page compte.

**Architecture:** Un `StorageService` backend abstrait le stockage disque (migrable vers Cloudinary). Deux nouveaux endpoints `POST/DELETE /users/me/profile-picture` gèrent l'upload via Multer. Le frontend ajoute un avatar circulaire en haut de la page compte avec initiales en fallback.

**Tech Stack:** NestJS + Multer (diskStorage), Mongoose, Angular Signals, Angular `@ViewChild`

---

## Fichiers modifiés / créés

| Fichier | Action |
|---------|--------|
| `backend/src/users/storage.service.ts` | Créer |
| `backend/uploads/profile/.gitkeep` | Créer |
| `backend/src/users/schemas/user.schema.ts` | Modifier — ajouter `profilePictureUrl` |
| `backend/src/users/users.service.ts` | Modifier — ajouter `updateProfilePicture` |
| `backend/src/users/users.controller.ts` | Modifier — ajouter 2 endpoints |
| `backend/src/users/users.module.ts` | Modifier — ajouter `StorageService` |
| `src/app/models/user.model.ts` | Modifier — ajouter `profilePictureUrl` |
| `src/app/services/auth.service.ts` | Modifier — ajouter 2 méthodes |
| `src/app/components/account/account.component.ts` | Modifier — avatar signals + méthodes |
| `src/app/components/account/account.component.html` | Modifier — bloc avatar |
| `src/app/components/account/account.component.scss` | Modifier — styles avatar |

---

## Task 1 : StorageService backend

**Fichiers :**
- Créer : `backend/src/users/storage.service.ts`
- Créer : `backend/uploads/profile/.gitkeep`

- [ ] **Créer le dossier uploads/profile**

```bash
mkdir -p "backend/uploads/profile"
touch "backend/uploads/profile/.gitkeep"
```

- [ ] **Créer `backend/src/users/storage.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';

const PROFILE_PATH = join(process.cwd(), 'uploads', 'profile');

@Injectable()
export class StorageService {
  constructor() {
    fs.mkdirSync(PROFILE_PATH, { recursive: true });
  }

  save(file: Express.Multer.File): string {
    return `/uploads/profile/${file.filename}`;
  }

  delete(url: string): void {
    if (!url) return;
    const filename = url.split('/').pop();
    if (!filename) return;
    try {
      fs.unlinkSync(join(PROFILE_PATH, filename));
    } catch {
      // silencieux — fichier peut déjà être absent
    }
  }
}
```

- [ ] **Commit**

```bash
git add backend/src/users/storage.service.ts backend/uploads/profile/.gitkeep
git commit -m "feat: StorageService pour photos de profil (stockage local)"
```

---

## Task 2 : User schema + UsersService

**Fichiers :**
- Modifier : `backend/src/users/schemas/user.schema.ts`
- Modifier : `backend/src/users/users.service.ts`

- [ ] **Ajouter `profilePictureUrl` au schema**

Dans `backend/src/users/schemas/user.schema.ts`, ajouter après le bloc `// --- Notes internes ---` :

```typescript
  // --- Photo de profil ---
  @Prop()
  profilePictureUrl?: string;
```

- [ ] **Ajouter `updateProfilePicture` dans UsersService**

Dans `backend/src/users/users.service.ts`, ajouter à la fin de la classe (avant la dernière accolade) :

```typescript
  async updateProfilePicture(userId: string, url: string | null): Promise<UserDocument> {
    const update = url
      ? { profilePictureUrl: url }
      : { $unset: { profilePictureUrl: '' } };
    const user = await this.userModel.findByIdAndUpdate(userId, update, { new: true });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }
```

- [ ] **Vérifier que le backend démarre sans erreur**

```bash
cd backend && npm run start:dev
```
Résultat attendu : `Backend Dany1st démarré sur http://localhost:3000/api`

- [ ] **Commit**

```bash
git add backend/src/users/schemas/user.schema.ts backend/src/users/users.service.ts
git commit -m "feat: champ profilePictureUrl sur User + updateProfilePicture"
```

---

## Task 3 : Endpoints UsersController + UsersModule

**Fichiers :**
- Modifier : `backend/src/users/users.controller.ts`
- Modifier : `backend/src/users/users.module.ts`

- [ ] **Mettre à jour les imports de UsersController**

Remplacer le bloc d'imports existant par :

```typescript
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Post,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from './users.service';
import { StorageService } from './storage.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';
```

- [ ] **Ajouter `StorageService` au constructeur**

Remplacer le constructeur existant :

```typescript
  constructor(
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
    @InjectModel(Visit.name) private visitModel: Model<VisitDocument>,
  ) {}
```

- [ ] **Ajouter les deux endpoints après `updateMe`**

Après la méthode `updateMe`, ajouter :

```typescript
  // Upload photo de profil
  @Post('me/profile-picture')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'profile'),
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + extname(file.originalname));
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new BadRequestException('Seules les images sont acceptées'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadProfilePicture(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fichier requis');
    const currentUser = await this.usersService.findById(req.user.userId);
    if (currentUser.profilePictureUrl) {
      this.storageService.delete(currentUser.profilePictureUrl);
    }
    const url = this.storageService.save(file);
    return this.usersService.updateProfilePicture(req.user.userId, url);
  }

  // Supprimer photo de profil
  @Delete('me/profile-picture')
  async deleteProfilePicture(@Request() req) {
    const currentUser = await this.usersService.findById(req.user.userId);
    if (currentUser.profilePictureUrl) {
      this.storageService.delete(currentUser.profilePictureUrl);
    }
    return this.usersService.updateProfilePicture(req.user.userId, null);
  }
```

- [ ] **Ajouter StorageService dans UsersModule**

Dans `backend/src/users/users.module.ts`, modifier la ligne `providers` :

```typescript
  providers: [UsersService, StorageService, LoyaltyScheduler],
```

- [ ] **Tester les endpoints manuellement**

Démarrer le backend et tester avec un client HTTP (ex: Thunder Client / Postman) :
- `POST /api/users/me/profile-picture` avec un fichier image → doit retourner le user avec `profilePictureUrl`
- `DELETE /api/users/me/profile-picture` → doit retourner le user sans `profilePictureUrl`
- Vérifier que `backend/uploads/profile/` contient le fichier uploadé
- Vérifier que la suppression efface bien le fichier

- [ ] **Commit**

```bash
git add backend/src/users/users.controller.ts backend/src/users/users.module.ts
git commit -m "feat: endpoints upload/suppression photo de profil"
```

---

## Task 4 : Frontend — User model + AuthService

**Fichiers :**
- Modifier : `src/app/models/user.model.ts`
- Modifier : `src/app/services/auth.service.ts`

- [ ] **Ajouter `profilePictureUrl` au modèle User**

Dans `src/app/models/user.model.ts`, ajouter dans l'interface `User` après `internalNotes?` :

```typescript
  profilePictureUrl?: string;
```

- [ ] **Ajouter les deux méthodes dans AuthService**

Dans `src/app/services/auth.service.ts`, ajouter après la méthode `updateProfile` :

```typescript
  uploadProfilePicture(file: File): Observable<User> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<User>(`${this.API}/users/me/profile-picture`, formData).pipe(
      tap(user => {
        this._user.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }),
    );
  }

  deleteProfilePicture(): Observable<User> {
    return this.http.delete<User>(`${this.API}/users/me/profile-picture`).pipe(
      tap(user => {
        this._user.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }),
    );
  }
```

- [ ] **Commit**

```bash
git add src/app/models/user.model.ts src/app/services/auth.service.ts
git commit -m "feat: uploadProfilePicture + deleteProfilePicture dans AuthService"
```

---

## Task 5 : AccountComponent — TypeScript

**Fichiers :**
- Modifier : `src/app/components/account/account.component.ts`

- [ ] **Ajouter ViewChild et ElementRef aux imports Angular**

Remplacer la ligne d'import Angular existante :

```typescript
import { Component, OnInit, signal, computed, ViewChild, ElementRef } from '@angular/core';
```

- [ ] **Ajouter les signals et computed pour l'avatar**

Après le bloc `// ── Changer mdp ───` (derniers signals déclarés), ajouter :

```typescript
  // ── Avatar ────────────────────────────────────────────────────────────────
  avatarLoading = signal(false);
  avatarError = signal('');

  initials = computed(() => {
    const u = this.user();
    if (!u) return '';
    return (u.firstName[0] + u.lastName[0]).toUpperCase();
  });

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
```

- [ ] **Ajouter les trois méthodes**

À la fin de la classe (avant la dernière accolade `}`), ajouter :

```typescript
  // ── Avatar ────────────────────────────────────────────────────────────────
  triggerFileInput(): void {
    this.fileInputRef.nativeElement.click();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.avatarError.set('Fichier trop lourd (max 5 Mo)');
      return;
    }
    this.avatarLoading.set(true);
    this.avatarError.set('');
    this.auth.uploadProfilePicture(file).subscribe({
      next: () => this.avatarLoading.set(false),
      error: () => {
        this.avatarLoading.set(false);
        this.avatarError.set('Erreur lors de l\'upload');
      },
    });
    input.value = '';
  }

  deletePhoto(): void {
    this.avatarLoading.set(true);
    this.avatarError.set('');
    this.auth.deleteProfilePicture().subscribe({
      next: () => this.avatarLoading.set(false),
      error: () => {
        this.avatarLoading.set(false);
        this.avatarError.set('Erreur lors de la suppression');
      },
    });
  }
```

- [ ] **Commit**

```bash
git add src/app/components/account/account.component.ts
git commit -m "feat: signals et méthodes avatar dans AccountComponent"
```

---

## Task 6 : AccountComponent — HTML + SCSS

**Fichiers :**
- Modifier : `src/app/components/account/account.component.html`
- Modifier : `src/app/components/account/account.component.scss`

- [ ] **Insérer le bloc avatar dans le header HTML**

Dans `src/app/components/account/account.component.html`, remplacer :

```html
    <div class="account__header reveal">
      <div class="account__header-left">
```

par :

```html
    <div class="account__header reveal">
      <div class="account__avatar-wrap">
        <div class="account__avatar" (click)="triggerFileInput()">
          @if (avatarLoading()) {
            <div class="account__avatar-spinner"></div>
          } @else if (u.profilePictureUrl) {
            <img [src]="u.profilePictureUrl" alt="Photo de profil" class="account__avatar-img" />
          } @else {
            <span class="account__avatar-initials">{{ initials() }}</span>
          }
          <div class="account__avatar-overlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
        </div>
        @if (u.profilePictureUrl) {
          <button class="account__avatar-delete" (click)="deletePhoto()">Supprimer la photo</button>
        }
        @if (avatarError()) {
          <span class="account__avatar-error">{{ avatarError() }}</span>
        }
        <input #fileInput type="file" accept="image/*" style="display:none" (change)="onFileChange($event)" />
      </div>

      <div class="account__header-left">
```

- [ ] **Ajouter les styles avatar dans le SCSS**

Dans `src/app/components/account/account.component.scss`, ajouter après le bloc `&__header-actions` (après la ligne `}` qui ferme ce bloc, vers la ligne 48) :

```scss
  &__avatar-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  &__avatar {
    position: relative;
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background: #1a1a1a;
    border: 2px solid rgba(201, 164, 74, 0.3);
    cursor: pointer;
    overflow: hidden;
    flex-shrink: 0;
    transition: border-color 0.2s;

    &:hover {
      border-color: var(--gold);

      .account__avatar-overlay { opacity: 1; }
    }
  }

  &__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__avatar-initials {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--gold);
    letter-spacing: 0.05em;
  }

  &__avatar-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;

    svg { color: #fff; }
  }

  &__avatar-spinner {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(26, 26, 26, 0.85);

    &::after {
      content: '';
      width: 24px;
      height: 24px;
      border: 2px solid rgba(201, 164, 74, 0.3);
      border-top-color: var(--gold);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  }

  &__avatar-delete {
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.7rem;
    color: #e74c3c;
    opacity: 0.6;
    padding: 0;
    transition: opacity 0.2s;

    &:hover { opacity: 1; }
  }

  &__avatar-error {
    font-size: 0.7rem;
    color: #e74c3c;
    text-align: center;
    max-width: 120px;
  }
```

- [ ] **Vérifier visuellement dans le navigateur**

- Sans photo : cercle avec initiales en doré
- Hover : overlay crayon visible
- Clic → sélecteur de fichier s'ouvre
- Upload → spinner → photo affichée
- "Supprimer la photo" → retour aux initiales
- Erreur > 5Mo → message sous l'avatar

- [ ] **Ajouter `@keyframes spin` dans le SCSS** (à la fin du fichier, après `@keyframes pulse`)

```scss
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Commit final**

```bash
git add src/app/components/account/account.component.html src/app/components/account/account.component.scss
git commit -m "feat: avatar photo de profil sur page compte (upload, suppression, initiales)"
```

---

## Task 7 : Push

- [ ] **Push**

```bash
git push
```
