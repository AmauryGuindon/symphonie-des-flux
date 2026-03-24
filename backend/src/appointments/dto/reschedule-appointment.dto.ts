import { IsNotEmpty, IsString } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsNotEmpty()
  @IsString()
  date: string;

  @IsNotEmpty()
  @IsString()
  time: string;
}
