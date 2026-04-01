import { IsArray, IsInt, IsOptional, IsString, Matches, Min, Max } from 'class-validator';

export class UpdateBusinessConfigDto {
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @IsOptional()
  openDays?: number[];

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  @IsOptional()
  openTime?: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  @IsOptional()
  closeTime?: string;

  @IsInt()
  @Min(15)
  @Max(120)
  @IsOptional()
  slotDuration?: number;

  @IsInt()
  @Min(0)
  @Max(60)
  @IsOptional()
  bufferMinutes?: number;

  @IsString()
  @Matches(/^(\d{2}:\d{2})?$/)
  @IsOptional()
  breakStart?: string;

  @IsString()
  @Matches(/^(\d{2}:\d{2})?$/)
  @IsOptional()
  breakEnd?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  closedDates?: string[];
}
