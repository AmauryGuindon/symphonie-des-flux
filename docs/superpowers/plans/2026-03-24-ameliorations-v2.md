# Améliorations V2 — Dany1st Barber

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter 8 améliorations indépendantes : 404, confirmation annulation, services depuis BDD, reprogrammer RDV, rappels email, graphiques dashboard, export PDF comptabilité, gestion galerie admin.

**Architecture:** Angular 17 standalone frontend + NestJS backend + MongoDB. Chaque tâche est indépendante et peut être implémentée séparément. Les tâches 1-3 sont purement frontend, 4-5 touchent frontend + backend, 6-7 sont frontend avec lib tierce, 8 est full-stack complexe.

**Tech Stack:** Angular 17, NestJS, MongoDB/Mongoose, Chart.js (graphiques), jsPDF + jspdf-autotable (PDF), @nestjs/schedule (cron), Multer (upload galerie)

---

## Fichiers concernés par tâche

| Tâche | Fichiers créés | Fichiers modifiés |
|-------|---------------|-------------------|
| 1. 404 | `src/app/components/not-found/not-found.component.{ts,html,scss}` | `src/app/app.routes.ts` |
| 2. Confirmation annulation | — | `src/app/components/account/account.component.{html,scss}` |
| 3. Services depuis BDD | — | `src/app/components/services/services.component.{ts,html}` |
| 4. Reprogrammer RDV | `src/app/components/account/reschedule-modal/reschedule-modal.component.{ts,html,scss}` | `backend/src/appointments/appointments.controller.ts`, `appointments.service.ts`, `account.component.{ts,html,scss}` |
| 5. Rappels email | `backend/src/reminders/reminders.module.ts`, `reminders.service.ts` | `backend/src/app.module.ts`, `backend/package.json` |
| 6. Graphiques dashboard | — | `src/app/components/admin/dashboard/dashboard.component.{ts,html,scss}` |
| 7. Export PDF | — | `src/app/components/admin/accounting/accounting.component.ts`, `package.json` |
| 8. Gestion galerie | `backend/src/gallery/gallery.module.ts`, `gallery.controller.ts`, `gallery.service.ts`, `schemas/gallery-item.schema.ts` ; `src/app/components/admin/gallery/gallery.component.{ts,html,scss}` | `backend/src/app.module.ts`, `backend/src/main.ts`, `src/app/components/gallery/gallery.component.ts`, `src/app/app.routes.ts`, `src/app/components/admin/admin.component.html` |

---

## Tâche 1 : Page 404 personnalisée

**Objectif :** Remplacer la redirection silencieuse vers `/` par une vraie page 404 stylisée.

**Fichiers :**
- Créer : `src/app/components/not-found/not-found.component.ts`
- Créer : `src/app/components/not-found/not-found.component.html`
- Créer : `src/app/components/not-found/not-found.component.scss`
- Modifier : `src/app/app.routes.ts`

- [ ] **Créer le composant** `not-found.component.ts` :

```typescript
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {}
```

- [ ] **Créer le template** `not-found.component.html` :

```html
<section class="notfound">
  <div class="notfound__inner">
    <span class="notfound__code">404</span>
    <div class="gold-divider"></div>
    <h1 class="notfound__title">Page introuvable</h1>
    <p class="notfound__sub">Cette page n'existe pas ou a été déplacée.</p>
    <a [routerLink]="['/']" class="notfound__btn">Retour à l'accueil →</a>
  </div>
</section>
```

- [ ] **Créer les styles** `not-found.component.scss` :

```scss
.notfound {
  min-height: 100vh;
  background: var(--black);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;

  &__inner { display: flex; flex-direction: column; align-items: center; gap: 1.5rem; }

  &__code {
    font-family: var(--font-display);
    font-size: clamp(6rem, 20vw, 12rem);
    color: rgba(201,164,74,.12);
    line-height: 1;
    letter-spacing: .05em;
  }

  &__title {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 4vw, 2.5rem);
    color: var(--white);
    letter-spacing: .08em;
    margin: 0;
  }

  &__sub {
    font-family: var(--font-body);
    font-size: .9rem;
    color: var(--white-muted);
    margin: 0;
  }

  &__btn {
    font-family: var(--font-body);
    font-size: .72rem;
    letter-spacing: .18em;
    text-transform: uppercase;
    color: var(--gold);
    text-decoration: none;
    border-bottom: 1px solid rgba(201,164,74,.3);
    padding-bottom: .15rem;
    transition: border-color .2s;
    &:hover { border-color: var(--gold); }
  }
}
```

