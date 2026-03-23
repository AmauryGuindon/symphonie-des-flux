import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingService, AccountingData, ManualVisitDto } from '../../../services/accounting.service';
import { AdminService, ServiceConfig } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-accounting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './accounting.component.html',
  styleUrl: './accounting.component.scss',
})
export class AdminAccountingComponent implements OnInit {
  period = signal<'month' | 'quarter' | 'year'>('month');
  selectedDate = signal(new Date().toISOString().slice(0, 7)); // YYYY-MM pour month

  data = signal<AccountingData | null>(null);
  loading = signal(true);
  services = signal<ServiceConfig[]>([]);

  // Modal ajout visite
  showAddModal = signal(false);
  addForm: ManualVisitDto = { serviceType: '', price: 0, paymentMethod: 'especes' };
  saving = signal(false);

  // Label période courante
  periodLabel = computed(() => {
    const d = this.selectedDate();
    if (this.period() === 'month') {
      const [y, m] = d.split('-');
      return new Date(+y, +m - 1, 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    }
    if (this.period() === 'quarter') return d.replace('Q', 'T');
    return d;
  });

  quarterOptions = computed(() => {
    const y = new Date().getFullYear();
    return [`${y}-Q1`, `${y}-Q2`, `${y}-Q3`, `${y}-Q4`];
  });

  yearOptions = [
    new Date().getFullYear().toString(),
    (new Date().getFullYear() - 1).toString(),
  ];

  constructor(
    private accounting: AccountingService,
    private adminService: AdminService,
  ) {}

  ngOnInit() {
    this.load();
    this.adminService.getServiceConfigs().subscribe(s => this.services.set(s));
  }

  load() {
    this.loading.set(true);
    this.accounting.getAccounting(this.period(), this.selectedDate()).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  setPeriod(p: 'month' | 'quarter' | 'year') {
    this.period.set(p);
    if (p === 'month') this.selectedDate.set(new Date().toISOString().slice(0, 7));
    if (p === 'quarter') this.selectedDate.set(`${new Date().getFullYear()}-Q1`);
    if (p === 'year') this.selectedDate.set(new Date().getFullYear().toString());
    this.load();
  }

  maxBarAmount = computed(() => {
    const d = this.data();
    if (!d || !d.byService.length) return 1;
    return Math.max(...d.byService.map(s => s.total));
  });

  barWidth(amount: number): string {
    return Math.round((amount / this.maxBarAmount()) * 100) + '%';
  }

  totalPayments = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return d.byPayment.reduce((s, p) => s + p.total, 0);
  });

  paymentLabel(id: string): string {
    return ({ especes: 'Espèces', virement: 'Virement', en_ligne: 'En ligne' } as Record<string, string>)[id] ?? id;
  }

  formatDate(visit: any): string {
    const raw = visit.visitDate ?? visit.createdAt;
    return new Date(raw).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  onServiceChange() {
    const match = this.services().find(s => s.name === this.addForm.serviceType);
    if (match) this.addForm.price = match.price;
  }

  openAddModal() {
    this.addForm = { serviceType: '', price: 0, paymentMethod: 'especes' };
    this.showAddModal.set(true);
  }

  saveVisit() {
    if (!this.addForm.serviceType || this.addForm.price < 0) return;
    this.saving.set(true);
    this.accounting.createManualVisit(this.addForm).subscribe({
      next: () => { this.showAddModal.set(false); this.saving.set(false); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  deleteVisit(id: string) {
    if (!confirm('Supprimer cette visite ?')) return;
    this.accounting.deleteVisit(id).subscribe(() => this.load());
  }

  exportCsv() {
    const visits = this.data()?.visits ?? [];
    const lines = [
      ['Date', 'Client', 'Prestation', 'Paiement', 'Montant (€)'].join(';'),
      ...visits.map(v => [
        this.formatDate(v),
        v.clientName ?? (v.clientId === 'walk-in' ? 'Client anonyme' : v.clientId),
        v.serviceType,
        this.paymentLabel(v.paymentMethod ?? 'especes'),
        v.price.toString().replace('.', ','),
      ].join(';')),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `revenus-${this.selectedDate()}.csv`;
    a.click();
  }

  printPdf() {
    window.print();
  }
}
