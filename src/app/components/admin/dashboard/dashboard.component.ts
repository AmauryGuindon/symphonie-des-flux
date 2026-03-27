import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, DashboardStats } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  stats   = signal<DashboardStats | null>(null);
  loading = signal(true);
  error   = signal<string | null>(null);
  revenueTab: 'today' | 'week' | 'month' | 'year' = 'month';

  readonly tierLabels: Record<string, string> = {
    bronze: 'Bronze', silver: 'Argent', gold: 'Or', platinum: 'Platine',
  };
  readonly tierColors: Record<string, string> = {
    bronze: '#cd7f32', silver: '#c0c0c0', gold: '#C9A44A', platinum: '#e8f4ff',
  };

  today = new Date();

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.adminService.getStats().subscribe({
      next: s => { this.stats.set(s); this.loading.set(false); },
      error: err => {
        this.error.set(err?.status === 401
          ? 'Non autorisé (token invalide ?)'
          : `Impossible de contacter le backend (${err?.status ?? 'réseau'})`);
        this.loading.set(false);
      },
    });
  }

  tierTotal(): number {
    const t = this.stats()?.tiers;
    if (!t) return 0;
    return t.bronze + t.silver + t.gold + t.platinum;
  }

  tierPercent(key: 'bronze' | 'silver' | 'gold' | 'platinum'): number {
    const total = this.tierTotal();
    if (!total) return 0;
    return Math.round(((this.stats()?.tiers[key] ?? 0) / total) * 100);
  }

  barMaxHeight(activity: { newClients: number; activeClients: number }[]): number {
    return Math.max(...activity.map(a => Math.max(a.newClients, a.activeClients)), 1);
  }

  getTierCount(tiers: DashboardStats['tiers'], tier: string): number {
    return tiers[tier as keyof DashboardStats['tiers']] ?? 0;
  }
}