- [ ] **Mettre à jour `app.routes.ts`** — remplacer la dernière ligne :

```typescript
// Avant :
{ path: '**', redirectTo: '' },
// Après :
{ path: '**', component: NotFoundComponent },
```
Et ajouter l'import : `import { NotFoundComponent } from './components/not-found/not-found.component';`

- [ ] **Tester** : naviguer vers `/n-importe-quoi` → page 404 affichée ; lien "Retour à l'accueil" fonctionne.

- [ ] **Commit** : `feat: page 404 personnalisée`

---

## Tâche 2 : Confirmation avant annulation RDV

**Objectif :** Ajouter un dialogue de confirmation inline avant l'annulation d'un rendez-vous.

**Fichiers :**
- Modifier : `src/app/components/account/account.component.html`
- Modifier : `src/app/components/account/account.component.ts`
- Modifier : `src/app/components/account/account.component.scss`

- [ ] **Ajouter le signal** dans `account.component.ts` :

```typescript
confirmCancelId = signal<string | null>(null);
```

- [ ] **Remplacer le bouton "Annuler"** dans le template :

```html
<!-- Remplacer le bouton annuler existant par : -->
@if (a.status !== 'cancelled') {
  @if (confirmCancelId() === a._id) {
    <div class="account__appt-confirm">
      <span>Confirmer l'annulation ?</span>
      <button class="account__appt-confirm-yes"
        (click)="cancelAppointment(a._id); confirmCancelId.set(null)"
        [disabled]="cancellingId() === a._id">
        Oui
      </button>
      <button class="account__appt-confirm-no" (click)="confirmCancelId.set(null)">Non</button>
    </div>
  } @else {
    <button class="account__appt-cancel" (click)="confirmCancelId.set(a._id)">
      Annuler
    </button>
  }
}
```

- [ ] **Ajouter les styles** dans `account.component.scss` :

```scss
&__appt-confirm {
  display: flex;
  align-items: center;
  gap: .5rem;
  font-family: var(--font-body);
  font-size: .72rem;
  color: rgba(255,255,255,.6);
}

&__appt-confirm-yes {
  background: rgba(231,76,60,.12);
  border: 1px solid rgba(231,76,60,.4);
  color: #e74c3c;
  font-size: .68rem;
  font-weight: 700;
  padding: .25rem .6rem;
  border-radius: 5px;
  cursor: pointer;
  font-family: var(--font-body);
  transition: all .2s;
  &:hover { background: rgba(231,76,60,.2); }
}

&__appt-confirm-no {
  background: none;
  border: 1px solid rgba(255,255,255,.12);
  color: rgba(255,255,255,.4);
  font-size: .68rem;
  padding: .25rem .6rem;
  border-radius: 5px;
  cursor: pointer;
  font-family: var(--font-body);
  transition: all .2s;
  &:hover { border-color: rgba(255,255,255,.3); color: rgba(255,255,255,.7); }
}
```

- [ ] **Tester** : cliquer "Annuler" → confirmation apparaît ; "Non" annule ; "Oui" annule le RDV.

- [ ] **Commit** : `feat: confirmation avant annulation rendez-vous`

---

## Tâche 3 : Services chargés depuis la base de données

**Objectif :** La section Services de la landing page doit afficher les prestations actives depuis la BDD au lieu de données hardcodées.

**Fichiers :**
- Modifier : `src/app/components/services/services.component.ts`
- Modifier : `src/app/components/services/services.component.html`

> L'endpoint `GET /appointments/services` retourne les services actifs. Il est déjà utilisé par la page de réservation.

- [ ] **Mettre à jour `services.component.ts`** :

```typescript
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface ServiceConfig {
  _id: string;
  name: string;
  price: number;
  loyaltyPoints: number;
  active: boolean;
}

const ICONS: Record<string, string> = {
  'Coupe': '✦',
  'Coupe + Dégradé': '◆',
  'Coupe + Barbe': '◈',
  'Barbe seule': '◇',
  'Dégradé': '◉',
  'Coupe enfant': '✧',
};

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class ServicesComponent implements OnInit {
  services = signal<ServiceConfig[]>([]);

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<ServiceConfig[]>('http://localhost:3000/api/appointments/services')
      .subscribe({ next: s => this.services.set(s), error: () => {} });
  }

  iconFor(name: string): string {
    return ICONS[name] ?? '✦';
  }
}
```

