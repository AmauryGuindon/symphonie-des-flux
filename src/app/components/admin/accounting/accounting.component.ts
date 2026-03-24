import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingService, AccountingData, ManualVisitDto } from '../../../services/accounting.service';
import { AdminService, ServiceConfig } from '../../../services/admin.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Total visites : ${d?.totals?.count ?? 0}`, 14, 48);
    doc.text(`Chiffre d'affaires : ${d?.totals?.revenue ?? 0}€`, 80, 48);
    doc.text(`Panier moyen : ${d?.totals?.avg ?? 0}€`, 150, 48);

    // Tableau
    const visits = this.data()?.visits ?? [];
    autoTable(doc, {
      startY: 56,
      head: [['Date', 'Client', 'Prestation', 'Paiement', 'Prix']],
      body: visits.map(v => [
        v.visitDate ?? (v.createdAt as string)?.slice(0, 10) ?? '',
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
}
