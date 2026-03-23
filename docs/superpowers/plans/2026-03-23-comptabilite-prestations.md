# Comptabilité & Gestion des Prestations — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter deux pages au backoffice : une page Comptabilité (revenus par période, export CSV/PDF, ajout/suppression manuelle de visites) et une page Prestations (CRUD des services avec soft delete).

**Architecture:** Backend NestJS — nouveaux endpoints dans `AdminController` et `AppointmentsController` existants, nouvelles méthodes dans `AdminService`. Frontend Angular — deux nouveaux composants standalone suivant le pattern existant des pages admin (SCSS via `_admin-shared.scss`).

**Tech Stack:** NestJS + Mongoose (backend), Angular 17 standalone components + signals (frontend), SCSS avec mixins partagés.

---

## Cartographie des fichiers

### Backend — modifier
- `backend/src/visits/schemas/visit.schema.ts` — ajouter `paymentMethod`, `clientName`, `visitDate`
- `backend/src/services/schemas/service-config.schema.ts` — ajouter `active: boolean`
- `backend/src/admin/admin.service.ts` — nouvelles méthodes accounting + services CRUD + migration
- `backend/src/admin/admin.controller.ts` — 5 nouveaux endpoints
- `backend/src/appointments/appointments.controller.ts` — filtrer `{ active: true }` sur `GET /appointments/services`

### Backend — créer
- `backend/src/admin/dto/create-manual-visit.dto.ts`
- `backend/src/admin/dto/create-service.dto.ts`

### Frontend — modifier
- `src/app/services/admin.service.ts` — interfaces `Visit` et `ServiceConfig` + nouvelles méthodes
- `src/app/app.routes.ts` — 2 nouvelles routes enfants admin
- `src/app/components/admin/admin.component.html` — 2 nouveaux liens sidebar

### Frontend — créer
- `src/app/services/accounting.service.ts`
- `src/app/components/admin/accounting/accounting.component.ts`
- `src/app/components/admin/accounting/accounting.component.html`
- `src/app/components/admin/accounting/accounting.component.scss`
- `src/app/components/admin/services/services.component.ts`
- `src/app/components/admin/services/services.component.html`
- `src/app/components/admin/services/services.component.scss`

---

## Task 1 — Étendre le schéma Visit (backend)

**Files:**
- Modify: `backend/src/visits/schemas/visit.schema.ts`

- [ ] **Step 1 : Lire le fichier actuel**

```bash
cat backend/src/visits/schemas/visit.schema.ts
```

- [ ] **Step 2 : Ajouter les 3 nouveaux champs**

Remplacer le contenu de `backend/src/visits/schemas/visit.schema.ts` par :

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VisitDocument = Visit & Document;

@Schema({ timestamps: true })
export class Visit {
  @Prop({ required: true })
  clientId: string;

  @Prop({ trim: true })
  clientName?: string;

  @Prop({ required: true, trim: true })
  serviceType: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ enum: ['especes', 'virement', 'en_ligne'], default: 'especes' })
  paymentMethod?: string;

  @Prop({ trim: true })
  visitDate?: string; // YYYY-MM-DD, pour saisie rétroactive manuelle
}

export const VisitSchema = SchemaFactory.createForClass(Visit);
```

> Note : `clientId` reste `required: true` pour les visites enregistrées depuis la fiche client. Les visites manuelles sans compte rempliront `clientId` avec `'walk-in'` et `clientName` avec le nom saisi.

- [ ] **Step 3 : Vérifier que le backend compile**

```bash
cd backend && npm run build 2>&1 | tail -20
```

Attendu : aucune erreur TypeScript.

- [ ] **Step 4 : Commit**

```bash
git add backend/src/visits/schemas/visit.schema.ts
git commit -m "feat(backend): étendre Visit avec paymentMethod, clientName, visitDate"
```

---

## Task 2 — Étendre le schéma ServiceConfig + migration (backend)

**Files:**
- Modify: `backend/src/services/schemas/service-config.schema.ts`
- Modify: `backend/src/admin/admin.service.ts` (section `onModuleInit` uniquement)

- [ ] **Step 1 : Ajouter `active` au schéma ServiceConfig**

Remplacer le contenu de `backend/src/services/schemas/service-config.schema.ts` par :

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ServiceConfigDocument = ServiceConfig & Document;

@Schema()
export class ServiceConfig {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  loyaltyPoints: number;

  @Prop({ default: true })
  active: boolean;
}

export const ServiceConfigSchema = SchemaFactory.createForClass(ServiceConfig);
```

- [ ] **Step 2 : Ajouter la migration dans `onModuleInit` de `AdminService`**

Dans `backend/src/admin/admin.service.ts`, après la boucle `for (const s of DEFAULT_SERVICES)`, ajouter :

```typescript
// Migration : backfiller active: true sur les services déjà seedés
await this.serviceConfigModel.updateMany(
  { active: { $exists: false } },
  { $set: { active: true } },
);
```

- [ ] **Step 3 : Vérifier la compilation**

```bash
cd backend && npm run build 2>&1 | tail -20
```

- [ ] **Step 4 : Commit**

```bash
git add backend/src/services/schemas/service-config.schema.ts backend/src/admin/admin.service.ts
git commit -m "feat(backend): ajouter active à ServiceConfig + migration onModuleInit"
```

---

## Task 3 — Créer les DTOs (backend)

**Files:**
- Create: `backend/src/admin/dto/create-manual-visit.dto.ts`
- Create: `backend/src/admin/dto/create-service.dto.ts`

- [ ] **Step 1 : Créer `create-manual-visit.dto.ts`**

```typescript
// backend/src/admin/dto/create-manual-visit.dto.ts
import {
  IsString, IsNotEmpty, IsNumber, IsOptional,
  IsIn, IsDateString, Min,
} from 'class-validator';

export class CreateManualVisitDto {
  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsNotEmpty()
  serviceType: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  @IsIn(['especes', 'virement', 'en_ligne'])
  paymentMethod?: string;

  @IsDateString()
  @IsOptional()
  visitDate?: string;
}
```

