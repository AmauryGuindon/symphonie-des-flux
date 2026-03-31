import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { User, AuthResponse } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = 'http://localhost:3000/api';
  private readonly TOKEN_KEY = 'dany1st_token';
  private readonly USER_KEY = 'dany1st_user';

  private _user = signal<User | null>(this.loadUser());
  private _token = signal<string | null>(localStorage.getItem(this.TOKEN_KEY));

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  constructor(private http: HttpClient, private router: Router) {}

  register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
    birthDate?: string;
    referralCode?: string;
  }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/auth/register`, data).pipe(
      tap(res => this.saveSession(res)),
    );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/auth/login`, { email, password }).pipe(
      tap(res => this.saveSession(res)),
    );
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/']);
  }

  /** Appel interne : session expirée côté serveur → rediriger vers /login */
  expireSession(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  private clearSession(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._token.set(null);
    this._user.set(null);
  }

  getToken(): string | null {
    return this._token();
  }

  refreshUser(): Observable<User> {
    return this.http.get<User>(`${this.API}/users/me`).pipe(
      tap(user => {
        this._user.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }),
    );
  }

  updateProfile(data: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.API}/users/me`, data).pipe(
      tap(user => {
        this._user.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }),
    );
  }

  uploadProfilePicture(file: File): Observable<User> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<User>(`${this.API}/users/me/profile-picture`, formData).pipe(
      tap(user => {
        this._user.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }),
    );
  }

  deleteProfilePicture(): Observable<User> {
    return this.http.delete<User>(`${this.API}/users/me/profile-picture`).pipe(
      tap(user => {
        this._user.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }),
    );
  }

  claimBirthdayBonus(): Observable<User> {
    return this.http.post<User>(`${this.API}/users/me/birthday-bonus`, {}).pipe(
      tap(user => {
        this._user.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }),
    );
  }

  getMyVisits(limit = 10): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/users/me/visits?limit=${limit}`);
  }

  getMyPointsHistory(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/users/me/points-history`);
  }

  getMyAppointments(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/appointments/my`);
  }

  cancelAppointment(id: string): Observable<any> {
    return this.http.patch(`${this.API}/appointments/${id}/cancel`, {});
  }

  rescheduleAppointment(id: string, date: string, time: string): Observable<any> {
    return this.http.patch(`${this.API}/appointments/${id}/reschedule`, { date, time });
  }

  getAvailableSlots(date: string): Observable<{ slots: { time: string; available: boolean }[] }> {
    return this.http.get<any>(`${this.API}/appointments/slots?date=${date}`);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API}/auth/change-password`, { currentPassword, newPassword });
  }

  private saveSession(res: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, res.accessToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
    this._token.set(res.accessToken);
    this._user.set(res.user);
  }

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
