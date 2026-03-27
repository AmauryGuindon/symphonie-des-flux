import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingService, AccountingData, ManualVisitDto } from '../../../services/accounting.service';
import { AdminService, ServiceConfig } from '../../../services/admin.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const VISITS_PAGE_SIZE = 12;

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
  visitsPage = signal(1);

  private readonly paymentColorMap: Record<string, string> = {
    especes: '#C9A44A',
    virement: '#4BA3C7',
    en_ligne: '#73C97B',
    carte: '#C97BB5',
    points: '#9B59B6',
  };

  private readonly serviceColorMap: Record<string, string> = {
    coupe: '#4BA3C7',
    degrade: '#73C97B',
    'coupe + degrade': '#D98B4A',
    'coupe + barbe': '#C97BB5',
    'barbe seule': '#7E8EF1',
    'coupe enfant': '#E4B94C',
  };

  private readonly servicePalette = ['#4BA3C7', '#73C97B', '#D98B4A', '#C97BB5', '#7E8EF1', '#E4B94C', '#4DC3A6'];

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

  visits = computed(() => this.data()?.visits ?? []);

  revenueByDay = computed(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const map: Record<string, { total: number; visits: any[] }> = {};
    for (const v of this.visits()) {
      const key = (v.visitDate ?? v.createdAt?.slice(0, 10)) as string;
      if (!key || key < cutoffStr) continue;
      if (!map[key]) map[key] = { total: 0, visits: [] };
      map[key].total += v.price;
      map[key].visits.push(v);
    }
    return Object.entries(map)
      .map(([date, { total, visits }]) => ({ date, total, visits }))
      .sort((a, b) => a.date.localeCompare(b.date));
  });

  maxDayRevenue = computed(() => {
    const rows = this.revenueByDay();
    return rows.length ? Math.max(...rows.map(r => r.total)) : 1;
  });

  expandedDay = signal<string | null>(null);

  toggleDay(date: string) {
    this.expandedDay.set(this.expandedDay() === date ? null : date);
  }

  todayStr = new Date().toISOString().slice(0, 10);

  formatDayLabel(date: string): string {
    return new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  clientLabel(v: any): string {
    return v.clientName ?? (v.clientId === 'walk-in' ? 'Client anonyme' : null) ?? '—';
  }

  pagedVisits = computed(() => {
    const start = (this.visitsPage() - 1) * VISITS_PAGE_SIZE;
    const end = start + VISITS_PAGE_SIZE;
    return this.visits().slice(start, end);
  });

  visitsTotalPages = computed(() => Math.max(1, Math.ceil(this.visits().length / VISITS_PAGE_SIZE)));

  visitsPageNumbers = computed(() =>
    Array.from({ length: this.visitsTotalPages() }, (_, i) => i + 1),
  );

  visitsPageStart = computed(() => {
    if (this.visits().length === 0) return 0;
    return (this.visitsPage() - 1) * VISITS_PAGE_SIZE + 1;
  });

  visitsPageEnd = computed(() =>
    Math.min(this.visitsPage() * VISITS_PAGE_SIZE, this.visits().length),
  );

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
    this.visitsPage.set(1);
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
    return ({ especes: 'Espèces', virement: 'Virement', en_ligne: 'En ligne', points: 'Points' } as Record<string, string>)[id] ?? id;
  }

  paymentColor(id: string | null | undefined): string {
    const key = this.normalizeKey(id ?? 'especes');
    return this.paymentColorMap[key] ?? '#9FA6B2';
  }

  paymentBadgeStyles(id: string | null | undefined): Record<string, string> {
    const color = this.paymentColor(id);
    return {
      color,
      borderColor: `${color}66`,
      background: `${color}1A`,
    };
  }

  serviceColor(service: string | null | undefined): string {
    const key = this.normalizeKey(service ?? '');
    if (!key) return '#9FA6B2';

    const mapped = this.serviceColorMap[key];
    if (mapped) return mapped;

    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) | 0;
    }
    return this.servicePalette[Math.abs(hash) % this.servicePalette.length];
  }

  serviceBadgeStyles(service: string | null | undefined): Record<string, string> {
    const color = this.serviceColor(service);
    return {
      color,
      borderColor: `${color}66`,
      background: `${color}1A`,
    };
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
    this.accounting.deleteVisit(id).subscribe({
      next: () => this.load(),
      error: () => {},
    });
  }

  goToVisitsPage(page: number) {
    this.visitsPage.set(Math.min(Math.max(1, page), this.visitsTotalPages()));
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
    const doc = new jsPDF();
    const period = this.selectedDate();

    // En-tête
    doc.setFontSize(18);
    doc.setTextColor(201, 164, 74);
    doc.text('Dany1st Barber', 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Rapport comptable — ${period}`, 14, 28);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 35);

    // KPIs
    const d = this.data();
    const visitsCount = d?.kpis?.visits ?? 0;
    const revenue = d?.kpis?.revenue ?? 0;
    const avgBasket = visitsCount > 0 ? +(revenue / visitsCount).toFixed(2) : 0;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Total visites : ${visitsCount}`, 14, 48);
    doc.text(`Chiffre d'affaires : ${revenue}€`, 80, 48);
    doc.text(`Panier moyen : ${avgBasket}€`, 150, 48);

    // Tableau
    const visits = this.data()?.visits ?? [];
    autoTable(doc, {
      startY: 56,
      head: [['Date', 'Client', 'Prestation', 'Paiement', 'Prix']],
      body: visits.map(v => [
        this.formatDate(v),
        v.clientName ?? 'Walk-in',
        v.serviceType,
        v.paymentMethod ?? 'espèces',
        `${v.price}€`,
      ]),
      headStyles: { fillColor: [30, 30, 30], textColor: [201, 164, 74] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });

    doc.save(`revenus-${period}.pdf`);
  }

  private normalizeKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
