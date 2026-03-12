export class CreateAppointmentDto {
  serviceType: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:mm
  notes?: string;
}