- [ ] **Step 2 : Créer `create-service.dto.ts`**

```typescript
// backend/src/admin/dto/create-service.dto.ts
import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  loyaltyPoints?: number;
}
```

- [ ] **Step 3 : Vérifier la compilation**

```bash
cd backend && npm run build 2>&1 | tail -20
```

- [ ] **Step 4 : Commit**

```bash
git add backend/src/admin/dto/create-manual-visit.dto.ts backend/src/admin/dto/create-service.dto.ts
git commit -m "feat(backend): créer DTOs CreateManualVisitDto et CreateServiceDto"
```

---

## Task 4 — Nouvelles méthodes AdminService : Comptabilité (backend)

**Files:**
- Modify: `backend/src/admin/admin.service.ts`

- [ ] **Step 1 : Ajouter les imports nécessaires**

En haut de `backend/src/admin/admin.service.ts`, ajouter à la liste des imports :

```typescript
import { CreateManualVisitDto } from './dto/create-manual-visit.dto';
```

- [ ] **Step 2 : Ajouter les 3 méthodes de comptabilité à `AdminService`**

Ajouter en fin de classe (avant la dernière accolade) :

```typescript
// ── Comptabilité ──────────────────────────────────────────────────────────────

async getAccounting(period: string, date: string) {
  const { start, end } = this.parsePeriod(period, date);

  // Filtre qui utilise visitDate si présent, sinon createdAt
  const dateFilter = {
    $or: [
      { visitDate: { $gte: start.toISOString().slice(0, 10), $lte: end.toISOString().slice(0, 10) } },
      { visitDate: { $exists: false }, createdAt: { $gte: start, $lte: end } },
    ],
  };

  const [visits, byService, byPayment, totalVisits] = await Promise.all([
    this.visitModel.find(dateFilter).sort({ createdAt: -1 }).limit(500),
    this.visitModel.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$serviceType', total: { $sum: '$price' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    this.visitModel.aggregate([
      { $match: dateFilter },
      { $group: { _id: { $ifNull: ['$paymentMethod', 'especes'] }, total: { $sum: '$price' }, count: { $sum: 1 } } },
    ]),
    this.visitModel.countDocuments(dateFilter),
  ]);

  const totalRevenue = visits.reduce((sum, v) => sum + v.price, 0);

  // KPIs constants : trimestre et année en cours
  const now = new Date();
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const yStart = new Date(now.getFullYear(), 0, 1);

  const [revQuarter, revYear] = await Promise.all([
    this.visitModel.aggregate([{ $match: { createdAt: { $gte: qStart } } }, { $group: { _id: null, t: { $sum: '$price' } } }]),
    this.visitModel.aggregate([{ $match: { createdAt: { $gte: yStart } } }, { $group: { _id: null, t: { $sum: '$price' } } }]),
  ]);

  return {
    kpis: {
      revenue: totalRevenue,
      visits: totalVisits,
      quarter: revQuarter[0]?.t ?? 0,
      year: revYear[0]?.t ?? 0,
    },
    byService,
    byPayment,
    visits,
  };
}

async createManualVisit(dto: CreateManualVisitDto) {
  const visitData = {
    clientId: dto.clientId ?? 'walk-in',
    clientName: dto.clientName,
    serviceType: dto.serviceType,
    price: dto.price,
    paymentMethod: dto.paymentMethod ?? 'especes',
    visitDate: dto.visitDate,
  };
  const visit = await this.visitModel.create(visitData);
  if (dto.clientId && dto.clientId !== 'walk-in') {
    const config = await this.serviceConfigModel.findOne({ name: dto.serviceType });
    const points = config?.loyaltyPoints ?? LOYALTY_POINTS_PER_VISIT;
    await this.usersService.recordVisit(dto.clientId, points);
  }
  return visit;
}

async deleteVisit(id: string) {
  return this.visitModel.findByIdAndDelete(id);
}

private parsePeriod(period: string, date: string): { start: Date; end: Date } {
  if (period === 'month') {
    const [y, m] = date.split('-').map(Number);
    return {
      start: new Date(y, m - 1, 1),
      end: new Date(y, m, 0, 23, 59, 59),
    };
  }
  if (period === 'quarter') {
    // date format: YYYY-QN (ex: 2026-Q1)
    const [y, q] = date.split('-');
    const qNum = parseInt(q.replace('Q', '')) - 1;
    const startMonth = qNum * 3;
    return {
      start: new Date(parseInt(y), startMonth, 1),
      end: new Date(parseInt(y), startMonth + 3, 0, 23, 59, 59),
    };
  }
  // year
  const y = parseInt(date);
  return {
    start: new Date(y, 0, 1),
    end: new Date(y, 11, 31, 23, 59, 59),
  };
}

// ── Gestion des prestations ───────────────────────────────────────────────────

async createService(dto: { name: string; price: number; loyaltyPoints?: number }) {
  return this.serviceConfigModel.create({
    name: dto.name,
    price: dto.price,
    loyaltyPoints: dto.loyaltyPoints ?? 0,
    active: true,
  });
}

async toggleService(id: string) {
  const svc = await this.serviceConfigModel.findById(id);
  if (!svc) return null;
  svc.active = !svc.active;
  return svc.save();
}

async getAllServiceConfigs() {
  return this.serviceConfigModel.find().sort({ name: 1 });
}
```

- [ ] **Step 3 : Vérifier la compilation**

```bash
cd backend && npm run build 2>&1 | tail -30
```

Attendu : aucune erreur TypeScript.

- [ ] **Step 4 : Commit**

```bash
git add backend/src/admin/admin.service.ts
git commit -m "feat(backend): méthodes comptabilité et gestion prestations dans AdminService"
```

---

## Task 5 — Nouveaux endpoints AdminController (backend)

**Files:**
- Modify: `backend/src/admin/admin.controller.ts`

- [ ] **Step 1 : Ajouter les imports dans `admin.controller.ts`**

Ajouter aux imports existants :

```typescript
import { Delete } from '@nestjs/common';
import { CreateManualVisitDto } from './dto/create-manual-visit.dto';
import { CreateServiceDto } from './dto/create-service.dto';
```

