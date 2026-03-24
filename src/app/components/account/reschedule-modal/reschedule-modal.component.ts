import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-reschedule-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reschedule-modal.component.html',
  styleUrl: './reschedule-modal.component.scss',
})
export class RescheduleModalComponent implements OnInit {
  @Input() appointmentId!: string;
  @Output() rescheduled = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  selectedDate = signal('');
  slots = signal<{ time: string; available: boolean }[]>([]);
  selectedTime = signal('');
  loading = signal(false);
  error = signal('');
  slotsLoading = signal(false);

  // Generate next 14 days (exclude Sundays)
  availableDates: string[] = [];

  constructor(private auth: AuthService) {}

  ngOnInit() {
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getDay() !== 0) { // 0 = Sunday
        this.availableDates.push(d.toISOString().slice(0, 10));
      }
    }
  }

  selectDate(date: string) {
    this.selectedDate.set(date);
    this.selectedTime.set('');
    this.slots.set([]);
    this.slotsLoading.set(true);
    this.auth.getAvailableSlots(date).subscribe({
      next: res => { this.slots.set(res.slots); this.slotsLoading.set(false); },
      error: () => this.slotsLoading.set(false),
    });
  }

  selectTime(time: string) {
    this.selectedTime.set(time);
  }

  confirm() {
    if (!this.selectedDate() || !this.selectedTime()) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.rescheduleAppointment(this.appointmentId, this.selectedDate(), this.selectedTime()).subscribe({
      next: () => { this.loading.set(false); this.rescheduled.emit(); },
      error: (err) => { this.error.set(err.error?.message ?? 'Erreur lors de la reprogrammation.'); this.loading.set(false); },
    });
  }

  formatDate(d: string): string {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
}
