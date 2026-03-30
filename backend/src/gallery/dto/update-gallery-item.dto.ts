import { Type, Transform } from 'class-transformer';
import { IsOptional, IsString, IsBoolean, IsNumber, IsIn } from 'class-validator';

export class UpdateGalleryItemDto {
  @IsOptional()
  @IsString()
  alt?: string;

  @IsOptional()
  @IsIn(['', 'wide', 'tall', 'large'])
  span?: string;

  @IsOptional()
  @IsIn(['', 'coupe', 'barbe', 'degrade'])
  category?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  order?: number;
}
