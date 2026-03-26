import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AppointmentService, TimeSlot, BusinessConfig } from '../../services/appointment.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-appointment-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './appointment-booking.component.html',
  styleUrl: './appointment-booking.component.scss',
})
export class AppointmentBookingComponent implements OnInit {
  // Auth
  isAuth = computed(() => this.auth.isAuthenticated());
  userPoints = computed(() => this.auth.user()?.loyaltyPoints ?? 0);

  // Services
  services = signal<{ _id: string; name: string; price: number; duration: number }[]>([]);
  selectedService = signal('');

  selectedServiceObj = computed(() =>
    this.services().find(s => s.name === this.selectedService()) ?? null,
  );
  requiredPoints = computed(() => (this.selectedServiceObj()?.price ?? 0) * 10);
  pointsNeeded = computed(() => Math.max(0, this.requiredPoints() - this.userPoints()));
  canPayWithPoints = computed(() =>
    this.isAuth() && this.requiredPoints() > 0 && this.userPoints() >= this.requiredPoints(),
  );

  allSlotsTaken = computed(() =>
    this.slots().length > 0 && this.slots().every(s => !s.available),
  );

  // Schedule config (dynamic from API)
  private scheduleConfig: BusinessConfig = {
    openDays: [1, 2, 3, 4, 5, 6],
    openTime: '09:00',
    closeTime: '19:00',
    slotDuration: 60,
    closedDates: [],
  };

  // Calendar
  today = new Date();
  currentMonth = signal(new Date(this.today.getFullYear(), this.today.getMonth(), 1));
  selectedDate = signal<string | null>(null);

  calendarDays = computed<Date[]>(() => this.buildCalendar(this.currentMonth()));

  // Slots
  slots = signal<TimeSlot[]>([]);
  slotsLoading = signal(false);
  closed = signal(false);
  selectedTime = signal<string | null>(null);

  // Booking
  notes = '';
  paymentMethod = '';
  bookLoading = signal(false);
  bookError = signal('');
  bookSuccess = signal(false);

  // My appointments
  myAppointments = signal<any[]>([]);
  myTab = signal<'book' | 'mine'>('book');

  switchTab(tab: 'book' | 'mine') {
    this.myTab.set(tab);
    setTimeout(() => {
      document.querySelectorAll('.reveal:not(.revealed)').forEach(el => {
        el.classList.add('revealed');
      });
    }, 50);
  }

  constructor(
    private appointmentService: AppointmentService,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.appointmentService.getPublicServices().subscribe({
      next: s => {
        this.services.set(s);
        if (s.length) this.selectedService.set(s[0].name);
      },
    });
    this.appointmentService.getPublicSchedule().subscribe({
      next: cfg => { this.scheduleConfig = cfg; },
    });
    if (this.auth.isAuthenticated()) {
      this.loadMyAppointments();
    }
  }

  // ── Calendar ──────────────────────────────────────────────────────────────

  private buildCalendar(firstOfMonth: Date): Date[] {
    const year = firstOfMonth.getFullYear();
    const month = firstOfMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay + 6) % 7; // lundi = 0

    const cells: Date[] = [];

    // Jours du mois précédent pour compléter la première semaine
    for (let j = 0; j < offset; j++) {
      cells.push(new Date(year, month, 1 - offset + j));
    }
    // Jours du mois courant
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(year, month, d));
    }
    // Jours du mois suivant pour compléter la dernière semaine
    const tail = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= tail; d++) {
      cells.push(new Date(year, month + 1, d));
    }
    return cells;
  }

  get monthLabel(): string {
    return this.currentMonth().toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  }

  prevMonth() {
    const m = this.currentMonth();
    this.currentMonth.set(new Date(m.getFullYear(), m.getMonth() - 1, 1));
    this.selectedDate.set(null);
    this.slots.set([]);
  }

  nextMonth() {
    const m = this.currentMonth();
    this.currentMonth.set(new Date(m.getFullYear(), m.getMonth() + 1, 1));
    this.selectedDate.set(null);
    this.slots.set([]);
  }

  // Bloque uniquement les jours strictement passés (aujourd'hui reste sélectionnable)
  isPast(d: Date): boolean {
    const today = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());
    return d < today;
  }

  isClosedDay(d: Date): boolean {
    const weekday = d.getDay();
    const ds = this.toDateString(d);
    return !this.scheduleConfig.openDays.includes(weekday) ||
           this.scheduleConfig.closedDates.includes(ds);
  }

  toDateString(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  selectDate(d: Date | null) {
    if (!d || this.isPast(d) || this.isClosedDay(d)) return;
    const ds = this.toDateString(d);
    this.selectedDate.set(ds);
    this.selectedTime.set(null);
    this.loadSlots(ds);
  }

  private loadSlots(date: string) {
    this.slotsLoading.set(true);
    this.appointmentService.getSlots(date).subscribe({
      next: res => {
        this.slots.set(res.slots);
        this.closed.set(res.closed);
        this.slotsLoading.set(false);
      },
      error: () => this.slotsLoading.set(false),
    });
  }

  // ── Booking ───────────────────────────────────────────────────────────────

  book() {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { redirect: '/appointment' } });
      return;
    }
    const date = this.selectedDate();
    const time = this.selectedTime();
    if (!date || !time || !this.selectedService() || !this.paymentMethod) return;

    this.bookLoading.set(true);
    this.bookError.set('');
    this.appointmentService.bookAppointment({
      serviceType: this.selectedService(),
      date,
      time,
      notes: this.notes || undefined,
      paymentMethod: this.paymentMethod,
    }).subscribe({
      next: () => {
        this.bookLoading.set(false);
        this.bookSuccess.set(true);
        this.loadSlots(date);
        this.loadMyAppointments();
        this.notes = '';
        this.paymentMethod = '';
        this.selectedTime.set(null);
      },
      error: (e) => {
        this.bookLoading.set(false);
        this.bookError.set(e.error?.message ?? 'Erreur lors de la réservation.');
      },
    });
  }

  // ── My Appointments ───────────────────────────────────────────────────────

  loadMyAppointments() {
    this.appointmentService.getMyAppointments().subscribe({
      next: a => this.myAppointments.set(a),
    });
  }

  cancel(id: string) {
    this.appointmentService.cancelAppointment(id).subscribe({
      next: () => this.loadMyAppointments(),
    });
  }

  formatDate(ds: string): string {
    const [y, m, d] = ds.split('-');
    return `${d}/${m}/${y}`;
  }

  statusLabel(s: string): string {
    return { pending: 'En attente', confirmed: 'Confirmé', cancelled: 'Annulé' }[s] ?? s;
  }

  statusClass(s: string): string {
    return { pending: 'appt__status--pending', confirmed: 'appt__status--confirmed', cancelled: 'appt__status--cancelled' }[s] ?? '';
  }
}
