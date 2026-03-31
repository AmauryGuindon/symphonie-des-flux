import { Injectable, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface AppNotification {
  _id: string;
  userId: string;
  type: 'appointment_confirmed' | 'appointment_cancelled' | 'points_earned' | 'tier_up';
  message: string;
  read: boolean;
  createdAt: string;
}

const API = 'http://localhost:3000/api/notifications';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private _notifications = signal<AppNotification[]>([]);
  private _pollInterval: ReturnType<typeof setInterval> | null = null;

  notifications = this._notifications.asReadonly();
  unreadCount = computed(() => this._notifications().filter(n => !n.read).length);

  constructor(private http: HttpClient, private auth: AuthService) {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.load();
        this._pollInterval = setInterval(() => this.load(), 60_000);
      } else {
        this._notifications.set([]);
        if (this._pollInterval) {
          clearInterval(this._pollInterval);
          this._pollInterval = null;
        }
      }
    }, { allowSignalWrites: true });
  }

  load() {
    this.http.get<AppNotification[]>(`${API}/my`).subscribe({
      next: n => this._notifications.set(n),
      error: () => {},
    });
  }

  markAllRead() {
    return this.http.patch(`${API}/read`, {}).pipe(
      tap(() => this._notifications.update(ns => ns.map(n => ({ ...n, read: true })))),
    );
  }

  deleteOne(id: string) {
    return this.http.delete(`${API}/${id}`).pipe(
      tap(() => this._notifications.update(ns => ns.filter(n => n._id !== id))),
    );
  }

  deleteAll() {
    return this.http.delete(`${API}/all`).pipe(
      tap(() => this._notifications.set([])),
    );
  }
}
