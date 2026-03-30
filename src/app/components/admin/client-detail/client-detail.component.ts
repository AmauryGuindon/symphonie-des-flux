import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AdminService, Visit, ServiceConfig } from '../../../services/admin.service';
import { User, TIER_CONFIG } from '../../../models/user.model';

@Component({
  selector: 'app-admin-client-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './client-detail.component.html',
  styleUrl: './client-detail.component.scss',
})
export class AdminClientDetailComponent implements OnInit {
  client   = signal<User | null>(null);
  visits   = signal<Visit[]>([]);
  services = signal<ServiceConfig[]>([]);
  loading  = signal(true);
  tierConfig = TIER_CONFIG;

  editMode = signal(false);
  editFirstName = '';
  editLastName  = '';
  editPhone     = '';
  editFavoriteStyle = '';
  editPreferences   = '';
  saveLoading = signal(false);

  // Formulaire visite (initialisé depuis l'API dans ngOnInit)
  visitService = '';
  visitPrice   = 0;
  visitNotes   = '';
  visitLoading = signal(false);
  visitSuccess = signal(false);
  visitPanelOpen = signal(false);

  pointsDelta   = 0;
  pointsLoading = signal(false);
  pointsSuccess = signal('');

  internalNotes = '';
  notesLoading = signal(false);
  notesSuccess = signal(false);

  deleteConfirm = signal(false);
  currentYear = new Date().getFullYear();

  revenueByYear = computed(() => {
    const map: Record<number, number> = {};
    for (const v of this.visits()) {
      const year = new Date((v.visitDate ?? v.createdAt).slice(0, 10)).getFullYear();
      map[year] = (map[year] ?? 0) + v.price;
    }
    return Object.entries(map)
      .map(([year, total]) => ({ year: +year, total }))
      .sort((a, b) => b.year - a.year);
  });

  currentYearRevenue = computed(() => {
    const currentYear = new Date().getFullYear();
    return this.revenueByYear().find(r => r.year === currentYear)?.total ?? 0;
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminService: AdminService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadClient(id);
    this.loadVisits(id);
    this.adminService.getServiceConfigs().subscribe({
      next: s => {
        this.services.set(s);
        if (s.length) { this.visitService = s[0].name; this.visitPrice = s[0].price; }
      },
    });
  }

  private loadClient(id: string) {
    this.loading.set(true);
    this.adminService.getClient(id).subscribe({
      next: c => { this.client.set(c); this.internalNotes = c.internalNotes ?? ''; this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadVisits(id: string) {
    this.adminService.getClientVisits(id).subscribe({
      next: v => this.visits.set(v),
    });
  }

  getTierColor(tier: string): string {
    return TIER_CONFIG[tier as keyof typeof TIER_CONFIG]?.color ?? '#C9A44A';
  }

  getTierLabel(tier: string): string {
    return TIER_CONFIG[tier as keyof typeof TIER_CONFIG]?.label ?? tier;
  }

  onServiceChange() {
    const svc = this.services().find(s => s.name === this.visitService);
    if (svc) this.visitPrice = svc.price;
  }

  startEdit() {
    const c = this.client();
    if (!c) return;
    this.editFirstName     = c.firstName;
    this.editLastName      = c.lastName;
    this.editPhone         = c.phone ?? '';
    this.editFavoriteStyle = c.favoriteStyle ?? '';
    this.editPreferences   = c.preferences ?? '';
    this.editMode.set(true);
  }

  saveEdit() {
    const c = this.client();
    if (!c) return;
    this.saveLoading.set(true);
    this.adminService.updateClient(c._id!, {
      firstName:     this.editFirstName,
      lastName:      this.editLastName,
      phone:         this.editPhone || undefined,
      favoriteStyle: this.editFavoriteStyle || undefined,
      preferences:   this.editPreferences   || undefined,
    } as Partial<User>).subscribe({
      next: updated => {
        this.client.set(updated);
        this.editMode.set(false);
        this.saveLoading.set(false);
      },
      error: () => this.saveLoading.set(false),
    });
  }

  recordVisit() {
    const c = this.client();
    if (!c) return;
    this.visitLoading.set(true);
    this.adminService.recordVisit(c._id!, this.visitService, this.visitPrice, this.visitNotes || undefined).subscribe({
      next: updated => {
        this.client.set(updated);
        this.visitLoading.set(false);
        this.visitSuccess.set(true);
        this.visitNotes = '';
        this.visitPanelOpen.set(false);
        this.loadVisits(c._id!);
        setTimeout(() => this.visitSuccess.set(false), 3000);
      },
      error: () => this.visitLoading.set(false),
    });
  }

  applyPoints() {
    const c = this.client();
    if (!c || this.pointsDelta === 0) return;
    this.pointsLoading.set(true);
    this.adminService.adjustPoints(c._id!, this.pointsDelta).subscribe({
      next: updated => {
        this.client.set(updated);
        const sign = this.pointsDelta > 0 ? '+' : '';
        this.pointsSuccess.set(`${sign}${this.pointsDelta} pts appliqués`);
        this.pointsDelta = 0;
        this.pointsLoading.set(false);
        setTimeout(() => this.pointsSuccess.set(''), 3000);
      },
      error: () => this.pointsLoading.set(false),
    });
  }

  saveNotes() {
    const c = this.client();
    if (!c) return;
    this.notesLoading.set(true);
    this.adminService.updateClient(c._id!, { internalNotes: this.internalNotes || undefined }).subscribe({
      next: updated => {
        this.client.set(updated);
        this.notesLoading.set(false);
        this.notesSuccess.set(true);
        setTimeout(() => this.notesSuccess.set(false), 3000);
      },
      error: () => this.notesLoading.set(false),
    });
  }

  deleteClient() {
    const c = this.client();
    if (!c) return;
    this.adminService.deleteClient(c._id!).subscribe({
      next: () => this.router.navigate(['/admin/clients']),
    });
  }
}
