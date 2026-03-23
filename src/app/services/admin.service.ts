import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';

const API = 'http://localhost:3000/api/admin';

export interface Visit {
  _id: string;
  clientId: string;
  clientName?: string;
  serviceType: string;
  price: number;
  notes?: string;
  paymentMethod?: string;
  visitDate?: string;
  createdAt: string;
}

export interface ServiceConfig {
  _id: string;
  name: string;
  price: number;
  loyaltyPoints: number;
  active: boolean;
}

export interface DashboardStats {
  totalClients: number;
  newThisMonth: number;
  newClientsTrend: number | null;
  activeThisWeek: number;
  activeThisMonth: number;
  inactiveClients: number;
  neverVisited: number;
  tiers: { bronze: number; silver: number; gold: number; platinum: number };
  totalPoints: number;
  referralsThisMonth: number;
  retentionRate: number | null;
  recentClients: User[];
  topClientThisMonth: User | null;
  monthlyActivity: { month: string; newClients: number; activeClients: number }[];
  revenue: { today: number; week: number; month: number; year: number };
}

export interface LoyaltyStats {
  topClients: User[];
  tiers: { bronze: number; silver: number; gold: number; platinum: number };
  tierCounts: { _id: string; count: number; totalPoints: number }[];
  birthdayAvailable: User[];
}

export interface ReferralStats {
  topReferrers: User[];
  totalReferrals: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}

  // Dashboard
  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${API}/stats`);
  }

  // Clients
  getClients(search?: string): Observable<User[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<User[]>(`${API}/clients`, { params });
  }

  getClient(id: string): Observable<User> {
    return this.http.get<User>(`${API}/clients/${id}`);
  }

  updateClient(id: string, data: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${API}/clients/${id}`, data);
  }

  deleteClient(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/clients/${id}`);
  }

  recordVisit(id: string, serviceType: string, price: number, notes?: string): Observable<User> {
    return this.http.post<User>(`${API}/clients/${id}/visit`, { serviceType, price, notes });
  }

  getClientVisits(id: string): Observable<Visit[]> {
    return this.http.get<Visit[]>(`${API}/clients/${id}/visits`);
  }

  adjustPoints(id: string, delta: number): Observable<User> {
    return this.http.post<User>(`${API}/clients/${id}/points`, { delta });
  }

  // Configuration des prestations
  getServiceConfigs(): Observable<ServiceConfig[]> {
    return this.http.get<ServiceConfig[]>(`${API}/services`);
  }

  updateServiceConfig(id: string, data: Partial<Pick<ServiceConfig, 'price' | 'loyaltyPoints'>>): Observable<ServiceConfig> {
    return this.http.patch<ServiceConfig>(`${API}/services/${id}`, data);
  }

  createService(data: { name: string; price: number; loyaltyPoints: number }): Observable<ServiceConfig> {
    return this.http.post<ServiceConfig>(`${API}/services`, data);
  }

  toggleService(id: string): Observable<ServiceConfig> {
    return this.http.patch<ServiceConfig>(`${API}/services/${id}/toggle`, {});
  }

  // Fidélité
  getLoyaltyStats(): Observable<LoyaltyStats> {
    return this.http.get<LoyaltyStats>(`${API}/loyalty`);
  }

  // Parrainages
  getReferralStats(): Observable<ReferralStats> {
    return this.http.get<ReferralStats>(`${API}/referrals`);
  }
}
