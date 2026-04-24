import React, { useId, useMemo } from 'react';
import { FormField } from './Primitives';
import { Select2 } from './Select2';
import {
  PHONE_COUNTRY_SELECT_OPTIONS,
  DEFAULT_PHONE_COUNTRY,
} from '@/lib/contactPhoneOptions';
import {
  type PhoneCountrySelection,
  formatPhoneDisplayForCountryInput,
  parsePhoneFieldValue,
} from '@/lib/contactPhoneField';

const inputCls =
  'w-full min-w-0 flex-1 bg-surface border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-ems-accent [font-variant-lining-nums:tabular-nums] disabled:cursor-not-allowed disabled:opacity-50';

const selectWrap = 'w-[min(20rem,100%)] sm:w-56 shrink-0';

type Props = {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  id?: string;
  country: PhoneCountrySelection;
  display: string;
  onCountry: (c: PhoneCountrySelection) => void;
  onDisplay: (display: string) => void;
};

/**
 * Country calling-code dropdown + AsYouType national number field (E.164 workflow).
 */
export function ContactPhoneRow({
  label,
  required,
  optional,
  error,
  id: idProp,
  country,
  display,
  onCountry,
  onDisplay,
}: Props) {
  const uid = useId();
  const id = idProp ?? uid;
  const countryOptions = useMemo(
    () => [
      { value: '', label: 'Select country…' },
      ...PHONE_COUNTRY_SELECT_OPTIONS,
    ],
    [],
  );
  return (
    <FormField
      label={label}
      required={required}
      optional={optional}
      error={error}
    >
      <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
        <div className={selectWrap}>
          <Select2
            options={countryOptions}
            value={country}
            onChange={(v) => {
              onCountry((v || '') as PhoneCountrySelection);
              onDisplay('');
            }}
            searchPlaceholder="Search by country or +code…"
            placeholder="Country / code"
          />
        </div>
        <input
          id={id}
          type="tel"
          className={inputCls}
          inputMode="tel"
          autoComplete="tel-national"
          value={display}
          placeholder="Phone number"
          disabled={!country}
          title={!country ? 'Select a country first' : undefined}
          onChange={(e) => {
            onDisplay(
              formatPhoneDisplayForCountryInput(e.target.value, country),
            );
          }}
          onPaste={(e) => {
            const t = e.clipboardData.getData('text').trim();
            if (t.startsWith('+')) {
              e.preventDefault();
              const p = parsePhoneFieldValue(t, DEFAULT_PHONE_COUNTRY);
              onCountry(p.country);
              onDisplay(p.display);
            }
          }}
          aria-invalid={error ? 'true' : undefined}
        />
      </div>
    </FormField>
  );
}