- [ ] **Step 2 : Ajouter les 5 nouveaux endpoints**

À la fin du controller (avant la dernière accolade), ajouter :

```typescript
// ── Comptabilité ─────────────────────────────────────────────────────────────

@Get('accounting')
getAccounting(
  @Query('period') period: string = 'month',
  @Query('date') date: string,
) {
  const resolvedDate = date ?? new Date().toISOString().slice(0, 7);
  return this.adminService.getAccounting(period, resolvedDate);
}

@Post('accounting/visits')
createManualVisit(@Body() dto: CreateManualVisitDto) {
  return this.adminService.createManualVisit(dto);
}

@Delete('accounting/visits/:id')
deleteVisit(@Param('id') id: string) {
  return this.adminService.deleteVisit(id);
}

// ── Gestion des prestations ───────────────────────────────────────────────────

@Post('services')
createService(@Body() dto: CreateServiceDto) {
  return this.adminService.createService(dto);
}

@Patch('services/:id/toggle')
toggleService(@Param('id') id: string) {
  return this.adminService.toggleService(id);
}
```

- [ ] **Step 3 : Mettre à jour `GET /admin/services` pour retourner tout (actif + inactif)**

L'endpoint existant `getServiceConfigs()` appelle `adminService.getServiceConfigs()` qui retourne tout sans filtre — c'est déjà correct. Remplacer l'appel par `getAllServiceConfigs()` pour clarté si la méthode a été renommée, sinon laisser tel quel.

- [ ] **Step 4 : Vérifier la compilation**

```bash
cd backend && npm run build 2>&1 | tail -30
```

- [ ] **Step 5 : Tester manuellement les endpoints**

Démarrer le backend : `cd backend && npm run start:dev`

```bash
# Test accounting (doit retourner kpis, byService, byPayment, visits)
curl -H "Authorization: Bearer <JWT_ADMIN>" \
  "http://localhost:3000/api/admin/accounting?period=month&date=2026-03"

# Test create service
curl -X POST -H "Authorization: Bearer <JWT_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test service","price":25,"loyaltyPoints":12}' \
  "http://localhost:3000/api/admin/services"

# Test toggle service (utiliser l'ID retourné ci-dessus)
curl -X PATCH -H "Authorization: Bearer <JWT_ADMIN>" \
  "http://localhost:3000/api/admin/services/<ID>/toggle"
```

- [ ] **Step 6 : Commit**

```bash
git add backend/src/admin/admin.controller.ts
git commit -m "feat(backend): endpoints comptabilité et gestion prestations dans AdminController"
```

---

## Task 6 — Filtrer les services actifs dans AppointmentsController (backend)

**Files:**
- Modify: `backend/src/appointments/appointments.controller.ts`

- [ ] **Step 1 : Modifier `GET /appointments/services` pour filtrer `active: true`**

Dans `appointments.controller.ts`, à la méthode `getServices()` (ligne ~28), remplacer :

```typescript
// AVANT
return this.serviceConfigModel.find().sort({ name: 1 });

// APRÈS
return this.serviceConfigModel.find({ active: true }).sort({ name: 1 });
```

- [ ] **Step 2 : Vérifier que le booking ne montre plus les services désactivés**

```bash
curl "http://localhost:3000/api/appointments/services"
# Doit retourner uniquement les services avec active: true
```

- [ ] **Step 3 : Commit**

```bash
git add backend/src/appointments/appointments.controller.ts
git commit -m "feat(backend): filtrer active:true sur l'endpoint public des services"
```

---

## Task 7 — Mettre à jour admin.service.ts Angular (frontend)

**Files:**
- Modify: `src/app/services/admin.service.ts`

- [ ] **Step 1 : Mettre à jour l'interface `Visit`**

Dans `src/app/services/admin.service.ts`, remplacer l'interface `Visit` (lignes 8–15) par :

```typescript
export interface Visit {
  _id: string;
  clientId: string;
  clientName?: string;
  serviceType: string;
  price: number;
  notes?: string;
  paymentMethod?: string;
  visitDate?: string;
  createdAt: string;
}
```

- [ ] **Step 2 : Mettre à jour l'interface `ServiceConfig`**

Remplacer l'interface `ServiceConfig` (lignes 17–22) par :

```typescript
export interface ServiceConfig {
  _id: string;
  name: string;
  price: number;
  loyaltyPoints: number;
  active: boolean;
}
```

- [ ] **Step 3 : Mettre à jour `updateServiceConfig()` pour envoyer `price` aussi**

Remplacer la méthode existante :

```typescript
// AVANT
updateServiceConfig(id: string, loyaltyPoints: number): Observable<ServiceConfig> {
  return this.http.patch<ServiceConfig>(`${API}/services/${id}`, { loyaltyPoints });
}

// APRÈS
updateServiceConfig(id: string, data: Partial<Pick<ServiceConfig, 'price' | 'loyaltyPoints'>>): Observable<ServiceConfig> {
  return this.http.patch<ServiceConfig>(`${API}/services/${id}`, data);
}
```

- [ ] **Step 4 : Vérifier la compilation Angular**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

- [ ] **Step 5 : Commit**

```bash
git add src/app/services/admin.service.ts
git commit -m "feat(frontend): mettre à jour interfaces Visit et ServiceConfig dans admin.service.ts"
```

---

## Task 8 — Créer AccountingService Angular (frontend)

**Files:**
- Create: `src/app/services/accounting.service.ts`

- [ ] **Step 1 : Créer le fichier**

```typescript
// src/app/services/accounting.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Visit } from './admin.service';

const API = 'http://localhost:3000/api/admin';

export interface AccountingData {
  kpis: { revenue: number; visits: number; quarter: number; year: number };
  byService: { _id: string; total: number; count: number }[];
  byPayment: { _id: string; total: number; count: number }[];
  visits: Visit[];
}

export interface ManualVisitDto {
  clientId?: string;
  clientName?: string;
  serviceType: string;
  price: number;
  paymentMethod?: string;
  visitDate?: string;
}

@Injectable({ providedIn: 'root' })
export class AccountingService {
  constructor(private http: HttpClient) {}

  getAccounting(period: string, date: string): Observable<AccountingData> {
    const params = new HttpParams().set('period', period).set('date', date);
    return this.http.get<AccountingData>(`${API}/accounting`, { params });
  }

  createManualVisit(dto: ManualVisitDto): Observable<Visit> {
    return this.http.post<Visit>(`${API}/accounting/visits`, dto);
  }

  deleteVisit(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/accounting/visits/${id}`);
  }
}
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

