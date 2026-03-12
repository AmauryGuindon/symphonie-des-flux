export class UpdateAppointmentDto {
  date?: string;
  time?: string;
  status?: 'pending' | 'confirmed' | 'cancelled';
  notes?: string;
}
