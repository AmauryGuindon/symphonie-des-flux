import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppointmentService, BusinessConfig } from '../../../services/appointment.service';

const DAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

@Component({
  selector: 'app-admin-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
})
export class AdminScheduleComponent implements OnInit {
  loading = signal(true);
  saving = signal(false);
  saved = signal(false);

  openDays: boolean[] = Array(7).fill(false);
  openTime = '09:00';
  closeTime = '19:00';
  slotDuration = 30;
  breakStart = '13:00';
  breakEnd = '14:00';
  closedDates: string[] = [];
  newClosedDate = '';
  rangeStart = '';
  rangeEnd = '';

  readonly today = new Date().toISOString().split('T')[0];
  readonly DAY_LABELS = DAY_LABELS;
  readonly SLOT_OPTIONS = [15, 30, 45, 60];

  constructor(private appointmentService: AppointmentService) {}

  ngOnInit() {
    this.appointmentService.getAdminSchedule().subscribe({
      next: cfg => {
        this.openDays = Array.from({ length: 7 }, (_, i) => cfg.openDays.includes(i));
        this.openTime = cfg.openTime;
        this.closeTime = cfg.closeTime;
        this.slotDuration = cfg.slotDuration;
        this.breakStart = cfg.breakStart ?? '13:00';
        this.breakEnd = cfg.breakEnd ?? '14:00';
        // Supprimer automatiquement les dates passées
        this.closedDates = cfg.closedDates.filter(d => d >= this.today).sort();
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleDay(i: number) {
    this.openDays[i] = !this.openDays[i];
  }

  addClosedDate() {
    const d = this.newClosedDate.trim();
    if (!d || d < this.today || this.closedDates.includes(d)) return;
    this.closedDates = [...this.closedDates, d].sort();
    this.newClosedDate = '';
  }

  addDateRange() {
    if (!this.rangeStart || !this.rangeEnd || this.rangeStart > this.rangeEnd) return;
    const added: string[] = [];
    const current = new Date(this.rangeStart + 'T12:00:00');
    const end = new Date(this.rangeEnd + 'T12:00:00');
    while (current <= end) {
      const ds = current.toISOString().split('T')[0];
      if (!this.closedDates.includes(ds)) added.push(ds);
      current.setDate(current.getDate() + 1);
    }
    this.closedDates = [...this.closedDates, ...added].sort();
    this.rangeStart = '';
    this.rangeEnd = '';
  }

  removeClosedDate(d: string) {
    this.closedDates = this.closedDates.filter(x => x !== d);
  }

  formatDate(ds: string): string {
    const [y, m, day] = ds.split('-');
    return `${day}/${m}/${y}`;
  }

  save() {
    this.saving.set(true);
    const dto: Partial<BusinessConfig> = {
      openDays: this.openDays.reduce<number[]>((acc, open, i) => { if (open) acc.push(i); return acc; }, []),
      openTime: this.openTime,
      closeTime: this.closeTime,
      slotDuration: this.slotDuration,
      breakStart: this.breakStart,
      breakEnd: this.breakEnd,
      closedDates: this.closedDates,
    };
    this.appointmentService.updateAdminSchedule(dto).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2500);
      },
      error: () => this.saving.set(false),
    });
  }
}
