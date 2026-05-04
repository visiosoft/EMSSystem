import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Select2, toOptions } from './Select2';
import type { Company } from '@/data/constants';
import type { ApiSeatingType } from '@/api/companyApi';
import {
  fetchVenueTicketing,
  updateVenueTicketing,
} from '@/api/companyApi';
import { friendlyApiError } from '@/lib/friendlyApiError';
import { TICKETING_SYSTEM_OPTIONS } from '@/lib/ticketingSystemOptions';

interface Props {
  company: Company;
  seatingTypes: ApiSeatingType[];
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function CompanyTicketingPanel({
  company,
  seatingTypes,
  addToast,
}: Props) {
  const companyId = Number(company.id);
  const qc = useQueryClient();
  const vq = useQuery({
    queryKey: ['companies', company.id, 'venue-ticketing'],
    queryFn: () => fetchVenueTicketing(companyId),
    enabled: Number.isFinite(companyId),
  });

  const [ticketingSystem, setTicketingSystem] = useState('');
  const [venueWebsite, setVenueWebsite] = useState('');
  const [seatingTypeId, setSeatingTypeId] = useState<string>('');
  const [savingSeating, setSavingSeating] = useState(false);

  useEffect(() => {
    const v = vq.data;
    if (!v) {
      setSeatingTypeId('');
      return;
    }
    if (v.seatingTypeId != null) {
      setSeatingTypeId(String(v.seatingTypeId));
    } else {
      setSeatingTypeId('');
    }
  }, [vq.data]);

  const seatingOptions = useMemo(
    () =>
      seatingTypes.map((s) => ({
        value: String(s.seatingTypeId),
        label: s.seatingName,
      })),
    [seatingTypes],
  );

  const inputCls =
    'w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/90 focus:outline-none focus:border-ems-accent focus:ring-1 focus:ring-ems-accent/20';
  const labelCls = 'text-sm font-medium text-text-secondary block mb-1.5';
  const subCls = 'text-xs text-text-muted block mb-2';

  const savePersisted = async () => {
    setSavingSeating(true);
    try {
      const id =
        seatingTypeId === '' ? null : Number.parseInt(seatingTypeId, 10);
      const res = await updateVenueTicketing(companyId, {
        seatingTypeId: Number.isFinite(id as number) ? id : null,
      });
      if (!res.updated) {
        addToast(
          'Add a venue profile on the Venue Profile tab before ticketing can be saved.',
          'warning',
        );
        return;
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['companies', company.id, 'venue-ticketing'] }),
        qc.invalidateQueries({ queryKey: ['companies', company.id, 'venue-profile'] }),
        qc.invalidateQueries({ queryKey: ['companies', company.id, 'venue-details'] }),
      ]);
      addToast('Ticketing details saved.', 'success');
    } catch (e) {
      addToast(friendlyApiError(e, 'Could not save ticketing details.'), 'error');
    } finally {
      setSavingSeating(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-text-primary tracking-tight">
          Ticketing
        </h3>
      </header>

      <div className="rounded-xl border border-border bg-card/40 p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className={labelCls}>Ticketing system</span>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 block mb-2">
              Not Stored In Database
            </p>
            <Select2
              options={toOptions([...TICKETING_SYSTEM_OPTIONS])}
              value={ticketingSystem}
              onChange={setTicketingSystem}
              placeholder="Select system…"
              allowClear
            />
          </div>
          <div>
            <span className={labelCls}>Seating type (persisted)</span>
            <p className={`${subCls} flex items-center gap-2`}>
              {vq.isLoading ? (
                <>
                  <Loader2
                    className="h-3.5 w-3.5 shrink-0 animate-spin text-ems-accent"
                    aria-hidden
                  />
                  <span>Loading venue details…</span>
                </>
              ) : vq.data == null ? (
                'No venue profile yet — save will show a warning.'
              ) : (
                `Current: ${vq.data.seatingTypeName ?? '—'}`
              )}
            </p>
            {seatingTypes.length === 0 && (
              <p className="text-xs text-amber-800 dark:text-amber-400/90 mb-2 leading-relaxed">
                No seating types in the database (dbo.SeatingType is empty). Populate that lookup
                table to see choices here.
              </p>
            )}
            <Select2
              options={[{ value: '', label: 'Clear…' }, ...seatingOptions]}
              value={seatingTypeId}
              onChange={setSeatingTypeId}
              placeholder="Select type…"
              allowClear
            />
          </div>
          <div className="md:col-span-2">
            <span className={labelCls}>Venue website</span>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 block mb-2">
              Not Stored In Database
            </p>
            <input
              className={inputCls}
              type="url"
              value={venueWebsite}
              onChange={(e) => setVenueWebsite(e.target.value)}
              placeholder="https://example.com/tickets"
            />
          </div>
        </div>
        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="button"
            disabled={savingSeating || vq.isLoading}
            onClick={() => void savePersisted()}
            className="inline-flex items-center justify-center gap-2 min-w-[10rem] rounded-md bg-ems-accent px-5 py-2.5 text-sm font-semibold text-background hover:bg-ems-accent/90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {savingSeating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              'Save ticketing'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
