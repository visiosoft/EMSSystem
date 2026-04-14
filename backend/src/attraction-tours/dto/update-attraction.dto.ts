import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateAttractionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  attractionName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  classId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  attractionManagementLinkId?: number | null;
}
