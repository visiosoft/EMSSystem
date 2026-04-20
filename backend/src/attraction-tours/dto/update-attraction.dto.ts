import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAttractionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  attractionName?: string;
}
