import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { User, TIER_CONFIG } from '../../../models/user.model';

const PAGE_SIZE = 15;

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

  pagedClients = computed(() =>
    this.clients().slice((this.page() - 1) * PAGE_SIZE, this.page() * PAGE_SIZE)
  );

  totalPages = computed(() => Math.max(1, Math.ceil(this.clients().length / PAGE_SIZE)));

  pageNumbers = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1)
  );

  pageStart = computed(() => (this.page() - 1) * PAGE_SIZE + 1);
  pageEnd   = computed(() => Math.min(this.page() * PAGE_SIZE, this.clients().length));

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

  goTo(p: number) {
    this.page.set(Math.min(Math.max(1, p), this.totalPages()));
  }

  getTierColor(tier: string): string {
    return TIER_CONFIG[tier as keyof typeof TIER_CONFIG]?.color ?? '#C9A44A';
  }

  getTierLabel(tier: string): string {
    return TIER_CONFIG[tier as keyof typeof TIER_CONFIG]?.label ?? tier;
  }
}