- [ ] **Mettre à jour le template** pour utiliser `services()` signal + afficher le prix :

Remplacer `@for (service of services; ...)` par `@for (service of services(); ...)` et utiliser `iconFor(service.name)` pour l'icône, `service.name` pour le nom, `service.price + '€'` pour le prix.

- [ ] **Tester** : désactiver une prestation depuis le backoffice → elle disparaît de la landing page au rechargement.

- [ ] **Commit** : `feat: services landing page chargés depuis la BDD`

---

## Tâche 4 : Reprogrammer un rendez-vous

**Objectif :** Le client peut modifier la date/heure d'un RDV à venir depuis son espace compte.

### Backend

**Fichiers :**
- Modifier : `backend/src/appointments/appointments.service.ts`
- Modifier : `backend/src/appointments/appointments.controller.ts`

- [ ] **Ajouter `rescheduleMyAppointment()` dans `appointments.service.ts`** :

```typescript
async rescheduleMyAppointment(id: string, clientId: string, date: string, time: string) {
  // Vérifier que le créneau cible est disponible
  const conflict = await this.appointmentModel.findOne({
    date, time, status: { $ne: 'cancelled' }, _id: { $ne: id },
  });
  if (conflict) throw new Error('Ce créneau n\'est plus disponible.');

  return this.appointmentModel.findOneAndUpdate(
    { _id: id, clientId },
    { date, time, status: 'pending' },
    { new: true },
  );
}
```

- [ ] **Ajouter l'endpoint dans `appointments.controller.ts`** :

```typescript
@Patch(':id/reschedule')
@UseGuards(JwtAuthGuard)
async rescheduleMyAppointment(
  @Param('id') id: string,
  @Request() req: any,
  @Body() dto: { date: string; time: string },
) {
  try {
    return await this.appointmentsService.rescheduleMyAppointment(
      id, req.user.userId, dto.date, dto.time,
    );
  } catch (e: any) {
    throw new BadRequestException(e.message);
  }
}
```

### Frontend

**Fichiers :**
- Créer : `src/app/components/account/reschedule-modal/reschedule-modal.component.ts`
- Créer : `src/app/components/account/reschedule-modal/reschedule-modal.component.html`
- Créer : `src/app/components/account/reschedule-modal/reschedule-modal.component.scss`
- Modifier : `src/app/components/account/account.component.ts`
- Modifier : `src/app/components/account/account.component.html`
- Modifier : `src/app/services/auth.service.ts`

- [ ] **Ajouter dans `auth.service.ts`** :

```typescript
rescheduleAppointment(id: string, date: string, time: string): Observable<any> {
  return this.http.patch(`${this.API}/appointments/${id}/reschedule`, { date, time });
}

getAvailableSlots(date: string): Observable<{ slots: { time: string; available: boolean }[] }> {
  return this.http.get<any>(`${this.API}/appointments/slots?date=${date}`);
}
```

- [ ] **Créer le composant modal** `reschedule-modal.component.ts` — composant standalone avec `@Input() appointmentId`, `@Output() rescheduled = new EventEmitter()`, `@Output() closed = new EventEmitter()`. Logique : calendrier (copie simplifiée depuis appointment-booking), slots, appel `auth.rescheduleAppointment()`.

- [ ] **Intégrer dans `account.component.html`** — ajouter bouton "Reprogrammer" à côté de "Annuler" + `<app-reschedule-modal>` conditionnel.

- [ ] **Tester** : cliquer "Reprogrammer" → modal → sélectionner nouvelle date/heure → confirmer → RDV mis à jour dans la liste.

- [ ] **Commit** : `feat: reprogrammer un rendez-vous depuis l'espace compte`

---

## Tâche 5 : Rappels email automatiques (24h avant RDV)

**Objectif :** Envoyer automatiquement un email de rappel 24h avant chaque rendez-vous confirmé.

**Fichiers :**
- Modifier : `backend/package.json` (installer `@nestjs/schedule`)
- Créer : `backend/src/reminders/reminders.module.ts`
- Créer : `backend/src/reminders/reminders.service.ts`
- Modifier : `backend/src/app.module.ts`

- [ ] **Installer `@nestjs/schedule`** :

```bash
cd backend && npm install @nestjs/schedule
```