- [ ] **Step 3 : Commit**

```bash
git add src/app/services/accounting.service.ts
git commit -m "feat(frontend): créer AccountingService"
```

---

## Task 9 — Composant Comptabilité : TS + HTML + SCSS (frontend)

**Files:**
- Create: `src/app/components/admin/accounting/accounting.component.ts`
- Create: `src/app/components/admin/accounting/accounting.component.html`
- Create: `src/app/components/admin/accounting/accounting.component.scss`

- [ ] **Step 1 : Créer `accounting.component.ts`**

```typescript
// src/app/components/admin/accounting/accounting.component.ts
import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingService, AccountingData, ManualVisitDto } from '../../../services/accounting.service';
import { AdminService, ServiceConfig } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-accounting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './accounting.component.html',
  styleUrl: './accounting.component.scss',
})
export class AdminAccountingComponent implements OnInit {
  period = signal<'month' | 'quarter' | 'year'>('month');
  selectedDate = signal(new Date().toISOString().slice(0, 7)); // YYYY-MM pour month

  data = signal<AccountingData | null>(null);
  loading = signal(true);
  services = signal<ServiceConfig[]>([]);

  // Modal ajout visite
  showAddModal = signal(false);
  addForm: ManualVisitDto = { serviceType: '', price: 0, paymentMethod: 'especes' };
  saving = signal(false);

  // Label période courante
  periodLabel = computed(() => {
    const d = this.selectedDate();
    if (this.period() === 'month') {
      const [y, m] = d.split('-');
      return new Date(+y, +m - 1, 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    }
    if (this.period() === 'quarter') return d.replace('Q', 'T');
    return d;
  });

  quarterOptions = computed(() => {
    const y = new Date().getFullYear();
    return [`${y}-Q1`, `${y}-Q2`, `${y}-Q3`, `${y}-Q4`];
  });

  yearOptions = [
    new Date().getFullYear().toString(),
    (new Date().getFullYear() - 1).toString(),
  ];

  constructor(
    private accounting: AccountingService,
    private adminService: AdminService,
  ) {}

  ngOnInit() {
    this.load();
    this.adminService.getServiceConfigs().subscribe(s => this.services.set(s));
  }

  load() {
    this.loading.set(true);
    this.accounting.getAccounting(this.period(), this.selectedDate()).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  setPeriod(p: 'month' | 'quarter' | 'year') {
    this.period.set(p);
    if (p === 'month') this.selectedDate.set(new Date().toISOString().slice(0, 7));
    if (p === 'quarter') this.selectedDate.set(`${new Date().getFullYear()}-Q1`);
    if (p === 'year') this.selectedDate.set(new Date().getFullYear().toString());
    this.load();
  }

  maxBarAmount = computed(() => {
    const d = this.data();
    if (!d || !d.byService.length) return 1;
    return Math.max(...d.byService.map(s => s.total));
  });

  barWidth(amount: number): string {
    return Math.round((amount / this.maxBarAmount()) * 100) + '%';
  }

  totalPayments = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return d.byPayment.reduce((s, p) => s + p.total, 0);
  });

  paymentLabel(id: string): string {
    return { especes: 'Espèces', virement: 'Virement', 'en_ligne': 'En ligne' }[id] ?? id;
  }

  formatDate(visit: any): string {
    const raw = visit.visitDate ?? visit.createdAt;
    return new Date(raw).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  openAddModal() {
    this.addForm = { serviceType: '', price: 0, paymentMethod: 'especes' };
    this.showAddModal.set(true);
  }

  saveVisit() {
    if (!this.addForm.serviceType || this.addForm.price <= 0) return;
    this.saving.set(true);
    this.accounting.createManualVisit(this.addForm).subscribe({
      next: () => { this.showAddModal.set(false); this.saving.set(false); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  deleteVisit(id: string) {
    if (!confirm('Supprimer cette visite ?')) return;
    this.accounting.deleteVisit(id).subscribe(() => this.load());
  }

  exportCsv() {
    const visits = this.data()?.visits ?? [];
    const lines = [
      ['Date', 'Client', 'Prestation', 'Paiement', 'Montant (€)'].join(';'),
      ...visits.map(v => [
        this.formatDate(v),
        v.clientName ?? v.clientId,
        v.serviceType,
        this.paymentLabel(v.paymentMethod ?? 'especes'),
        v.price.toString().replace('.', ','),
      ].join(';')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `revenus-${this.selectedDate()}.csv`;
    a.click();
  }

  printPdf() {
    window.print();
  }
}
```

- [ ] **Step 2 : Créer `accounting.component.html`**

