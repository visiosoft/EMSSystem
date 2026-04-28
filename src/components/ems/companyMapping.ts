import type { Company } from '@/data/constants';
import type { ApiCompanyListRow } from '@/api/companyApi';
import {
  toCountryAlpha2FromDisplayString,
  toStateProvinceAbbrevForDisplay,
} from '@/lib/addressAbbrev';

export function mapApiCompanyToCompany(row: ApiCompanyListRow): Company {
  const pa = row.physicalAddress;
  const ma = row.mailingAddress;
  const physCountry = toCountryAlpha2FromDisplayString(pa?.country ?? '');
  const mailCountry = toCountryAlpha2FromDisplayString(ma?.country ?? '') || physCountry;
  return {
    id: String(row.companyId),
    companyTypeId: row.companyTypeId,
    dmaId: row.dmaId,
    dmaMarketName: row.dmaMarketName,
    name: row.companyName,
    type: row.companyTypeName,
    city: pa?.city ?? '',
    state: toStateProvinceAbbrevForDisplay(pa?.stateProvince ?? '', physCountry),
    dmaIds: row.dmaId != null ? [String(row.dmaId)] : [],
    serviceAreaDmaIds: [],
    physicalStreet: pa?.addressLine1 ?? '',
    physicalCity: pa?.city ?? '',
    physicalState: toStateProvinceAbbrevForDisplay(pa?.stateProvince ?? '', physCountry),
    physicalPostalCode: pa?.postalCode ?? '',
    physicalCountry: physCountry,
    mailingStreet: ma?.addressLine1 ?? '',
    mailingCity: ma?.city ?? '',
    mailingState: toStateProvinceAbbrevForDisplay(ma?.stateProvince ?? '', mailCountry),
    mailingPostalCode: ma?.postalCode ?? '',
    mailingCountry: mailCountry,
  };
}