- [ ] **Créer `reminders.service.ts`** :

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { Appointment, AppointmentDocument } from '../appointments/schemas/appointment.schema';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  // Tourne tous les jours à 9h00
  @Cron('0 9 * * *')
  async sendDailyReminders() {
    if (!process.env.SMTP_USER) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const appointments = await this.appointmentModel.find({
      date: tomorrowStr,
      status: 'confirmed',
    });

    this.logger.log(`Envoi de ${appointments.length} rappel(s) pour le ${tomorrowStr}`);

    for (const appt of appointments) {
      try {
        await this.transporter.sendMail({
          from: `"Dany1st Barber" <${process.env.SMTP_USER}>`,
          to: appt.clientEmail,
          subject: 'Rappel — Votre rendez-vous demain chez Dany1st Barber',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
              <h2 style="color:#C9A44A">Dany1st Barber</h2>
              <p>Bonjour <strong>${appt.clientName}</strong>,</p>
              <p>Rappel : vous avez un rendez-vous <strong>demain</strong> :</p>
              <table style="border-collapse:collapse;width:100%">
                <tr><td style="padding:8px;color:#555">Prestation</td><td><strong>${appt.serviceType}</strong></td></tr>
                <tr><td style="padding:8px;color:#555">Date</td><td><strong>${appt.date.split('-').reverse().join('/')}</strong></td></tr>
                <tr><td style="padding:8px;color:#555">Heure</td><td><strong>${appt.time}</strong></td></tr>
              </table>
              <p style="color:#888;font-size:13px">Pour annuler ou modifier, connectez-vous à votre espace client.</p>
              <p>À demain,<br><strong>Dany1st Barber</strong></p>
            </div>`,
        });
      } catch (err) {
        this.logger.error(`Échec rappel pour ${appt.clientEmail}`, err);
      }
    }
  }
}
```

- [ ] **Créer `reminders.module.ts`** :

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RemindersService } from './reminders.service';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Appointment.name, schema: AppointmentSchema }])],
  providers: [RemindersService],
})
export class RemindersModule {}
```

- [ ] **Enregistrer dans `app.module.ts`** :

```typescript
import { ScheduleModule } from '@nestjs/schedule';
import { RemindersModule } from './reminders/reminders.module';
// Dans imports[] :
ScheduleModule.forRoot(),
RemindersModule,
```

- [ ] **Tester** : changer le cron en `* * * * *` (toutes les minutes), créer un RDV confirmé pour demain, observer les logs. Remettre `'0 9 * * *'` après test.

- [ ] **Commit** : `feat: rappels email automatiques 24h avant rendez-vous`

---

## Tâche 6 : Graphiques dans le dashboard admin

**Objectif :** Remplacer les barres CSS par de vrais graphiques Chart.js dans le dashboard.

**Graphiques à ajouter :**
- Ligne : CA mensuel sur 6 mois
- Barres groupées : nouveaux clients / clients actifs sur 6 mois
- Donut : répartition par palier

**Fichiers :**
- Modifier : `src/app/components/admin/dashboard/dashboard.component.ts`
- Modifier : `src/app/components/admin/dashboard/dashboard.component.html`
- Modifier : `src/app/components/admin/dashboard/dashboard.component.scss`
- Modifier : `package.json` frontend (installer chart.js)

- [ ] **Installer Chart.js** :

```bash
npm install chart.js
```

- [ ] **Ajouter dans `backend/src/admin/admin.service.ts`** la donnée CA mensuel dans `getDashboardStats()` — ajouter `monthlyRevenue` : pour chaque mois des 6 derniers, somme des `price` dans visits.

```typescript
// Dans getMonthlyActivity(), ajouter revenue par mois :
const revenue = await this.visitModel.aggregate([
  { $match: { createdAt: { $gte: start, $lte: end } } },
  { $group: { _id: null, total: { $sum: '$price' } } },
]);
result.push({
  month: ...,
  newClients,
  activeClients,
  revenue: revenue[0]?.total ?? 0,
});
```

- [ ] **Mettre à jour `DashboardStats` interface** dans `src/app/services/admin.service.ts` : `monthlyActivity: { month: string; newClients: number; activeClients: number; revenue: number }[]`

- [ ] **Dans `dashboard.component.ts`** :
  - Importer : `import { Chart, registerables } from 'chart.js'; Chart.register(...registerables);`
  - Implémenter `AfterViewInit`
  - Ajouter `@ViewChild('revenueChart') revenueChartRef!: ElementRef`
  - Créer les 3 graphiques dans `ngAfterViewInit()` une fois les stats chargées

```typescript
private buildCharts(s: DashboardStats) {
  const labels = s.monthlyActivity.map(m => m.month);
  const gold = '#C9A44A';

  // Graphique CA
  new Chart(this.revenueChartRef.nativeElement, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'CA (€)',
        data: s.monthlyActivity.map(m => m.revenue),
        borderColor: gold,
        backgroundColor: 'rgba(201,164,74,.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: gold,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,.4)' }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { ticks: { color: 'rgba(255,255,255,.4)' }, grid: { color: 'rgba(255,255,255,.05)' } },
      }
    }
  });

  // Graphique clients (barres groupées)
  new Chart(this.clientsChartRef.nativeElement, { /* similaire */ });

  // Donut paliers
  new Chart(this.tiersChartRef.nativeElement, {
    type: 'doughnut',
    data: {
      labels: ['Bronze', 'Argent', 'Or', 'Platine'],
      datasets: [{ data: [s.tiers.bronze, s.tiers.silver, s.tiers.gold, s.tiers.platinum],
        backgroundColor: ['#cd7f32', '#c0c0c0', '#C9A44A', '#e8f4ff'] }]
    },
    options: { responsive: true, plugins: { legend: { labels: { color: 'rgba(255,255,255,.6)' } } } }
  });
}
```

- [ ] **Dans le template** : remplacer les barres CSS par `<canvas #revenueChart>`, `<canvas #clientsChart>`, `<canvas #tiersChart>` dans des cards.

