import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Engagement } from './engagement.entity';

/** dbo.Performance — one row per show / performance under an engagement (see EMS_DATABASE_ARCHITECTURE §4.27). */
@Entity({ name: 'Performance', schema: 'dbo' })
export class Performance {
  @PrimaryGeneratedColumn({ name: 'PerformanceID' })
  performanceId: number;

  @Column({ name: 'EngagementID', type: 'int' })
  engagementId: number;

  @ManyToOne(() => Engagement)
  @JoinColumn({ name: 'EngagementID' })
  engagement: Engagement;

  @Column({ name: 'PerformanceStatus', type: 'nvarchar', length: 50 })
  performanceStatus: string;

  @Column({ name: 'PerformanceDate', type: 'date' })
  performanceDate: string;

  /** SQL Server `time` — stored as string (e.g. 20:00:00). */
  @Column({ name: 'PerformanceTime', type: 'time' })
  performanceTime: string;
}
