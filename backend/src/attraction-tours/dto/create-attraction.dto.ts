import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateAttractionDto {
  @IsString()
  @MaxLength(200)
  attractionName: string;

  @IsInt()
  @Min(1)
  classId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  attractionManagementLinkId?: number | null;
}