- [ ] **Tester** : ouvrir le dashboard → 3 graphiques s'affichent avec les données réelles.

- [ ] **Commit** : `feat: graphiques Chart.js dans le dashboard admin`

---

## Tâche 7 : Export PDF comptabilité

**Objectif :** Remplacer `window.print()` par un vrai PDF généré côté client via jsPDF.

**Fichiers :**
- Modifier : `src/app/components/admin/accounting/accounting.component.ts`
- Modifier : `package.json` frontend

- [ ] **Installer jsPDF** :

```bash
npm install jspdf jspdf-autotable
```

- [ ] **Remplacer `printPdf()` dans `accounting.component.ts`** :

```typescript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

printPdf() {
  const doc = new jsPDF();
  const period = this.selectedDate();

  // En-tête
  doc.setFontSize(18);
  doc.setTextColor(201, 164, 74);
  doc.text('Dany1st Barber', 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Rapport comptable — ${period}`, 14, 28);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 35);

  // KPIs (depuis data().totals)
  const d = this.data();
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Total visites : ${d?.totals?.count ?? 0}`, 14, 48);
  doc.text(`Chiffre d'affaires : ${d?.totals?.revenue ?? 0}€`, 80, 48);
  doc.text(`Panier moyen : ${d?.totals?.avg ?? 0}€`, 150, 48);

  // Tableau
  const visits = this.data()?.visits ?? [];
  autoTable(doc, {
    startY: 56,
    head: [['Date', 'Client', 'Prestation', 'Paiement', 'Prix']],
    body: visits.map(v => [
      v.visitDate ?? (v.createdAt as string)?.slice(0, 10) ?? '',
      v.clientName ?? 'Walk-in',
      v.serviceType,
      v.paymentMethod ?? 'espèces',
      `${v.price}€`,
    ]),
    headStyles: { fillColor: [30, 30, 30], textColor: [201, 164, 74] },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  });

  doc.save(`revenus-${period}.pdf`);
}
```

- [ ] **Tester** : cliquer le bouton PDF → fichier téléchargé avec en-tête, KPIs et tableau.

- [ ] **Commit** : `feat: export PDF comptabilité avec jsPDF`

---

## Tâche 8 : Gestion de la galerie (admin + BDD)

**Objectif :** Permettre à Dany de gérer les photos depuis le backoffice. Images stockées sur disque (`backend/uploads/gallery/`) et servies en statique.

### Backend

**Fichiers :**
- Créer : `backend/src/gallery/schemas/gallery-item.schema.ts`
- Créer : `backend/src/gallery/gallery.service.ts`
- Créer : `backend/src/gallery/gallery.controller.ts`
- Créer : `backend/src/gallery/gallery.module.ts`
- Modifier : `backend/src/app.module.ts`
- Modifier : `backend/src/main.ts`

- [ ] **Installer multer** :

```bash
cd backend && npm install multer @types/multer
```

- [ ] **Créer le schéma** `gallery-item.schema.ts` :

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GalleryItemDocument = GalleryItem & Document;

@Schema({ timestamps: true })
export class GalleryItem {
  @Prop({ required: true }) filename: string;   // nom sur disque
  @Prop({ required: true }) url: string;        // URL publique (/uploads/gallery/xxx.jpg)
  @Prop() alt?: string;
  @Prop({ enum: ['wide', 'tall', 'large', ''], default: '' }) span?: string;
  @Prop({ default: 0 }) order: number;
  @Prop({ default: true }) active: boolean;
}

export const GalleryItemSchema = SchemaFactory.createForClass(GalleryItem);
```

