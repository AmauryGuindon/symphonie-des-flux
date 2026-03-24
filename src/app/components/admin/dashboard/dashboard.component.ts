import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, DashboardStats } from '../../../services/admin.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit, AfterViewInit {
  stats = signal<DashboardStats | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  revenueTab: 'today' | 'week' | 'month' | 'year' = 'month';

  readonly tierLabels: Record<string, string> = {
    bronze: 'Bronze', silver: 'Argent', gold: 'Or', platinum: 'Platine',
  };
  readonly tierColors: Record<string, string> = {
    bronze: '#cd7f32', silver: '#c0c0c0', gold: '#C9A44A', platinum: '#e8f4ff',
  };

  today = new Date();
  private chartsBuilt = false;

  @ViewChild('revenueChart') revenueChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('clientsChart') clientsChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('tiersChart') tiersChartRef!: ElementRef<HTMLCanvasElement>;

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.adminService.getStats().subscribe({
      next: s => {
        this.stats.set(s);
        this.loading.set(false);
        // Build charts after next render cycle
        setTimeout(() => this.tryBuildCharts(), 0);
      },
      error: (err) => {
        this.error.set(err?.status === 401 ? 'Non autorisé (token invalide ?)' : `Impossible de contacter le backend (${err?.status ?? 'réseau'})`);
        this.loading.set(false);
      },
    });
  }

  ngAfterViewInit() {
    this.tryBuildCharts();
  }

  private tryBuildCharts() {
    const s = this.stats();
    if (!s || this.chartsBuilt) return;
    if (!this.revenueChartRef || !this.clientsChartRef || !this.tiersChartRef) return;
    this.chartsBuilt = true;
    this.buildCharts(s);
  }

  private buildCharts(s: DashboardStats) {
    const labels = s.monthlyActivity.map(m => m.month);
    const gold = '#C9A44A';

    new Chart(this.revenueChartRef.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'CA (€)',
          data: s.monthlyActivity.map(m => m.revenue),
          borderColor: gold,
          backgroundColor: 'rgba(201,164,74,.08)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: gold,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: 'rgba(255,255,255,.4)' }, grid: { color: 'rgba(255,255,255,.05)' } },
          y: { ticks: { color: 'rgba(255,255,255,.4)' }, grid: { color: 'rgba(255,255,255,.05)' } },
        },
      },
    });

    new Chart(this.clientsChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Nouveaux',
            data: s.monthlyActivity.map(m => m.newClients),
            backgroundColor: 'rgba(201,164,74,.6)',
          },
          {
            label: 'Actifs',
            data: s.monthlyActivity.map(m => m.activeClients),
            backgroundColor: 'rgba(201,164,74,.25)',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: 'rgba(255,255,255,.6)' } } },
        scales: {
          x: { ticks: { color: 'rgba(255,255,255,.4)' }, grid: { color: 'rgba(255,255,255,.05)' } },
          y: { ticks: { color: 'rgba(255,255,255,.4)' }, grid: { color: 'rgba(255,255,255,.05)' } },
        },
      },
    });

    new Chart(this.tiersChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Bronze', 'Argent', 'Or', 'Platine'],
        datasets: [{
          data: [s.tiers.bronze, s.tiers.silver, s.tiers.gold, s.tiers.platinum],
          backgroundColor: ['#cd7f32', '#c0c0c0', '#C9A44A', '#e8f4ff'],
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: 'rgba(255,255,255,.6)' } } },
      },
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

  barMaxHeight(activity: { newClients: number; activeClients: number }[]): number {
    return Math.max(...activity.map(a => Math.max(a.newClients, a.activeClients)), 1);
  }

  getTierCount(tiers: DashboardStats['tiers'], tier: string): number {
    return tiers[tier as keyof DashboardStats['tiers']] ?? 0;
  }
}
