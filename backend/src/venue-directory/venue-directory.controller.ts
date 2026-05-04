import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { VenueDirectoryService } from './venue-directory.service';

@Controller('venue-directory')
export class VenueDirectoryController {
  constructor(private readonly venueDirectoryService: VenueDirectoryService) {}

  /** All venue rows: dbo.Venue + Venue-type dbo.Company (1:1). */
  @Get('venues')
  listAllVenues(
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Query('q') q?: string,
    @Query('complexName') complexName?: string,
    @Query('complexCompanyId') complexCompanyIdRaw?: string,
    @Query('venueTypeId') venueTypeIdRaw?: string,
    @Query('dmaId') dmaIdRaw?: string,
    /** Comma-separated DMAIDs (markets); venues in any of those markets are returned. */
    @Query('dmaIds') dmaIdsRaw?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    const complexCompanyId = this.parseOptPosInt(complexCompanyIdRaw);
    const venueTypeId = this.parseOptPosInt(venueTypeIdRaw);
    const dmaId = this.parseOptPosInt(dmaIdRaw);
    const dmaIds = this.parseCommaSeparatedPositiveInts(dmaIdsRaw);
    return this.venueDirectoryService.listAllVenues(offset, limit, {
      q,
      complexName,
      complexCompanyId: complexCompanyId ?? undefined,
      venueTypeId: venueTypeId ?? undefined,
      dmaId: dmaId ?? undefined,
      dmaIds: dmaIds.length > 0 ? dmaIds : undefined,
      sortBy,
      sortDir,
    });
  }

  private parseCommaSeparatedPositiveInts(raw: string | undefined): number[] {
    if (raw == null || !String(raw).trim()) return [];
    const out: number[] = [];
    for (const part of String(raw).split(',')) {
      const n = parseInt(part.trim(), 10);
      if (Number.isFinite(n) && n >= 1) out.push(n);
    }
    return [...new Set(out)];
  }

  private parseOptPosInt(
    raw: string | undefined,
  ): number | null | undefined {
    if (raw == null || String(raw).trim() === '') return undefined;
    const n = parseInt(String(raw), 10);
    if (!Number.isFinite(n) || n < 1) return undefined;
    return n;
  }
}
