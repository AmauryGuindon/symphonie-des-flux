import { Component, OnInit, signal, computed, ViewChild, ElementRef, effect } from '@angular/core';
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
  showCancelled = signal(false);

  // Detail popup (mobile tap)
  detailAppt = signal<Appointment | null>(null);
  validateLoading = signal(false);
  confirmDelete = signal(false);

  openDetail(a: Appointment) { this.detailAppt.set(a); }
  closeDetail() { this.detailAppt.set(null); this.confirmDelete.set(false); }

  confirmFromDetail(a: Appointment) { this.confirm(a); this.closeDetail(); }
  cancelFromDetail(a: Appointment)  { this.cancel(a);  this.closeDetail(); }
  deleteFromDetail(id: string)      { this.delete(id); this.closeDetail(); }
  editFromDetail(a: Appointment)    { this.closeDetail(); this.startEdit(a); }

  isApptPast(a: Appointment): boolean {
    return new Date(`${a.date}T${a.time}:00`) < new Date();
  }

  validateVisitFromDetail(a: Appointment) {
    this.validateLoading.set(true);
    this.appointmentService.validateVisitAdmin(a._id).subscribe({
      next: () => {
        this.appointments.update(list =>
          list.map(x => x._id === a._id ? { ...x, visitRecorded: true } : x)
        );
        this.detailAppt.update(d => d ? { ...d, visitRecorded: true } : d);
        this.validateLoading.set(false);
      },
      error: () => this.validateLoading.set(false),
    });
  }

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

  readonly HOUR_HEIGHT = 80;
  readonly DAY_START = 9;
  readonly HOURS = Array.from({ length: 11 }, (_, i) =>
    `${String(9 + i).padStart(2, '0')}:00`
  );

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

  @ViewChild('calEl') calEl?: ElementRef<HTMLElement>;

  constructor(private appointmentService: AppointmentService) {
    effect(() => {
      if (this.viewMode() === 'week' && !this.loading()) {
        setTimeout(() => this.scrollToToday(), 0);
      }
    });
  }

  private scrollToToday() {
    const el = this.calEl?.nativeElement;
    if (!el || window.innerWidth > 900) return;
    const todayIndex = this.weekDays().findIndex(d => this.isToday(d));
    if (todayIndex < 0) return;
    const gutterWidth = 56;
    const colWidth = (el.scrollWidth - gutterWidth) / 7;
    const targetScroll = gutterWidth + todayIndex * colWidth - (el.clientWidth - colWidth) / 2;
    el.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
  }

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

  goToToday() {
    this.weekStart.set(this.getWeekStart(new Date()));
  }

  isCurrentWeek(): boolean {
    const todayStart = this.getWeekStart(new Date()).getTime();
    return this.weekStart().getTime() === todayStart;
  }

  toDateString(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  appointmentsForDay(d: Date): Appointment[] {
    const ds = this.toDateString(d);
    const cancelled = this.showCancelled();
    return this.appointments().filter(a =>
      a.date === ds && (cancelled ? a.status === 'cancelled' : a.status !== 'cancelled')
    );
  }

  dayLabel(d: Date): string {
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
  }

  dayName(d: Date): string {
    return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  }

  getEventTop(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return ((h - this.DAY_START) * 60 + m) / 60 * this.HOUR_HEIGHT;
  }

  get nowTop(): number {
    const now = new Date();
    return ((now.getHours() - this.DAY_START) * 60 + now.getMinutes()) / 60 * this.HOUR_HEIGHT;
  }

  isClosedDay(d: Date): boolean {
    return d.getDay() === 0; // Sunday
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  getEventPosition(a: Appointment, dayAppts: Appointment[]): { left: string; width: string } {
    const aStart = this.timeToMinutes(a.time);
    const aEnd = aStart + 60;
    const overlapping = dayAppts.filter(b => {
      if (b._id === a._id) return false;
      const bStart = this.timeToMinutes(b.time);
      return aStart < bStart + 60 && aEnd > bStart;
    });
    if (overlapping.length === 0) return { left: '3px', width: 'calc(100% - 6px)' };
    const group = [a, ...overlapping].sort((x, y) =>
      x.time.localeCompare(y.time) || x._id.localeCompare(y._id)
    );
    const idx = group.findIndex(x => x._id === a._id);
    const n = group.length;
    const pct = 100 / n;
    return { left: `calc(${idx * pct}% + 2px)`, width: `calc(${pct}% - 4px)` };
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
    return { especes: 'Espèces', virement: 'Virement', en_ligne: 'En ligne', points: 'Points' }[m ?? ''] ?? '—';
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
