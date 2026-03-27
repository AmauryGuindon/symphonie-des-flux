import { IsString, IsNotEmpty, IsIn, IsOptional, IsArray } from 'class-validator';

export class SendNewsletterDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsIn(['all', 'active', 'inactive', 'never', 'tier_bronze', 'tier_silver', 'tier_gold', 'tier_platinum'])
  filter: string;

  @IsString()
  @IsOptional()
  ctaLabel?: string;

  @IsString()
  @IsOptional()
  ctaUrl?: string;

  @IsString()
  @IsOptional()
  bannerUrl?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  clientIds?: string[];
}
