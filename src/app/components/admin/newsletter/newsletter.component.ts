import { Component, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { User } from '../../../models/user.model';

type RecipientMode = 'filter' | 'manual';

const FILTERS = [
  { value: 'all',           label: 'Tous les clients',    sub: 'Tous les inscrits avec un email' },
  { value: 'active',        label: 'Clients actifs',       sub: 'Dernière visite < 3 mois' },
  { value: 'inactive',      label: 'Clients inactifs',     sub: 'Dernière visite > 3 mois' },
  { value: 'never',         label: 'Sans visite',          sub: 'Inscrits mais jamais venus' },
  { value: 'tier_bronze',   label: 'Tier Bronze',          sub: '' },
  { value: 'tier_silver',   label: 'Tier Argent',          sub: '' },
  { value: 'tier_gold',     label: 'Tier Or',              sub: '' },
  { value: 'tier_platinum', label: 'Tier Platine',         sub: '' },
] as const;

@Component({
  selector: 'app-admin-newsletter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './newsletter.component.html',
  styleUrl: './newsletter.component.scss',
})
export class AdminNewsletterComponent {
  readonly FILTERS = FILTERS;

  // ── Mode ──────────────────────────────────────────────────────────────────
  recipientMode = signal<RecipientMode>('filter');

  // ── Mode filtre ───────────────────────────────────────────────────────────
  filter         = signal('all');
  recipientCount = signal<number | null>(null);
  loadingCount   = signal(false);
  filterLabel    = computed(() => FILTERS.find(f => f.value === this.filter())?.label ?? '');

  // ── Mode manuel ───────────────────────────────────────────────────────────
  clients        = signal<User[]>([]);
  loadingClients = signal(false);
  clientsLoaded  = false;
  clientSearch   = signal('');
  selectedIds    = signal<Set<string>>(new Set());

  filteredClients = computed(() => {
    const q = this.clientSearch().toLowerCase().trim();
    if (!q) return this.clients();
    return this.clients().filter(c =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q),
    );
  });

  // ── Formulaire ────────────────────────────────────────────────────────────
  subject   = '';
  message   = '';
  bannerUrl = '';
  hasCta    = false;
  ctaLabel  = '';
  ctaUrl    = '';

  // ── État ──────────────────────────────────────────────────────────────────
  sending     = signal(false);
  result      = signal<{ sent: number; skipped: number } | null>(null);
  showConfirm = signal(false);

  finalCount = computed(() =>
    this.recipientMode() === 'manual' ? this.selectedIds().size : (this.recipientCount() ?? 0),
  );

  constructor(private adminService: AdminService) {
    effect(() => {
      if (this.recipientMode() === 'filter') {
        this.filter(); // dépendance réactive
        this.loadCount();
      }
    }, { allowSignalWrites: true });
  }

  // ── Mode ──────────────────────────────────────────────────────────────────

  setMode(mode: RecipientMode) {
    this.recipientMode.set(mode);
    if (mode === 'manual' && !this.clientsLoaded) this.loadClients();
  }

  // ── Chargements ───────────────────────────────────────────────────────────

  private loadCount() {
    this.loadingCount.set(true);
    this.recipientCount.set(null);
    this.adminService.getNewsletterCount(this.filter()).subscribe({
      next: ({ count }) => { this.recipientCount.set(count); this.loadingCount.set(false); },
      error: () => this.loadingCount.set(false),
    });
  }

  private loadClients() {
    this.loadingClients.set(true);
    this.adminService.getClients().subscribe({
      next: list => {
        this.clients.set(list);
        this.clientsLoaded = true;
        this.loadingClients.set(false);
      },
      error: () => this.loadingClients.set(false),
    });
  }

  // ── Sélection manuelle ────────────────────────────────────────────────────

  toggleClient(id: string) {
    const s = new Set(this.selectedIds());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selectedIds.set(s);
  }

  isSelected(id: string): boolean { return this.selectedIds().has(id); }

  selectAll() {
    this.selectedIds.set(new Set(this.filteredClients().map(c => c._id!)));
  }

  deselectAll() { this.selectedIds.set(new Set()); }

  // ── Envoi ─────────────────────────────────────────────────────────────────

  canSend(): boolean {
    return !!this.subject.trim() && !!this.message.trim() && this.finalCount() > 0 && !this.sending();
  }

  confirmSend() { if (this.canSend()) this.showConfirm.set(true); }

  send() {
    this.showConfirm.set(false);
    this.sending.set(true);
    this.result.set(null);

    this.adminService.sendNewsletter({
      subject:   this.subject,
      message:   this.message,
      filter:    this.recipientMode() === 'manual' ? 'all' : this.filter(),
      bannerUrl: this.bannerUrl || undefined,
      ctaLabel:  this.hasCta && this.ctaLabel ? this.ctaLabel : undefined,
      ctaUrl:    this.hasCta && this.ctaUrl   ? this.ctaUrl   : undefined,
      clientIds: this.recipientMode() === 'manual' ? Array.from(this.selectedIds()) : undefined,
    }).subscribe({
      next: r  => { this.result.set(r); this.sending.set(false); },
      error: () => this.sending.set(false),
    });
  }

  reset() {
    this.result.set(null);
    this.subject   = '';
    this.message   = '';
    this.bannerUrl = '';
    this.hasCta    = false;
    this.ctaLabel  = '';
    this.ctaUrl    = '';
    this.filter.set('all');
    this.selectedIds.set(new Set());
    this.recipientMode.set('filter');
  }

  // ── Helpers tier ──────────────────────────────────────────────────────────

  tierLabel(tier?: string): string {
    return ({ bronze: 'Bronze', silver: 'Argent', gold: 'Or', platinum: 'Platine' } as any)[tier ?? ''] ?? '';
  }

  tierColor(tier?: string): string {
    return ({ bronze: '#cd7f32', silver: '#aaa', gold: '#C9A44A', platinum: '#e5e4e2' } as any)[tier ?? ''] ?? 'rgba(255,255,255,.3)';
  }
}
