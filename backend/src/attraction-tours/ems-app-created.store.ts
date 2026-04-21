import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

interface StoreShape {
  attractionIds: number[];
  tourIds: number[];
  engagementIds: number[];
}

/**
 * Tracks Attraction/Tour/Engagement rows created through this API so deletes
 * can be restricted without altering the database schema.
 */
@Injectable()
export class EmsAppCreatedStore implements OnModuleInit {
  private readonly logger = new Logger(EmsAppCreatedStore.name);
  private data: StoreShape = {
    attractionIds: [],
    tourIds: [],
    engagementIds: [],
  };

  private get filePath(): string {
    const cwd = process.cwd();
    const base = cwd.endsWith('backend') ? cwd : join(cwd, 'backend');
    const dir = join(base, 'data');
    return join(dir, 'ems-app-created-ids.json');
  }

  onModuleInit() {
    this.load();
  }

  private load() {
    const fp = this.filePath;
    try {
      if (!existsSync(fp)) {
        this.data = { attractionIds: [], tourIds: [], engagementIds: [] };
        return;
      }
      const raw = readFileSync(fp, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoreShape>;
      this.data = {
        attractionIds: Array.isArray(parsed.attractionIds)
          ? parsed.attractionIds.map(Number).filter((n) => Number.isFinite(n))
          : [],
        tourIds: Array.isArray(parsed.tourIds)
          ? parsed.tourIds.map(Number).filter((n) => Number.isFinite(n))
          : [],
        engagementIds: Array.isArray(parsed.engagementIds)
          ? parsed.engagementIds.map(Number).filter((n) => Number.isFinite(n))
          : [],
      };
    } catch (e) {
      this.logger.warn(`Could not load ${fp}: ${e}`);
      this.data = { attractionIds: [], tourIds: [], engagementIds: [] };
    }
  }

  private persist() {
    const fp = this.filePath;
    try {
      mkdirSync(dirname(fp), { recursive: true });
      writeFileSync(fp, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      this.logger.error(`Could not persist EMS app-created IDs: ${e}`);
      throw e;
    }
  }

  // ─── Record ───────────────────────────────────────────────────────────────

  recordAttraction(id: number) {
    if (!this.data.attractionIds.includes(id)) {
      this.data.attractionIds.push(id);
      this.persist();
    }
  }

  recordTour(id: number) {
    if (!this.data.tourIds.includes(id)) {
      this.data.tourIds.push(id);
      this.persist();
    }
  }

  recordEngagement(id: number) {
    if (!this.data.engagementIds.includes(id)) {
      this.data.engagementIds.push(id);
      this.persist();
    }
  }

  // ─── Remove (after successful DB delete) ─────────────────────────────────

  removeAttraction(id: number) {
    const idx = this.data.attractionIds.indexOf(id);
    if (idx !== -1) {
      this.data.attractionIds.splice(idx, 1);
      this.persist();
    }
  }

  removeTour(id: number) {
    const idx = this.data.tourIds.indexOf(id);
    if (idx !== -1) {
      this.data.tourIds.splice(idx, 1);
      this.persist();
    }
  }

  removeEngagement(id: number) {
    const idx = this.data.engagementIds.indexOf(id);
    if (idx !== -1) {
      this.data.engagementIds.splice(idx, 1);
      this.persist();
    }
  }

  // ─── Query ────────────────────────────────────────────────────────────────

  canDeleteAttraction(id: number): boolean {
    return this.data.attractionIds.includes(id);
  }

  canDeleteTour(id: number): boolean {
    return this.data.tourIds.includes(id);
  }

  canDeleteEngagement(id: number): boolean {
    return this.data.engagementIds.includes(id);
  }
}