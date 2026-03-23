import { IsNumber } from 'class-validator';

export class AdjustPointsDto {
  @IsNumber()
  delta: number;
}
