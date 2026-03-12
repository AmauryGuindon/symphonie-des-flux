import { IsNumber, Min, IsOptional } from 'class-validator';

export class UpdateServiceConfigDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsNumber()
  @Min(0)
  loyaltyPoints: number;
}
