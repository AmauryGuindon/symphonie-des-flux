import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService, LoyaltyStats, ServiceConfig } from '../../../services/admin.service';
import { TIER_CONFIG } from '../../../models/user.model';

@Component({
  selector: 'app-admin-loyalty',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './loyalty.component.html',
  styleUrl: './loyalty.component.scss',
})
export class AdminLoyaltyComponent implements OnInit {
  stats    = signal<LoyaltyStats | null>(null);
  services = signal<ServiceConfig[]>([]);
  loading  = signal(true);
  tierConfig = TIER_CONFIG;

  editingId   = signal<string | null>(null);
  editPoints  = 0;
  saveLoading = signal(false);
  saveSuccess = signal('');

  readonly tiers = ['platinum', 'gold', 'silver', 'bronze'] as const;
  readonly tierColors: Record<string, string> = {
    bronze: '#cd7f32', silver: '#c0c0c0', gold: '#C9A44A', platinum: '#e8f4ff',
  };
  readonly tierLabels: Record<string, string> = {
    bronze: 'Bronze', silver: 'Argent', gold: 'Or', platinum: 'Platine',
  };

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.adminService.getLoyaltyStats().subscribe({
      next: s => { this.stats.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.adminService.getServiceConfigs().subscribe({
      next: s => this.services.set(s),
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

  startEdit(svc: ServiceConfig) {
    this.editingId.set(svc._id);
    this.editPoints = svc.loyaltyPoints;
  }

  cancelEdit() {
    this.editingId.set(null);
  }

  saveEdit(svc: ServiceConfig) {
    this.saveLoading.set(true);
    this.adminService.updateServiceConfig(svc._id, { loyaltyPoints: this.editPoints }).subscribe({
      next: updated => {
        this.services.update(list => list.map(s => s._id === updated._id ? updated : s));
        this.editingId.set(null);
        this.saveLoading.set(false);
        this.saveSuccess.set(`${updated.name} mis à jour`);
        setTimeout(() => this.saveSuccess.set(''), 2500);
      },
      error: () => this.saveLoading.set(false),
    });
  }
}
