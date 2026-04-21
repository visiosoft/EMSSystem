import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PROJECT_STAGE_VALUES } from './create-project.dto';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @IsIn(PROJECT_STAGE_VALUES as unknown as string[])
  projectStage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  createdBy?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tourId?: number;

  // Frontend-only fields — accepted and silently ignored (Option A per §5.8)
  @IsOptional() name?: string | null;
  @IsOptional() bookerId?: string | null;
  @IsOptional() agentContactId?: string | null;
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  dmaIds?: number[];
  @IsOptional() targetOnSale?: string | null;
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string | null;
}
