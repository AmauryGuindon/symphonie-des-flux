import {
  IsString, IsNotEmpty, IsNumber, IsOptional,
  IsIn, IsDateString, Min,
} from 'class-validator';

export class CreateManualVisitDto {
  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsNotEmpty()
  serviceType: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  @IsIn(['especes', 'virement'])
  paymentMethod?: string;

  @IsDateString()
  @IsOptional()
  visitDate?: string;
}