```html
<!-- src/app/components/admin/accounting/accounting.component.html -->
<div class="acct">

  <!-- En-tête -->
  <div class="acct__header">
    <div>
      <h1 class="acct__title">Comptabilité</h1>
      <p class="acct__subtitle">Revenus &amp; exports — {{ periodLabel() }}</p>
    </div>
    <div class="acct__header-actions no-print">
      <button class="acct__btn-csv" (click)="exportCsv()">⬇ CSV</button>
      <button class="acct__btn-pdf" (click)="printPdf()">⬇ PDF</button>
    </div>
  </div>

  <!-- Filtre période -->
  <div class="acct__filters no-print">
    <div class="acct__period-toggle">
      <button [class.active]="period() === 'month'" (click)="setPeriod('month')">Mois</button>
      <button [class.active]="period() === 'quarter'" (click)="setPeriod('quarter')">Trimestre</button>
      <button [class.active]="period() === 'year'" (click)="setPeriod('year')">Année</button>
    </div>

    @if (period() === 'month') {
      <input type="month" class="acct__date-input" [value]="selectedDate()"
        (change)="selectedDate.set($any($event.target).value); load()" />
    }
    @if (period() === 'quarter') {
      <select class="acct__date-input" [value]="selectedDate()"
        (change)="selectedDate.set($any($event.target).value); load()">
        @for (q of quarterOptions(); track q) {
          <option [value]="q">{{ q.replace('Q','T') }}</option>
        }
      </select>
    }
    @if (period() === 'year') {
      <select class="acct__date-input" [value]="selectedDate()"
        (change)="selectedDate.set($any($event.target).value); load()">
        @for (y of yearOptions; track y) {
          <option [value]="y">{{ y }}</option>
        }
      </select>
    }
  </div>

  @if (loading()) {
    <div class="acct__loading">Chargement...</div>
  } @else if (data()) {

    <!-- KPIs -->
    <div class="acct__kpis">
      <div class="acct__kpi">
        <span class="acct__kpi-label">{{ period() === 'month' ? 'Ce mois' : period() === 'quarter' ? 'Ce trimestre' : 'Cette année' }}</span>
        <span class="acct__kpi-value">{{ data()!.kpis.revenue | number:'1.0-0' }} €</span>
        <span class="acct__kpi-sub">{{ data()!.kpis.visits }} visite{{ data()!.kpis.visits > 1 ? 's' : '' }}</span>
      </div>
      <div class="acct__kpi">
        <span class="acct__kpi-label">Trimestre en cours</span>
        <span class="acct__kpi-value">{{ data()!.kpis.quarter | number:'1.0-0' }} €</span>
      </div>
      <div class="acct__kpi">
        <span class="acct__kpi-label">Année en cours</span>
        <span class="acct__kpi-value">{{ data()!.kpis.year | number:'1.0-0' }} €</span>
      </div>
      <div class="acct__kpi">
        <span class="acct__kpi-label">Nb visites</span>
        <span class="acct__kpi-value">{{ data()!.kpis.visits }}</span>
      </div>
    </div>

    <!-- Breakdowns -->
    <div class="acct__breakdowns">

      <!-- Par prestation -->
      <div class="acct__card">
        <div class="acct__card-title">Revenus par prestation</div>
        @for (s of data()!.byService; track s._id) {
          <div class="acct__service-row">
            <div class="acct__service-info">
              <span class="acct__service-name">{{ s._id }}</span>
              <span class="acct__service-amount">{{ s.total | number:'1.0-0' }} €</span>
            </div>
            <div class="acct__bar-track">
              <div class="acct__bar-fill" [style.width]="barWidth(s.total)"></div>
            </div>
          </div>
        }
        @if (!data()!.byService.length) {
          <p class="acct__empty">Aucune visite sur cette période.</p>
        }
      </div>

      <!-- Par paiement -->
      <div class="acct__card">
        <div class="acct__card-title">Par mode de paiement</div>
        @for (p of data()!.byPayment; track p._id) {
          <div class="acct__payment-row">
            <div class="acct__payment-dot"></div>
            <span class="acct__payment-label">{{ paymentLabel(p._id) }}</span>
            <span class="acct__payment-amount">{{ p.total | number:'1.0-0' }} €</span>
            <span class="acct__payment-pct">{{ totalPayments() > 0 ? ((p.total / totalPayments()) * 100 | number:'1.0-0') : 0 }}%</span>
          </div>
        }
      </div>
    </div>

    <!-- Historique visites -->
    <div class="acct__card acct__visits-card">
      <div class="acct__visits-header">
        <div class="acct__card-title">Historique des visites</div>
        <button class="acct__btn-add no-print" (click)="openAddModal()">+ Ajouter une visite</button>
      </div>

      <table class="acct__table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Client</th>
            <th>Prestation</th>
            <th>Paiement</th>
            <th class="acct__col-amount">Montant</th>
            <th class="no-print"></th>
          </tr>
        </thead>
        <tbody>
          @for (v of data()!.visits; track v._id) {
            <tr>
              <td>{{ formatDate(v) }}</td>
              <td>{{ v.clientName ?? (v.clientId === 'walk-in' ? 'Client anonyme' : v.clientId) }}</td>
              <td>{{ v.serviceType }}</td>
              <td><span class="acct__badge">{{ paymentLabel(v.paymentMethod ?? 'especes') }}</span></td>
              <td class="acct__col-amount acct__amount">{{ v.price }} €</td>
              <td class="no-print">
                <button class="acct__btn-delete" (click)="deleteVisit(v._id)">Supprimer</button>
              </td>
            </tr>
          }
          @if (!data()!.visits.length) {
            <tr><td colspan="6" class="acct__empty">Aucune visite.</td></tr>
          }
        </tbody>
      </table>
    </div>

  }

  <!-- Modal ajout visite -->
  @if (showAddModal()) {
    <div class="acct__modal-overlay no-print" (click)="showAddModal.set(false)">
      <div class="acct__modal" (click)="$event.stopPropagation()">
        <div class="acct__modal-title">Ajouter une visite</div>

        <label class="acct__label">
          Prestation
          <select class="acct__input" [(ngModel)]="addForm.serviceType"
            (change)="addForm.price = services().find(s => s.name === addForm.serviceType)?.price ?? addForm.price">
            <option value="">— Choisir —</option>
            @for (s of services(); track s._id) {
              <option [value]="s.name">{{ s.name }} ({{ s.price }} €)</option>
            }
          </select>
        </label>

        <label class="acct__label">
          Prix (€)
          <input type="number" class="acct__input" [(ngModel)]="addForm.price" min="0" step="0.5" />
        </label>

        <label class="acct__label">
          Mode de paiement
          <select class="acct__input" [(ngModel)]="addForm.paymentMethod">
            <option value="especes">Espèces</option>
            <option value="virement">Virement</option>
            <option value="en_ligne">En ligne</option>
          </select>
        </label>

        <label class="acct__label">
          Nom du client (optionnel)
          <input type="text" class="acct__input" [(ngModel)]="addForm.clientName" placeholder="ex : Karim B." />
        </label>

        <label class="acct__label">
          Date (optionnel — défaut : aujourd'hui)
          <input type="date" class="acct__input" [(ngModel)]="addForm.visitDate" />
        </label>

        <div class="acct__modal-actions">
          <button class="acct__btn-save" (click)="saveVisit()" [disabled]="saving()">
            {{ saving() ? 'Enregistrement...' : 'Enregistrer' }}
          </button>
          <button class="acct__btn-cancel" (click)="showAddModal.set(false)">Annuler</button>
        </div>
      </div>
    </div>
  }

</div>
```

