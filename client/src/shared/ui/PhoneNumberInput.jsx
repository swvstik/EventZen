import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { HiChevronDown } from 'react-icons/hi';
import { PHONE_COUNTRIES, getPhoneCountryByDialCode } from '@/shared/constants/phoneCountries';

export default function PhoneNumberInput({
  label = 'Phone',
  countryCode,
  localNumber,
  onCountryCodeChange,
  onLocalNumberChange,
  error,
  localInputId,
  localInputName = 'phone',
  localAutoComplete = 'tel-national',
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  const generatedId = useId().replace(/:/g, '');
  const phoneInputId = localInputId || `phone-local-${generatedId}`;
  const countryPickerId = `phone-country-${generatedId}`;

  const selectedCountry = useMemo(
    () => getPhoneCountryByDialCode(countryCode),
    [countryCode]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!pickerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div>
      <label className="neo-label" htmlFor={phoneInputId}>{label}</label>
      <div className="flex gap-2 items-stretch">
        <div className="relative w-[112px] sm:w-[142px] flex-shrink-0" ref={pickerRef}>
          <button
            id={countryPickerId}
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="neo-input h-full px-3 flex items-center justify-between gap-2"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={`${countryPickerId}-listbox`}
            aria-label={`Select country code. Current code ${selectedCountry.dialCode}`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <selectedCountry.Flag
                title={selectedCountry.name}
                className="h-4 w-6 border border-neo-black"
              />
              <span className="font-heading text-[11px] uppercase tracking-wide">
                {selectedCountry.dialCode}
              </span>
            </span>
            <HiChevronDown className={`h-4 w-4 text-neo-black transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div
              id={`${countryPickerId}-listbox`}
              role="listbox"
              className="absolute z-30 mt-2 w-full max-h-72 overflow-auto bg-neo-white border-3 border-neo-black shadow-neo"
            >
              {PHONE_COUNTRIES.map((country) => (
                <button
                  type="button"
                  key={`${country.iso2}-${country.dialCode}`}
                  onClick={() => {
                    onCountryCodeChange(country.dialCode);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 flex items-center justify-between gap-3 text-left
                             border-b-2 border-neo-black/15 hover:bg-neo-cream"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <country.Flag
                      title={country.name}
                      className="h-4 w-6 border border-neo-black"
                    />
                    <span className="font-body text-xs truncate">{country.name}</span>
                  </span>
                  <span className="font-heading text-[11px] uppercase">{country.dialCode}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          id={phoneInputId}
          name={localInputName}
          type="tel"
          value={localNumber}
          onChange={(event) => onLocalNumberChange(event.target.value.replace(/\D/g, ''))}
          className="neo-input flex-1 min-w-0"
          placeholder="9876543210"
          inputMode="numeric"
          autoComplete={localAutoComplete}
        />
      </div>

      {error && <p className="font-body text-xs text-neo-red mt-1">{error}</p>}
    </div>
  );
}
