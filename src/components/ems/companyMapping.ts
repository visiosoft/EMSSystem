import type { Company } from '@/data/constants';
import type { ApiCompanyListRow } from '@/api/companyApi';

export function mapApiCompanyToCompany(row: ApiCompanyListRow): Company {
  const pa = row.physicalAddress;
  const ma = row.mailingAddress;
  return {
    id: String(row.companyId),
    companyTypeId: row.companyTypeId,
    dmaId: row.dmaId,
    dmaMarketName: row.dmaMarketName,
    name: row.companyName,
    type: row.companyTypeName,
    city: pa?.city ?? '',
    state: pa?.stateProvince ?? '',
    dmaIds: row.dmaId != null ? [String(row.dmaId)] : [],
    serviceAreaDmaIds: [],
    physicalStreet: pa?.addressLine1 ?? '',
    physicalCity: pa?.city ?? '',
    physicalState: pa?.stateProvince ?? '',
    physicalPostalCode: pa?.postalCode ?? '',
    physicalCountry: pa?.country ?? '',
    mailingStreet: ma?.addressLine1 ?? '',
    mailingCity: ma?.city ?? '',
    mailingState: ma?.stateProvince ?? '',
    mailingPostalCode: ma?.postalCode ?? '',
    mailingCountry: ma?.country ?? '',
  };
}