- [ ] **Step 3 : Créer `accounting.component.scss`**

```scss
// src/app/components/admin/accounting/accounting.component.scss
@use '../admin-shared' as *;

.acct {
  @include page-padding;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  &__title  { @include page-title; }

  &__subtitle {
    font-size: .75rem;
    color: rgba(255,255,255,.3);
    letter-spacing: .08em;
    margin: .3rem 0 0;
  }

  &__header-actions {
    display: flex;
    gap: .75rem;
  }

  &__btn-csv {
    @include btn-ghost;
    padding: .45rem 1rem;
  }

  &__btn-pdf {
    @include btn-primary;
    padding: .45rem 1rem;
  }

  // Filtres
  &__filters {
    display: flex;
    gap: .75rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    align-items: center;
  }

  &__period-toggle {
    display: flex;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 6px;
    overflow: hidden;

    button {
      background: none;
      border: none;
      border-right: 1px solid rgba(255,255,255,.08);
      color: rgba(255,255,255,.45);
      padding: .4rem .875rem;
      font-size: .78rem;
      font-family: 'Outfit', sans-serif;
      cursor: pointer;
      transition: all .2s;

      &:last-child { border-right: none; }

      &.active {
        background: rgba(201,164,74,.12);
        color: #C9A44A;
      }

      &:hover:not(.active) { color: rgba(255,255,255,.7); }
    }
  }

  &__date-input {
    background: #161616;
    border: 1px solid rgba(255,255,255,.12);
    color: rgba(255,255,255,.7);
    padding: .4rem .75rem;
    border-radius: 6px;
    font-size: .78rem;
    font-family: 'Outfit', sans-serif;
    outline: none;
    color-scheme: dark;
  }

  &__loading { @include loading; }

  // KPIs
  &__kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;

    @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
    @media (max-width: 480px) { grid-template-columns: 1fr; }
  }

  &__kpi {
    @include card;
    display: flex;
    flex-direction: column;
    gap: .25rem;

    &-label {
      font-size: .6rem;
      color: rgba(255,255,255,.3);
      text-transform: uppercase;
      letter-spacing: .15em;
    }

    &-value {
      font-size: 1.5rem;
      color: #fff;
      font-weight: 300;
      font-family: 'Cormorant Garamond', serif;
    }

    &-sub {
      font-size: .72rem;
      color: rgba(255,255,255,.35);
    }
  }

  // Breakdowns
  &__breakdowns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.25rem;

    @media (max-width: 768px) { grid-template-columns: 1fr; }
  }

  &__card {
    @include card;
    margin-bottom: 1.25rem;

    &-title {
      font-size: .6rem;
      color: rgba(255,255,255,.3);
      text-transform: uppercase;
      letter-spacing: .15em;
      margin: 0 0 1rem;
    }
  }

  // Par prestation
  &__service-row { margin-bottom: .75rem; }

  &__service-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: .25rem;
  }

  &__service-name { font-size: .82rem; color: rgba(255,255,255,.7); }

  &__service-amount { font-size: .82rem; color: #C9A44A; font-weight: 500; }

  &__bar-track {
    height: 4px;
    background: rgba(255,255,255,.06);
    border-radius: 2px;
  }

  &__bar-fill {
    height: 100%;
    background: #C9A44A;
    border-radius: 2px;
    transition: width .3s;
  }

  // Par paiement
  &__payment-row {
    display: flex;
    align-items: center;
    gap: .6rem;
    margin-bottom: .6rem;
  }

  &__payment-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #C9A44A;
    flex-shrink: 0;
  }

  &__payment-label { font-size: .82rem; color: rgba(255,255,255,.7); flex: 1; }

  &__payment-amount { font-size: .82rem; color: #fff; }

  &__payment-pct { font-size: .75rem; color: rgba(255,255,255,.3); min-width: 2.5rem; text-align: right; }

  // Visites
  &__visits-card { margin-bottom: 0; }

  &__visits-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  &__btn-add { @include btn-primary; }

  &__table { @include table; }

  &__col-amount { text-align: right; }

  &__amount { color: #C9A44A !important; font-weight: 500; }

  &__badge {
    font-size: .72rem;
    background: rgba(255,255,255,.06);
    color: rgba(255,255,255,.5);
    padding: .15rem .5rem;
    border-radius: 4px;
  }

  &__btn-delete { @include btn-danger; padding: .15rem .5rem; font-size: .72rem; border-radius: 4px; }

  &__empty { font-size: .82rem; color: rgba(255,255,255,.3); }

  // Modal
  &__modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.65);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  &__modal {
    background: #161616;
    border: 1px solid rgba(201,164,74,.15);
    border-radius: 12px;
    padding: 1.75rem;
    width: 100%;
    max-width: 440px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__modal-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.3rem;
    color: #fff;
    font-weight: 400;
    margin: 0;
  }

  &__label {
    display: flex;
    flex-direction: column;
    gap: .35rem;
    font-size: .78rem;
    color: rgba(255,255,255,.5);
  }

  &__input {
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 6px;
    color: #fff;
    padding: .45rem .75rem;
    font-size: .82rem;
    font-family: 'Outfit', sans-serif;
    outline: none;
    transition: border-color .2s;
    color-scheme: dark;

    &:focus { border-color: rgba(201,164,74,.5); }
  }

  &__modal-actions {
    display: flex;
    gap: .75rem;
    margin-top: .25rem;
  }

  &__btn-save { @include btn-primary; padding: .5rem 1.2rem; }

  &__btn-cancel { @include btn-ghost; }

  // Print
  @media print {
    .no-print { display: none !important; }

    background: #fff;
    color: #000;

    &__kpi-value, &__amount, &__service-amount { color: #000 !important; }

    &__table th, &__table td { color: #000 !important; border-color: #ddd !important; }
  }
}
```

