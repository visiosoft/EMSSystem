import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Venue } from './venue.entity';
import { VenueComplex } from './venue-complex.entity';

@Entity({ name: 'VenueComplexMember', schema: 'dbo' })
export class VenueComplexMember {
  @PrimaryColumn({ name: 'VenueCompanyID', type: 'int' })
  venueCompanyId: number;

  @PrimaryColumn({ name: 'ComplexCompanyID', type: 'int' })
  complexCompanyId: number;

  @ManyToOne(() => Venue)
  @JoinColumn({ name: 'VenueCompanyID' })
  venue: Venue;

  @ManyToOne(() => VenueComplex)
  @JoinColumn({ name: 'ComplexCompanyID' })
  complex: VenueComplex;
}
