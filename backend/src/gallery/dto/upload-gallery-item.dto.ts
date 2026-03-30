import { IsOptional, IsString, IsIn } from 'class-validator';

export class UploadGalleryItemDto {
  @IsOptional()
  @IsString()
  alt?: string;

  @IsOptional()
  @IsIn(['', 'wide', 'tall', 'large'])
  span?: string;

  @IsOptional()
  @IsIn(['', 'coupe', 'barbe', 'degrade'])
  category?: string;
}