- [ ] **Step 4 : Vérifier la compilation**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

- [ ] **Step 5 : Commit**

```bash
git add src/app/components/admin/accounting/
git commit -m "feat(frontend): composant AdminAccounting (comptabilité)"
```

---

## Task 10 — Composant Prestations : TS + HTML + SCSS (frontend)

**Files:**
- Create: `src/app/components/admin/services/services.component.ts`
- Create: `src/app/components/admin/services/services.component.html`
- Create: `src/app/components/admin/services/services.component.scss`

- [ ] **Step 1 : Créer `services.component.ts`**

```typescript
// src/app/components/admin/services/services.component.ts
import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, ServiceConfig } from '../../../services/admin.service';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:3000/api/admin';

@Component({
  selector: 'app-admin-services',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class AdminServicesComponent implements OnInit {
  services = signal<ServiceConfig[]>([]);
  loading = signal(true);
  showInactive = signal(false);

  // Modal
  showModal = signal(false);
  editingId = signal<string | null>(null);
  form = { name: '', price: 0, loyaltyPoints: 0 };
  saving = signal(false);
  saved = signal(false);

  active = computed(() => this.services().filter(s => s.active));
  inactive = computed(() => this.services().filter(s => !s.active));

  constructor(private adminService: AdminService, private http: HttpClient) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.adminService.getServiceConfigs().subscribe({
      next: s => { this.services.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openAdd() {
    this.editingId.set(null);
    this.form = { name: '', price: 0, loyaltyPoints: 0 };
    this.showModal.set(true);
  }

  openEdit(s: ServiceConfig) {
    this.editingId.set(s._id);
    this.form = { name: s.name, price: s.price, loyaltyPoints: s.loyaltyPoints };
    this.showModal.set(true);
  }

  save() {
    if (!this.form.name || this.form.price <= 0) return;
    this.saving.set(true);
    const id = this.editingId();
    const obs = id
      ? this.adminService.updateServiceConfig(id, { price: this.form.price, loyaltyPoints: this.form.loyaltyPoints })
      : this.http.post<ServiceConfig>(`${API}/services`, this.form);

    obs.subscribe({
      next: () => {
        this.showModal.set(false);
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2000);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  toggle(s: ServiceConfig) {
    const label = s.active ? 'Désactiver' : 'Réactiver';
    if (!confirm(`${label} la prestation "${s.name}" ?`)) return;
    this.http.patch(`${API}/services/${s._id}/toggle`, {}).subscribe(() => this.load());
  }
}
```

- [ ] **Step 2 : Créer `services.component.html`**

```html
<!-- src/app/components/admin/services/services.component.html -->
<div class="svc">

  <div class="svc__header">
    <div>
      <h1 class="svc__title">Prestations</h1>
    </div>
    <div class="svc__header-actions">
      @if (saved()) { <span class="svc__saved">Enregistré ✓</span> }
      <button class="svc__btn-add" (click)="openAdd()">+ Ajouter une prestation</button>
    </div>
  </div>

  @if (loading()) {
    <div class="svc__loading">Chargement...</div>
  } @else {

    <!-- Prestations actives -->
    <div class="svc__card">
      <div class="svc__card-title">Prestations actives</div>
      <table class="svc__table">
        <thead>
          <tr>
            <th>Nom</th>
            <th class="svc__col-center">Prix</th>
            <th class="svc__col-center">Points fidélité</th>
            <th class="svc__col-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (s of active(); track s._id) {
            <tr>
              <td>{{ s.name }}</td>
              <td class="svc__col-center svc__price">{{ s.price }} €</td>
              <td class="svc__col-center svc__pts">{{ s.loyaltyPoints }} pts</td>
              <td class="svc__col-right">
                <div class="svc__actions">
                  <button class="svc__btn-edit" (click)="openEdit(s)">Modifier</button>
                  <button class="svc__btn-deactivate" (click)="toggle(s)">Désactiver</button>
                </div>
              </td>
            </tr>
          }
          @if (!active().length) {
            <tr><td colspan="4" class="svc__empty">Aucune prestation active.</td></tr>
          }
        </tbody>
      </table>
    </div>

    <!-- Prestations désactivées -->
    @if (inactive().length) {
      <div class="svc__card svc__card--inactive">
        <button class="svc__inactive-toggle" (click)="showInactive.set(!showInactive())">
          <span class="svc__card-title">Prestations désactivées ({{ inactive().length }})</span>
          <span>{{ showInactive() ? '▴ Masquer' : '▾ Afficher' }}</span>
        </button>

        @if (showInactive()) {
          <ul class="svc__inactive-list">
            @for (s of inactive(); track s._id) {
              <li class="svc__inactive-item">
                <span class="svc__inactive-name">{{ s.name }}</span>
                <span class="svc__inactive-price">{{ s.price }} €</span>
                <button class="svc__btn-reactivate" (click)="toggle(s)">Réactiver</button>
              </li>
            }
          </ul>
        }
      </div>
    }

  }

  <!-- Modal -->
  @if (showModal()) {
    <div class="svc__modal-overlay" (click)="showModal.set(false)">
      <div class="svc__modal" (click)="$event.stopPropagation()">
        <div class="svc__modal-title">{{ editingId() ? 'Modifier la prestation' : 'Nouvelle prestation' }}</div>

        @if (!editingId()) {
          <label class="svc__label">
            Nom de la prestation
            <input type="text" class="svc__input" [(ngModel)]="form.name" placeholder="ex : Coupe enfant" />
          </label>
        }

        <label class="svc__label">
          Prix (€)
          <input type="number" class="svc__input" [(ngModel)]="form.price" min="0" step="0.5" />
        </label>

        <label class="svc__label">
          Points fidélité
          <input type="number" class="svc__input" [(ngModel)]="form.loyaltyPoints" min="0" />
        </label>

        <div class="svc__modal-actions">
          <button class="svc__btn-save" (click)="save()" [disabled]="saving()">
            {{ saving() ? 'Enregistrement...' : 'Enregistrer' }}
          </button>
          <button class="svc__btn-cancel" (click)="showModal.set(false)">Annuler</button>
        </div>
      </div>
    </div>
  }

</div>
```

