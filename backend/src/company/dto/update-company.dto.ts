import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AddressFieldsDto } from './address-fields.dto';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  companyTypeId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  dmaId?: number;

  @ValidateNested()
  @Type(() => AddressFieldsDto)
  @IsOptional()
  physical?: AddressFieldsDto;

  @ValidateNested()
  @Type(() => AddressFieldsDto)
  @IsOptional()
  mailing?: AddressFieldsDto;

  @IsOptional()
  mailingSameAsPhysical?: boolean;
}
