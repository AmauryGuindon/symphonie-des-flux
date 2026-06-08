import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Visit } from './admin.service';

const API = 'http://localhost:3001/api/admin';

export interface CancelledAppointment {
  _id: string;
  clientName: string;
  serviceType: string;
  date: string;
  time: string;
  price: number;
}

export interface AccountingData {
  kpis: {
    revenue: number; visits: number; quarter: number; year: number;
    prevRevenue: number; prevVisits: number;
    cancelledCount: number; cancelledRevenue: number;
  };
  byService: { _id: string; total: number; count: number }[];
  byPayment: { _id: string; total: number; count: number }[];
  visits: Visit[];
  cancelledAppointments: CancelledAppointment[];
}

export interface ManualVisitDto {
  clientId?: string;
  clientName?: string;
  serviceType: string;
  price: number;
  paymentMethod?: string;
  visitDate?: string;
}

@Injectable({ providedIn: 'root' })
export class AccountingService {
  constructor(private http: HttpClient) {}

  getAccounting(period: string, date: string): Observable<AccountingData> {
    const params = new HttpParams().set('period', period).set('date', date);
    return this.http.get<AccountingData>(`${API}/accounting`, { params });
  }

  createManualVisit(dto: ManualVisitDto): Observable<Visit> {
    return this.http.post<Visit>(`${API}/accounting/visits`, dto);
  }

  deleteVisit(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/accounting/visits/${id}`);
  }
}