- [ ] **Step 3 : Créer `services.component.scss`**

```scss
// src/app/components/admin/services/services.component.scss
@use '../admin-shared' as *;

.svc {
  @include page-padding;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  &__title { @include page-title; }

  &__header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  &__btn-add { @include btn-primary; }

  &__saved { font-size: .82rem; color: #4ade80; font-weight: 600; }

  &__loading { @include loading; }

  &__card {
    @include card;
    margin-bottom: 1.25rem;

    &-title {
      font-size: .6rem;
      color: rgba(255,255,255,.3);
      text-transform: uppercase;
      letter-spacing: .15em;
      margin: 0 0 1rem;
    }

    &--inactive {
      border-color: rgba(255,255,255,.06);
      background: rgba(255,255,255,.01);
    }
  }

  &__table { @include table; }

  &__col-center { text-align: center; }
  &__col-right  { text-align: right; }

  &__price { color: #C9A44A !important; font-weight: 500; }
  &__pts   { color: rgba(255,255,255,.4) !important; }

  &__actions { display: inline-flex; gap: .4rem; }

  &__btn-edit       { @include btn-ghost;   padding: .25rem .6rem; font-size: .75rem; }
  &__btn-deactivate { @include btn-danger;  padding: .25rem .6rem; font-size: .75rem; }

  &__empty { font-size: .82rem; color: rgba(255,255,255,.3); }

  // Désactivées
  &__inactive-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    color: rgba(255,255,255,.3);
    font-size: .78rem;
    font-family: 'Outfit', sans-serif;

    .svc__card-title { margin: 0; }
  }

  &__inactive-list {
    list-style: none;
    margin: .75rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: .4rem;
  }

  &__inactive-item {
    display: flex;
    align-items: center;
    gap: .75rem;
    padding: .4rem .6rem;
    background: rgba(255,255,255,.02);
    border-radius: 6px;
    opacity: .6;
  }

  &__inactive-name {
    flex: 1;
    font-size: .82rem;
    color: rgba(255,255,255,.5);
    text-decoration: line-through;
  }

  &__inactive-price { font-size: .78rem; color: rgba(255,255,255,.3); }

  &__btn-reactivate { @include btn-ghost; padding: .2rem .6rem; font-size: .72rem; }

  // Modal
  &__modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.65);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  &__modal {
    background: #161616;
    border: 1px solid rgba(201,164,74,.15);
    border-radius: 12px;
    padding: 1.75rem;
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__modal-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.3rem;
    color: #fff;
    font-weight: 400;
    margin: 0;
  }

  &__label {
    display: flex;
    flex-direction: column;
    gap: .35rem;
    font-size: .78rem;
    color: rgba(255,255,255,.5);
  }

  &__input {
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 6px;
    color: #fff;
    padding: .45rem .75rem;
    font-size: .82rem;
    font-family: 'Outfit', sans-serif;
    outline: none;
    transition: border-color .2s;

    &:focus { border-color: rgba(201,164,74,.5); }
  }

  &__modal-actions { display: flex; gap: .75rem; margin-top: .25rem; }

  &__btn-save   { @include btn-primary; padding: .5rem 1.2rem; }
  &__btn-cancel { @include btn-ghost; }
}
```

- [ ] **Step 4 : Vérifier la compilation**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

- [ ] **Step 5 : Commit**

```bash
git add src/app/components/admin/services/
git commit -m "feat(frontend): composant AdminServices (gestion des prestations)"
```

---

## Task 11 — Routes + sidebar (frontend)

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/components/admin/admin.component.html`

- [ ] **Step 1 : Ajouter les imports et routes dans `app.routes.ts`**

Ajouter les imports en haut du fichier :

```typescript
import { AdminAccountingComponent } from './components/admin/accounting/accounting.component';
import { AdminServicesComponent } from './components/admin/services/services.component';
```

Dans le tableau `children` de la route admin, ajouter après `schedule` :

```typescript
{ path: 'comptabilite', component: AdminAccountingComponent },
{ path: 'prestations', component: AdminServicesComponent },
```

- [ ] **Step 2 : Ajouter les liens dans la sidebar (`admin.component.html`)**

Après le lien Horaires, ajouter :

```html
<a routerLink="/admin/comptabilite" routerLinkActive="active" class="admin-sidebar__link">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  Comptabilité
</a>
<a routerLink="/admin/prestations" routerLinkActive="active" class="admin-sidebar__link">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/></svg>
  Prestations
</a>
```

- [ ] **Step 3 : Vérifier la compilation complète**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

Attendu : 0 erreur.

- [ ] **Step 4 : Tester manuellement dans le navigateur**

1. Démarrer le backend : `cd backend && npm run start:dev`
2. Démarrer le frontend : `npm start`
3. Se connecter en admin sur `http://localhost:4200/admin`
4. Vérifier la sidebar : liens "Comptabilité" et "Prestations" visibles
5. Page Comptabilité : KPIs s'affichent, filtre mois/trimestre/année fonctionnel
6. Ajouter une visite manuelle → reload → visite visible dans le tableau
7. Supprimer la visite → disparaît du tableau
8. Export CSV → fichier téléchargé
9. Export PDF → `window.print()` déclenché, sidebar masquée
10. Page Prestations : 6 services listés, Modifier prix OK, Désactiver → service dans la section désactivée, Réactiver → repasse actif
11. Ajouter une nouvelle prestation → apparaît dans la liste

- [ ] **Step 5 : Commit final**

```bash
git add src/app/app.routes.ts src/app/components/admin/admin.component.html
git commit -m "feat(frontend): routes et sidebar Comptabilité & Prestations"
```
