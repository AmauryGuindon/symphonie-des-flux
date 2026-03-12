import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';

export class RecordVisitDto {
  @IsString()
  @IsNotEmpty()
  serviceType: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
