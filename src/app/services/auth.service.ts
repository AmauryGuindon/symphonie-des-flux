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
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/']);
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

  claimBirthdayBonus(): Observable<User> {
    return this.http.post<User>(`${this.API}/users/me/birthday-bonus`, {}).pipe(
      tap(user => {
        this._user.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }),
    );
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
