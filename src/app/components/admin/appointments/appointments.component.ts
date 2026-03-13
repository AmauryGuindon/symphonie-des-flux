import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppointmentService, Appointment } from '../../../services/appointment.service';

type ViewMode = 'week' | 'list';
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled';

@Component({
  selector: 'app-admin-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appointments.component.html',
  styleUrl: './appointments.component.scss',
})
export class AdminAppointmentsComponent implements OnInit {
  appointments = signal<Appointment[]>([]);
  loading = signal(true);

  viewMode = signal<ViewMode>('week');
  statusFilter = signal<StatusFilter>('all');
  sortDir = signal<'asc' | 'desc'>('asc');
  dateFrom = signal('');
  dateTo = signal('');

  // Week navigation
  weekStart = signal(this.getWeekStart(new Date()));

  // For rescheduling
  editingId = signal<string | null>(null);
  private editingAppointment: Appointment | null = null;
  editDate = '';
  editTime = '';
  editStatus = 'pending';
  saveLoading = signal(false);

  readonly TIMES = Array.from({ length: 20 }, (_, i) => {
    const h = 9 + Math.floor(i / 2);
    const m = i % 2 === 0 ? '00' : '30';
    return `${String(h).padStart(2, '0')}:${m}`;
  });

  weekDays = computed(() => {
    const start = this.weekStart();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  });

  weekLabel = computed(() => {
    const days = this.weekDays();
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `${fmt(days[0])} — ${fmt(days[6])}`;
  });

  filteredAppointments = computed(() => {
    const f = this.statusFilter();
    const from = this.dateFrom();
    const to = this.dateTo();
    const dir = this.sortDir();

    let list = this.appointments().filter(a => {
      if (f !== 'all' && a.status !== f) return false;
      if (from && a.date < from) return false;
      if (to && a.date > to) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
      return dir === 'asc' ? cmp : -cmp;
    });

    return list;
  });

  toggleSort() {
    this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
  }

  clearDateFilter() {
    this.dateFrom.set('');
    this.dateTo.set('');
  }

  constructor(private appointmentService: AppointmentService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    // Load appointments for current week ± 3 months
    this.appointmentService.getAdminAppointments().subscribe({
      next: a => { this.appointments.set(a); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  // ── Week helpers ──────────────────────────────────────────────────────────

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  prevWeek() {
    const s = new Date(this.weekStart());
    s.setDate(s.getDate() - 7);
    this.weekStart.set(s);
  }

  nextWeek() {
    const s = new Date(this.weekStart());
    s.setDate(s.getDate() + 7);
    this.weekStart.set(s);
  }

  toDateString(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  appointmentsForDay(d: Date): Appointment[] {
    const ds = this.toDateString(d);
    return this.appointments().filter(a => a.date === ds && a.status !== 'cancelled');
  }

  dayLabel(d: Date): string {
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
  }

  isToday(d: Date): boolean {
    const t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  }

  formatDate(ds: string): string {
    const [y, m, d] = ds.split('-');
    return `${d}/${m}/${y}`;
  }

  // ── Status ────────────────────────────────────────────────────────────────

  statusLabel(s: string): string {
    return { pending: 'En attente', confirmed: 'Confirmé', cancelled: 'Annulé' }[s] ?? s;
  }

  statusClass(s: string): string {
    return {
      pending: 'appt-admin__status--pending',
      confirmed: 'appt-admin__status--confirmed',
      cancelled: 'appt-admin__status--cancelled',
    }[s] ?? '';
  }

  paymentLabel(m?: string): string {
    return { especes: 'Espèces', virement: 'Virement', en_ligne: 'En ligne' }[m ?? ''] ?? '—';
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  startEdit(a: Appointment) {
    this.editingAppointment = a;
    this.editingId.set(a._id);
    this.editDate = a.date;
    this.editTime = a.time;
    this.editStatus = a.status;
  }

  cancelEdit() {
    this.editingId.set(null);
    this.editingAppointment = null;
  }

  saveEditById() {
    if (this.editingAppointment) this.saveEdit(this.editingAppointment);
  }

  saveEdit(a: Appointment) {
    this.saveLoading.set(true);
    this.appointmentService.updateAdminAppointment(a._id, {
      date: this.editDate,
      time: this.editTime,
      status: this.editStatus as Appointment['status'],
    }).subscribe({
      next: updated => {
        this.appointments.update(list =>
          list.map(x => (x._id === updated._id ? updated : x))
        );
        this.editingId.set(null);
        this.editingAppointment = null;
        this.saveLoading.set(false);
      },
      error: () => this.saveLoading.set(false),
    });
  }

  delete(id: string) {
    this.appointmentService.deleteAdminAppointment(id).subscribe({
      next: () => this.appointments.update(list => list.filter(a => a._id !== id)),
    });
  }

  // Quick status update
  confirm(a: Appointment) {
    this.appointmentService.updateAdminAppointment(a._id, { status: 'confirmed' }).subscribe({
      next: updated => this.appointments.update(list => list.map(x => x._id === updated._id ? updated : x)),
    });
  }

  cancel(a: Appointment) {
    this.appointmentService.updateAdminAppointment(a._id, { status: 'cancelled' }).subscribe({
      next: updated => this.appointments.update(list => list.map(x => x._id === updated._id ? updated : x)),
    });
  }
}
