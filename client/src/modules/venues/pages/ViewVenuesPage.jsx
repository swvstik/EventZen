import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HiLocationMarker } from 'react-icons/hi';
import { eventsApi, venuesApi } from '@/shared/api';
import { EmptyState, PageHeader } from '@/shared/ui';
import {
  formatWindowDate,
  formatWindowTime,
  isWindowOverlapping,
  normalizeEventAvailabilityByVenue,
  toTimestamp,
} from '@/shared/utils/availability';

const EVENTS_FETCH_PAGE_SIZE = 200;
const EVENTS_FETCH_MAX_PAGES = 6;

async function fetchEventsSnapshot() {
  const rows = [];
  for (let page = 0; page < EVENTS_FETCH_MAX_PAGES; page += 1) {
    const response = await eventsApi.getAll({ page, limit: EVENTS_FETCH_PAGE_SIZE });
    const payload = response?.data || {};
    const pageRows = Array.isArray(payload?.events) ? payload.events : [];
    rows.push(...pageRows);

    const totalPages = Number(payload?.totalPages || 0);
    if (pageRows.length === 0 || (totalPages > 0 && page >= totalPages - 1)) {
      break;
    }
  }
  return rows;
}


function mergeAvailabilityWindows(primary = {}, fallback = {}) {
  const merged = {};
  const venueIds = new Set([...Object.keys(primary), ...Object.keys(fallback)]);

  venueIds.forEach((venueId) => {
    const seen = new Set();
    const next = [];
    [...(primary[venueId] || []), ...(fallback[venueId] || [])].forEach((window) => {
      const key = `${window.startTime}-${window.endTime}-${window.eventId || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      next.push(window);
    });
    merged[venueId] = next;
  });

  return merged;
}

function toStatusLabel(value) {
  return String(value || 'BOOKED').replaceAll('_', ' ');
}

export default function ViewVenuesPage() {
  const [windowStartInput, setWindowStartInput] = useState('');
  const [windowEndInput, setWindowEndInput] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [minCapacityInput, setMinCapacityInput] = useState('');
  const [availabilityInput, setAvailabilityInput] = useState('ALL');
  const [appliedFilters, setAppliedFilters] = useState({
    start: '',
    end: '',
    city: '',
    minCapacity: '',
    availability: 'ALL',
  });

  const { data: venuesData, isLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: () => venuesApi.getAll().then((r) => r.data?.venues || r.data || []),
  });

  const venues = Array.isArray(venuesData) ? venuesData : [];

  const { data: allEventsData } = useQuery({
    queryKey: ['events-for-view-venues-availability'],
    queryFn: fetchEventsSnapshot,
  });

  const derivedEventAvailabilityByVenue = normalizeEventAvailabilityByVenue(
    Array.isArray(allEventsData) ? allEventsData : []
  );

  const { data: availabilityByVenue = {} } = useQuery({
    queryKey: ['venues-view-availability', venues.map((v) => v.id).join(',')],
    queryFn: async () => {
      try {
        const response = await venuesApi.getAvailabilityBulk(venues.map((venue) => venue.id));
        const payload = response?.data && typeof response.data === 'object' ? response.data : {};
        return Object.fromEntries(
          venues.map((venue) => {
            const windows = payload[String(venue.id)] ?? payload[venue.id] ?? [];
            return [String(venue.id), Array.isArray(windows) ? windows : []];
          })
        );
      } catch {
        return Object.fromEntries(venues.map((venue) => [String(venue.id), []]));
      }
    },
    enabled: venues.length > 0,
  });

  const targetStart = toTimestamp(appliedFilters.start);
  const targetEnd = toTimestamp(appliedFilters.end);
  const mergedAvailabilityByVenue = mergeAvailabilityWindows(availabilityByVenue, derivedEventAvailabilityByVenue);
  const hasActiveWindowFilter = Number.isFinite(targetStart) && Number.isFinite(targetEnd);

  const cards = venues.map((venue) => {
    const windows = mergedAvailabilityByVenue[String(venue.id)] || [];
    const isUnavailable = windows.some((window) => {
      const windowStart = toTimestamp(window.startTime);
      const windowEnd = toTimestamp(window.endTime);
      return isWindowOverlapping(targetStart, targetEnd, windowStart, windowEnd);
    });

    return {
      venue,
      windows,
      isUnavailable: hasActiveWindowFilter ? isUnavailable : false,
    };
  });

  const filteredCards = useMemo(() => {
    const cityFilter = appliedFilters.city.trim().toLowerCase();
    const minCapacity = Number(appliedFilters.minCapacity || 0);

    return cards.filter(({ venue, isUnavailable }) => {
      if (cityFilter) {
        const locationText = `${venue.name || ''} ${venue.address || ''}`.toLowerCase();
        if (!locationText.includes(cityFilter)) return false;
      }

      if (minCapacity > 0) {
        const venueCapacity = Number(venue.capacity || 0);
        if (venueCapacity < minCapacity) return false;
      }

      if (appliedFilters.availability === 'AVAILABLE' && isUnavailable) return false;
      if (appliedFilters.availability === 'UNAVAILABLE' && !isUnavailable) return false;

      return true;
    });
  }, [cards, appliedFilters]);

  return (
    <div>
      <PageHeader
        title="Venue Catalog"
        subtitle="Browse venues and apply filters for slot planning"
      />

      <div className="neo-card neo-card-no-hover neo-toolbar-surface p-5 mb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-xs uppercase tracking-wider">Venue Filters</h3>
          <span className="neo-badge bg-neo-cream">Showing {filteredCards.length} of {cards.length}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <div>
            <label className="neo-label" htmlFor="view-venues-start">Desired Start</label>
            <input
              id="view-venues-start"
              type="datetime-local"
              value={windowStartInput}
              onChange={(e) => setWindowStartInput(e.target.value)}
              className="neo-input"
            />
          </div>
          <div>
            <label className="neo-label" htmlFor="view-venues-end">Desired End</label>
            <input
              id="view-venues-end"
              type="datetime-local"
              value={windowEndInput}
              onChange={(e) => setWindowEndInput(e.target.value)}
              className="neo-input"
            />
          </div>
          <div>
            <label className="neo-label" htmlFor="view-venues-city">City / Area</label>
            <input
              id="view-venues-city"
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              className="neo-input"
              placeholder="Search name or address"
            />
          </div>
          <div>
            <label className="neo-label" htmlFor="view-venues-capacity">Minimum Capacity</label>
            <input
              id="view-venues-capacity"
              type="number"
              min={0}
              value={minCapacityInput}
              onChange={(e) => setMinCapacityInput(e.target.value)}
              className="neo-input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="neo-label" htmlFor="view-venues-availability">Availability</label>
            <select
              id="view-venues-availability"
              value={availabilityInput}
              onChange={(e) => setAvailabilityInput(e.target.value)}
              className="neo-select"
            >
              <option value="ALL">All</option>
              <option value="AVAILABLE">Available</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setAppliedFilters({
                start: windowStartInput,
                end: windowEndInput,
                city: cityInput,
                minCapacity: minCapacityInput,
                availability: availabilityInput,
              });
            }}
            className="neo-btn neo-btn-sm bg-neo-yellow"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={() => {
              setWindowStartInput('');
              setWindowEndInput('');
              setCityInput('');
              setMinCapacityInput('');
              setAvailabilityInput('ALL');
              setAppliedFilters({ start: '', end: '', city: '', minCapacity: '', availability: 'ALL' });
            }}
            className="neo-btn neo-btn-sm bg-neo-white"
          >
            Reset
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="neo-card h-24" />)}</div>
      ) : filteredCards.length === 0 ? (
        <EmptyState icon={HiLocationMarker} title="No Venues" description="No venues are available yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCards.map(({ venue, windows, isUnavailable }, index) => (
            <motion.div
              key={venue.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`neo-card p-5 border-l-8 ${isUnavailable ? 'border-neo-red' : 'border-neo-green'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="font-heading text-sm uppercase tracking-wider">{venue.name}</h3>
                <span className={`neo-badge ${isUnavailable ? 'bg-neo-red text-white' : 'bg-neo-green text-neo-black'}`}>
                  {isUnavailable ? 'Unavailable For Selected Slot' : 'Available'}
                </span>
              </div>

              <p className="font-body text-xs text-neo-black/70">{venue.address || 'Address not provided'}</p>
              <p className="font-body text-xs text-neo-black/65 mt-1">Capacity: {venue.capacity || 'N/A'}</p>
              <p className="font-body text-xs text-neo-black/65 mt-1">
                Rent / Day: {venue.dailyRate ? `${(venue.rateCurrency || 'INR').toUpperCase()} ${Number(venue.dailyRate).toLocaleString()}` : 'N/A'}
              </p>
              {venue.amenities ? <p className="font-body text-xs text-neo-black/65">Amenities: {venue.amenities}</p> : null}

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name || ''} ${venue.address || ''}`.trim())}`}
                target="_blank"
                rel="noreferrer"
                className="neo-btn neo-btn-sm bg-neo-white mt-3"
              >
                Open in Maps
              </a>

              <div className="mt-3">
                <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/70 mb-1">Availability</p>
                {windows.length === 0 ? (
                  <p className="font-body text-xs text-neo-black/65">No current booking conflicts recorded.</p>
                ) : (
                  <div className="space-y-1">
                    {windows.slice(0, 5).map((window) => (
                      <div key={window.id || `${window.startTime}-${window.endTime}`} className="neo-card p-2">
                        <p className="font-body text-[10px] text-neo-black/70">
                          {formatWindowDate(window.startTime)} | {formatWindowTime(window.startTime)} - {formatWindowTime(window.endTime)}
                        </p>
                        <p className="font-body text-[10px] text-neo-black/65">{window.eventTitle || `Event #${window.eventId}`}</p>
                        <p className="font-body text-[10px] text-neo-black/55">{toStatusLabel(window.status)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}