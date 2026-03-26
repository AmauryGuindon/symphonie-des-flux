import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface TimeSlot { time: string; available: boolean; }
export interface SlotsResponse { date: string; slots: TimeSlot[]; closed: boolean; }

export interface BusinessConfig {
  openDays: number[];
  openTime: string;
  closeTime: string;
  slotDuration: number;
  closedDates: string[];
}

export interface Appointment {
  _id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  serviceType: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes?: string;
  paymentMethod?: string;
  createdAt: string;
}

const API = 'http://localhost:3000/api';

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  constructor(private http: HttpClient) {}

  getPublicServices() {
    return this.http.get<{ _id: string; name: string; price: number; loyaltyPoints: number; duration: number }[]>(`${API}/appointments/services`);
  }

  getSlots(date: string) {
    return this.http.get<SlotsResponse>(`${API}/appointments/slots?date=${date}`);
  }

  bookAppointment(dto: { serviceType: string; date: string; time: string; notes?: string; paymentMethod?: string }) {
    return this.http.post<Appointment>(`${API}/appointments`, dto);
  }

  getMyAppointments() {
    return this.http.get<Appointment[]>(`${API}/appointments/my`);
  }

  cancelAppointment(id: string) {
    return this.http.patch<Appointment>(`${API}/appointments/${id}/cancel`, {});
  }

  getPublicSchedule() {
    return this.http.get<BusinessConfig>(`${API}/appointments/schedule`);
  }

  // Admin
  getAdminAppointments(from?: string, to?: string) {
    let url = `${API}/admin/appointments`;
    const params: string[] = [];
    if (from) params.push(`from=${from}`);
    if (to) params.push(`to=${to}`);
    if (params.length) url += '?' + params.join('&');
    return this.http.get<Appointment[]>(url);
  }

  updateAdminAppointment(id: string, dto: Partial<Appointment>) {
    return this.http.patch<Appointment>(`${API}/admin/appointments/${id}`, dto);
  }

  deleteAdminAppointment(id: string) {
    return this.http.delete(`${API}/admin/appointments/${id}`);
  }

  getAdminSchedule() {
    return this.http.get<BusinessConfig>(`${API}/admin/schedule`);
  }

  updateAdminSchedule(dto: Partial<BusinessConfig>) {
    return this.http.patch<BusinessConfig>(`${API}/admin/schedule`, dto);
  }
}
