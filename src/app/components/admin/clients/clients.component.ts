import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { User, TIER_CONFIG, LoyaltyTier } from '../../../models/user.model';

const PAGE_SIZE = 15;

type SortKey = 'lastVisit' | 'points' | 'visits' | '';

@Component({
  selector: 'app-admin-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
})
export class AdminClientsComponent implements OnInit {
  clients = signal<User[]>([]);
  loading = signal(true);
  search = '';
  page = signal(1);
  tierConfig = TIER_CONFIG;

  tierFilter = signal<LoyaltyTier | ''>('');
  sortBy = signal<SortKey>('');

  readonly tiers: { value: LoyaltyTier | ''; label: string }[] = [
    { value: '', label: 'Tous' },
    { value: 'bronze', label: 'Bronze' },
    { value: 'silver', label: 'Argent' },
    { value: 'gold', label: 'Or' },
    { value: 'platinum', label: 'Platine' },
  ];

  filteredClients = computed(() => {
    let list = this.clients();
    const tier = this.tierFilter();
    if (tier) list = list.filter(c => c.loyaltyTier === tier);
    const sort = this.sortBy();
    if (sort === 'lastVisit') list = [...list].sort((a, b) => (b.lastVisitAt ?? '').localeCompare(a.lastVisitAt ?? ''));
    if (sort === 'points')    list = [...list].sort((a, b) => b.loyaltyPoints - a.loyaltyPoints);
    if (sort === 'visits')    list = [...list].sort((a, b) => b.visitCount - a.visitCount);
    return list;
  });

  pagedClients = computed(() =>
    this.filteredClients().slice((this.page() - 1) * PAGE_SIZE, this.page() * PAGE_SIZE)
  );

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredClients().length / PAGE_SIZE)));

  pageNumbers = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1)
  );

  pageStart = computed(() => this.filteredClients().length === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1);
  pageEnd   = computed(() => Math.min(this.page() * PAGE_SIZE, this.filteredClients().length));

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.loadClients();
  }

  loadClients() {
    this.loading.set(true);
    this.page.set(1);
    this.adminService.getClients(this.search || undefined).subscribe({
      next: c => { this.clients.set(c); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch() {
    this.loadClients();
  }

  setTierFilter(tier: LoyaltyTier | '') {
    this.tierFilter.set(tier);
    this.page.set(1);
  }

  setSortBy(sort: SortKey) {
    this.sortBy.set(sort);
    this.page.set(1);
  }

  goTo(p: number) {
    this.page.set(Math.min(Math.max(1, p), this.totalPages()));
  }

  getTierColor(tier: string): string {
    return TIER_CONFIG[tier as keyof typeof TIER_CONFIG]?.color ?? '#C9A44A';
  }

  getTierLabel(tier: string): string {
    return TIER_CONFIG[tier as keyof typeof TIER_CONFIG]?.label ?? tier;
  }

  exportCsv() {
    const tierLabels: Record<string, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or', platinum: 'Platine' };
    const headers = ['Prénom', 'Nom', 'Email', 'Téléphone', 'Palier', 'Points', 'Visites', 'Dernière visite', 'Inscrit le'];
    const rows = this.filteredClients().map(c => [
      c.firstName,
      c.lastName,
      c.email,
      c.phone ?? '',
      tierLabels[c.loyaltyTier] ?? c.loyaltyTier,
      c.loyaltyPoints,
      c.visitCount,
      c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString('fr-FR') : '',
      c.createdAt  ? new Date(c.createdAt).toLocaleDateString('fr-FR')  : '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients-dany1st-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