- [ ] **Créer `gallery.service.ts`** :

```typescript
@Injectable()
export class GalleryService {
  constructor(@InjectModel(GalleryItem.name) private model: Model<GalleryItemDocument>) {}

  findAll() { return this.model.find().sort({ order: 1, createdAt: -1 }); }
  findActive() { return this.model.find({ active: true }).sort({ order: 1, createdAt: -1 }); }

  async create(filename: string, url: string, alt?: string, span?: string) {
    const count = await this.model.countDocuments();
    return this.model.create({ filename, url, alt, span: span ?? '', order: count });
  }

  update(id: string, dto: { alt?: string; span?: string; active?: boolean; order?: number }) {
    return this.model.findByIdAndUpdate(id, dto, { new: true });
  }

  async delete(id: string, uploadsPath: string) {
    const item = await this.model.findById(id);
    if (!item) return null;
    const fs = await import('fs/promises');
    const filePath = `${uploadsPath}/${item.filename}`;
    await fs.unlink(filePath).catch(() => {});
    return item.deleteOne();
  }
}
```

- [ ] **Créer `gallery.controller.ts`** avec :
  - `GET /gallery` — public, retourne items actifs
  - `GET /admin/gallery` — admin, retourne tous les items
  - `POST /admin/gallery` — upload (multer), créer item
  - `PATCH /admin/gallery/:id` — mettre à jour alt/span/active/order
  - `DELETE /admin/gallery/:id` — supprimer item + fichier

- [ ] **Servir les fichiers statiques** dans `main.ts` :

```typescript
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });
```
Créer le dossier : `mkdir -p backend/uploads/gallery`

- [ ] **Seeder** : script `backend/src/seed-gallery.ts` qui importe les images existantes de `src/assets/` et crée les items en BDD.

### Frontend — Admin

**Fichiers :**
- Créer : `src/app/components/admin/gallery/gallery.component.ts`
- Créer : `src/app/components/admin/gallery/gallery.component.html`
- Créer : `src/app/components/admin/gallery/gallery.component.scss`
- Modifier : `src/app/app.routes.ts`
- Modifier : `src/app/components/admin/admin.component.html` (sidebar)

- [ ] **Créer le composant admin galerie** avec :
  - Liste des photos (grille 4 colonnes)
  - Upload par drag & drop ou click (input[type=file], accept="image/*")
  - Chaque item : aperçu, champ alt, sélecteur span, toggle actif, bouton supprimer
  - Bouton sauvegarder les modifications

- [ ] **Ajouter la route** : `{ path: 'gallery', component: AdminGalleryComponent }` dans les routes admin

- [ ] **Ajouter dans la sidebar admin** : lien "Galerie" avec icône

### Frontend — Galerie publique

- [ ] **Mettre à jour `gallery.component.ts`** pour charger depuis l'API :

```typescript
ngOnInit() {
  this.http.get<GalleryItem[]>('http://localhost:3000/api/gallery')
    .subscribe({ next: items => this.items.set(items), error: () => {} });
}
```

- [ ] **Tester** : uploader une photo depuis le backoffice → apparaît sur la landing page.

- [ ] **Commit** : `feat: gestion galerie admin avec upload et BDD`

---

## Ordre d'implémentation recommandé

1. **Tâche 1** (404) — 15 min, zero risque
2. **Tâche 2** (confirmation annulation) — 15 min, zero risque
3. **Tâche 3** (services BDD) — 20 min, zero risque
4. **Tâche 7** (PDF) — 30 min, frontend only
5. **Tâche 6** (graphiques) — 1h, frontend + petit ajout backend
6. **Tâche 5** (rappels email) — 45 min, backend only
7. **Tâche 4** (reprogrammer RDV) — 1h30, full-stack
8. **Tâche 8** (galerie) — 2-3h, full-stack complexe
