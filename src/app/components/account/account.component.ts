import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TIER_CONFIG, LoyaltyTier } from '../../models/user.model';
import { RescheduleModalComponent } from './reschedule-modal/reschedule-modal.component';

export const TIER_BENEFITS: Record<LoyaltyTier, { perks: string[]; nextPerks: string[] }> = {
  bronze: {
    perks: ['Points de prestation + 5 pts bonus/visite', 'Bonus anniversaire (+15 pts)', 'Code de parrainage'],
    nextPerks: ['Points de prestation + 10 pts bonus/visite', 'Accès aux offres promotionnelles'],
  },
  silver: {
    perks: ['Points de prestation + 10 pts bonus/visite', 'Accès aux offres promotionnelles', 'Bonus anniversaire (+15 pts)'],
    nextPerks: ['Points de prestation + 15 pts bonus/visite', 'Priorité sur les créneaux'],
  },
  gold: {
    perks: ['Points de prestation + 15 pts bonus/visite', 'Priorité sur les créneaux', 'Bonus anniversaire (+15 pts)'],
    nextPerks: ['Points de prestation + 20 pts bonus/visite', 'Accès VIP'],
  },
  platinum: {
    perks: ['Points de prestation + 20 pts bonus/visite', 'Accès VIP', 'Bonus anniversaire (+15 pts)'],
    nextPerks: [],
  },
};

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, RouterLink, RescheduleModalComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent implements OnInit {
  user = this.auth.user;
  tierConfig = TIER_CONFIG;
  tierBenefits = TIER_BENEFITS;

  // ── Profil edit ──────────────────────────────────────────────────────────
  editMode = signal(false);
  editFirstName = '';
  editLastName = '';
  editPhone = '';
  editFavoriteStyle = '';
  editPreferences = '';
  editBirthDate = '';

  saveLoading = signal(false);
  saveSuccess = signal(false);

  // ── Anniversaire ─────────────────────────────────────────────────────────
  birthdayLoading = signal(false);
  birthdayError = signal('');
  birthdaySuccess = signal(false);

  // ── Parrainage ────────────────────────────────────────────────────────────
  codeCopied = signal(false);

  // ── Rendez-vous ───────────────────────────────────────────────────────────
  appointments = signal<any[]>([]);
  appointmentsLoading = signal(true);
  cancellingId = signal<string | null>(null);
  confirmCancelId = signal<string | null>(null);
  rescheduleId = signal<string | null>(null);

  // ── Visites ───────────────────────────────────────────────────────────────
  visits = signal<any[]>([]);
  visitsLoading = signal(true);

  // ── Changer mdp ───────────────────────────────────────────────────────────
  showChangePwd = signal(false);
  pwdCurrent = '';
  pwdNew = '';
  pwdConfirm = '';
  pwdLoading = signal(false);
  pwdError = signal('');
  pwdSuccess = signal(false);

  // ── Computed ──────────────────────────────────────────────────────────────
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

  /** Jours restants avant l'anniversaire d'inscription (reset points + dégradation palier) */
  daysUntilAnniversary = computed(() => {
    const u = this.user();
    if (!u?.createdAt) return null;
    const created = new Date(u.createdAt);
    const now = new Date();
    // Pas d'avertissement si compte créé cette année (pas encore de 1er anniversaire)
    if (created.getFullYear() === now.getFullYear()) return null;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let anniversary = new Date(now.getFullYear(), created.getMonth(), created.getDate());
    if (anniversary < todayStart) {
      anniversary = new Date(now.getFullYear() + 1, created.getMonth(), created.getDate());
    }
    return Math.ceil((anniversary.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
  });

  /** Date de remise à zéro des points (prochain anniversaire d'inscription) */
  nextResetDate = computed(() => {
    const u = this.user();
    if (!u?.createdAt) return null;
    const created = new Date(u.createdAt);
    const now = new Date();
    if (created.getFullYear() === now.getFullYear()) return null;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let anniversary = new Date(now.getFullYear(), created.getMonth(), created.getDate());
    if (anniversary < todayStart) {
      anniversary = new Date(now.getFullYear() + 1, created.getMonth(), created.getDate());
    }
    const d = anniversary.getDate().toString().padStart(2, '0');
    const m = (anniversary.getMonth() + 1).toString().padStart(2, '0');
    const y = anniversary.getFullYear();
    return `${d}/${m}/${y}`;
  });

  upcomingAppointments = computed(() =>
    this.appointments().filter(a => a.status !== 'cancelled' && a.date >= this.today()),
  );

  constructor(private auth: AuthService) {}

  ngOnInit() {
    this.auth.refreshUser().subscribe();
    this.auth.getMyAppointments().subscribe({
      next: appts => { this.appointments.set(appts); this.appointmentsLoading.set(false); },
      error: () => this.appointmentsLoading.set(false),
    });
    this.auth.getMyVisits(8).subscribe({
      next: v => { this.visits.set(v); this.visitsLoading.set(false); },
      error: () => this.visitsLoading.set(false),
    });
  }

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  formatDate(d: string): string {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  statusLabel(s: string): string {
    return s === 'confirmed' ? 'Confirmé' : s === 'pending' ? 'En attente' : 'Annulé';
  }

  // ── Profil ────────────────────────────────────────────────────────────────
  startEdit() {
    const u = this.user();
    if (!u) return;
    this.editFirstName = u.firstName;
    this.editLastName = u.lastName;
    this.editPhone = u.phone ?? '';
    this.editFavoriteStyle = u.favoriteStyle ?? '';
    this.editPreferences = u.preferences ?? '';
    this.editBirthDate = u.birthDate ? u.birthDate.slice(0, 10) : '';
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
      birthDate: this.editBirthDate || undefined,
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

  // ── Anniversaire ─────────────────────────────────────────────────────────
  claimBirthdayBonus() {
    this.birthdayLoading.set(true);
    this.birthdayError.set('');
    this.auth.claimBirthdayBonus().subscribe({
      next: () => { this.birthdayLoading.set(false); this.birthdaySuccess.set(true); },
      error: (err) => {
        this.birthdayError.set(err.error?.message ?? 'Impossible de réclamer le bonus.');
        this.birthdayLoading.set(false);
      },
    });
  }

  // ── Parrainage ────────────────────────────────────────────────────────────
  copyReferralCode() {
    const code = this.user()?.referralCode;
    if (!code) return;
    navigator.clipboard.writeText(code);
    this.codeCopied.set(true);
    setTimeout(() => this.codeCopied.set(false), 2000);
  }

  // ── RDV ───────────────────────────────────────────────────────────────────
  cancelAppointment(id: string) {
    this.cancellingId.set(id);
    this.auth.cancelAppointment(id).subscribe({
      next: () => {
        this.appointments.update(list =>
          list.map(a => a._id === id ? { ...a, status: 'cancelled' } : a),
        );
        this.cancellingId.set(null);
        this.confirmCancelId.set(null);
      },
      error: () => {
        this.cancellingId.set(null);
        this.confirmCancelId.set(null);
      },
    });
  }

  onRescheduled() {
    this.auth.getMyAppointments().subscribe({
      next: appts => {
        this.appointments.set(appts);
        this.rescheduleId.set(null);
      },
      error: () => this.rescheduleId.set(null),
    });
  }

  // ── Changer mdp ───────────────────────────────────────────────────────────
  submitChangePwd() {
    this.pwdError.set('');
    if (this.pwdNew !== this.pwdConfirm) {
      this.pwdError.set('Les mots de passe ne correspondent pas.');
      return;
    }
    if (this.pwdNew.length < 6) {
      this.pwdError.set('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    this.pwdLoading.set(true);
    this.auth.changePassword(this.pwdCurrent, this.pwdNew).subscribe({
      next: () => {
        this.pwdLoading.set(false);
        this.pwdSuccess.set(true);
        this.pwdCurrent = '';
        this.pwdNew = '';
        this.pwdConfirm = '';
        setTimeout(() => { this.pwdSuccess.set(false); this.showChangePwd.set(false); }, 3000);
      },
      error: (err) => {
        this.pwdError.set(err.error?.message ?? 'Erreur lors du changement de mot de passe.');
        this.pwdLoading.set(false);
      },
    });
  }

  logout() { this.auth.logout(); }

  getTierColor(tier: LoyaltyTier): string {
    return TIER_CONFIG[tier]?.color ?? '#C9A44A';
  }
}
