import { IsString, IsIn, IsOptional } from 'class-validator';

export class UpdateAppointmentDto {
  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  time?: string;

  @IsString()
  @IsIn(['pending', 'confirmed', 'cancelled'])
  @IsOptional()
  status?: 'pending' | 'confirmed' | 'cancelled';

  @IsString()
  @IsOptional()
  notes?: string;
}
