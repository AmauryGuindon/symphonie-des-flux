import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TIER_CONFIG, LoyaltyTier } from '../../models/user.model';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent implements OnInit {
  user = this.auth.user;
  tierConfig = TIER_CONFIG;

  editMode = signal(false);
  editFirstName = '';
  editLastName = '';
  editPhone = '';
  editFavoriteStyle = '';
  editPreferences = '';

  saveLoading = signal(false);
  saveSuccess = signal(false);

  birthdayLoading = signal(false);
  birthdayError = signal('');
  birthdaySuccess = signal(false);

  codeCopied = signal(false);

  tierProgress = computed(() => {
    const u = this.user();
    if (!u) return 0;
    const cfg = TIER_CONFIG[u.loyaltyTier];
    if (!cfg.next) return 100;
    const prevVisits = u.loyaltyTier === 'bronze' ? 0
      : u.loyaltyTier === 'silver' ? 5
      : u.loyaltyTier === 'gold' ? 15 : 30;
    return Math.min(100, ((u.visitCount - prevVisits) / (cfg.next - prevVisits)) * 100);
  });

  nextTierLabel = computed(() => {
    const u = this.user();
    if (!u) return '';
    const cfg = TIER_CONFIG[u.loyaltyTier];
    if (!cfg.next) return 'Palier maximum atteint';
    return `${cfg.next - u.visitCount} visite(s) avant le prochain palier`;
  });

  constructor(private auth: AuthService) {}

  ngOnInit() {
    this.auth.refreshUser().subscribe();
  }

  startEdit() {
    const u = this.user();
    if (!u) return;
    this.editFirstName = u.firstName;
    this.editLastName = u.lastName;
    this.editPhone = u.phone ?? '';
    this.editFavoriteStyle = u.favoriteStyle ?? '';
    this.editPreferences = u.preferences ?? '';
    this.editMode.set(true);
  }

  saveEdit() {
    this.saveLoading.set(true);
    this.auth.updateProfile({
      firstName: this.editFirstName,
      lastName: this.editLastName,
      phone: this.editPhone || undefined,
      favoriteStyle: this.editFavoriteStyle || undefined,
      preferences: this.editPreferences || undefined,
    }).subscribe({
      next: () => {
        this.saveLoading.set(false);
        this.editMode.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: () => this.saveLoading.set(false),
    });
  }

  claimBirthdayBonus() {
    this.birthdayLoading.set(true);
    this.birthdayError.set('');
    this.auth.claimBirthdayBonus().subscribe({
      next: () => {
        this.birthdayLoading.set(false);
        this.birthdaySuccess.set(true);
      },
      error: (err) => {
        this.birthdayError.set(err.error?.message ?? 'Impossible de réclamer le bonus.');
        this.birthdayLoading.set(false);
      },
    });
  }

  copyReferralCode() {
    const code = this.user()?.referralCode;
    if (!code) return;
    navigator.clipboard.writeText(code);
    this.codeCopied.set(true);
    setTimeout(() => this.codeCopied.set(false), 2000);
  }

  logout() {
    this.auth.logout();
  }

  getTierColor(tier: LoyaltyTier): string {
    return TIER_CONFIG[tier]?.color ?? '#C9A44A';
  }
}
