import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  serviceType: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  time: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsIn(['especes', 'virement', 'en_ligne'])
  @IsOptional()
  paymentMethod?: string;
}
