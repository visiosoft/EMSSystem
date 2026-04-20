import { IsString, MaxLength } from 'class-validator';

/**
 * dbo.Attraction only stores: AttractionName, AttractionManagementLinkID
 * ClassID was removed from Attraction — it lives on Tour.
 */
export class CreateAttractionDto {
  @IsString()
  @MaxLength(200)
  attractionName: string;
}
