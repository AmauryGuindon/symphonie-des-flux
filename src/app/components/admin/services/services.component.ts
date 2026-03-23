import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, ServiceConfig } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-services',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class AdminServicesComponent implements OnInit {
  services = signal<ServiceConfig[]>([]);
  loading = signal(true);
  showInactive = signal(false);

  showModal = signal(false);
  editingId = signal<string | null>(null);
  form = { name: '', price: 0, loyaltyPoints: 0 };
  saving = signal(false);
  saved = signal(false);

  active = computed(() => this.services().filter(s => s.active));
  inactive = computed(() => this.services().filter(s => !s.active));

  constructor(private adminService: AdminService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.adminService.getServiceConfigs().subscribe({
      next: s => { this.services.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openAdd() {
    this.editingId.set(null);
    this.form = { name: '', price: 0, loyaltyPoints: 0 };
    this.showModal.set(true);
  }

  openEdit(s: ServiceConfig) {
    this.editingId.set(s._id);
    this.form = { name: s.name, price: s.price, loyaltyPoints: s.loyaltyPoints };
    this.showModal.set(true);
  }

  save() {
    if (!this.form.name || this.form.price < 0) return;
    this.saving.set(true);
    const id = this.editingId();
    const obs = id
      ? this.adminService.updateServiceConfig(id, { price: this.form.price, loyaltyPoints: this.form.loyaltyPoints })
      : this.adminService.createService(this.form);

    obs.subscribe({
      next: () => {
        this.showModal.set(false);
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2000);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  toggle(s: ServiceConfig) {
    const label = s.active ? 'Désactiver' : 'Réactiver';
    if (!confirm(`${label} la prestation "${s.name}" ?`)) return;
    this.adminService.toggleService(s._id).subscribe(() => this.load());
  }
}
