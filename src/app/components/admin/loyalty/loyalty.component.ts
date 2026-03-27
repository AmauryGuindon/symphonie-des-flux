import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService, LoyaltyStats } from '../../../services/admin.service';
import { TIER_CONFIG } from '../../../models/user.model';

@Component({
  selector: 'app-admin-loyalty',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './loyalty.component.html',
  styleUrl: './loyalty.component.scss',
})
export class AdminLoyaltyComponent implements OnInit {
  stats      = signal<LoyaltyStats | null>(null);
  loading    = signal(true);
  tierConfig = TIER_CONFIG;

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
}
