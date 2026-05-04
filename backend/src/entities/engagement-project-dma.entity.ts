import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Junction: selected markets (dbo.DMA) for a project (dbo.EngagementProject). */
@Entity({ name: 'EngagementProjectDMA', schema: 'dbo' })
export class EngagementProjectDma {
  @PrimaryGeneratedColumn({ name: 'EngagementProjectDMAID' })
  engagementProjectDmaId: number;

  @Column({ name: 'EngagementProjectID', type: 'int' })
  engagementProjectId: number;

  @Column({ name: 'DMAID', type: 'int' })
  dmaid: number;
}
