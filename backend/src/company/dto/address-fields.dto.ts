import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CITY_FIELD_VALIDATION_MESSAGE,
  COUNTRY_NAME_REGEX,
  COUNTRY_NAME_VALIDATION_MESSAGE,
  STATE_PROVINCE_FIELD_VALIDATION_MESSAGE,
} from '../constants/country-name.regex';

export class AddressFieldsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  addressLine1: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(COUNTRY_NAME_REGEX, { message: CITY_FIELD_VALIDATION_MESSAGE })
  city: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(COUNTRY_NAME_REGEX, { message: STATE_PROVINCE_FIELD_VALIDATION_MESSAGE })
  stateProvince: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postalCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(COUNTRY_NAME_REGEX, { message: COUNTRY_NAME_VALIDATION_MESSAGE })
  country: string;
}

export class AddressPayloadDto {
  @ValidateNested()
  @Type(() => AddressFieldsDto)
  physical: AddressFieldsDto;

  @IsOptional()
  mailingSameAsPhysical?: boolean;

  @ValidateNested()
  @Type(() => AddressFieldsDto)
  @IsOptional()
  mailing?: AddressFieldsDto;
}
