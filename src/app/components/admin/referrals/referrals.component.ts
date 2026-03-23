import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService, ReferralStats } from '../../../services/admin.service';
import { TIER_CONFIG } from '../../../models/user.model';

@Component({
  selector: 'app-admin-referrals',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './referrals.component.html',
  styleUrl: './referrals.component.scss',
})
export class AdminReferralsComponent implements OnInit {
  stats = signal<ReferralStats | null>(null);
  loading = signal(true);
  tierColors: Record<string, string> = {
    bronze: '#cd7f32', silver: '#c0c0c0', gold: '#C9A44A', platinum: '#e8f4ff',
  };
  tierLabels: Record<string, string> = {
    bronze: 'Bronze', silver: 'Argent', gold: 'Or', platinum: 'Platine',
  };

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.adminService.getReferralStats().subscribe({
      next: s => { this.stats.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
