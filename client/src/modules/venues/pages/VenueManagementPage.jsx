import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { HiPlus, HiPencil, HiTrash, HiLocationMarker } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { eventsApi, venuesApi } from '@/shared/api';
import { PageHeader, EmptyState, ConfirmDialog } from '@/shared/ui';
import {
  formatWindowDate,
  formatWindowTime,
  normalizeEventAvailabilityForVenue,
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

function mergeAvailabilityRows(primary = [], fallback = []) {
  const seen = new Set();
  const merged = [];

  [...primary, ...fallback].forEach((row) => {
    const key = `${row.startTime}-${row.endTime}-${row.eventId || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(row);
  });

  return merged
    .filter((row) => Number.isFinite(toTimestamp(row.startTime)) && Number.isFinite(toTimestamp(row.endTime)))
    .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
}

export default function VenueManagementPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [activeVenueId, setActiveVenueId] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: () => venuesApi.getAll().then(r => r.data?.venues || r.data || []),
  });

  const { data: eventsData } = useQuery({
    queryKey: ['events-for-venue-availability-admin'],
    queryFn: fetchEventsSnapshot,
  });

  const { data: venueDetails } = useQuery({
    queryKey: ['venue-details', activeVenueId],
    queryFn: () => venuesApi.getById(activeVenueId).then((r) => r.data),
    enabled: !!activeVenueId,
  });

  const { data: venueAvailabilityData = [] } = useQuery({
    queryKey: ['venue-availability', activeVenueId],
    queryFn: () => venuesApi.getAvailability(activeVenueId).then((r) => r.data || []),
    enabled: !!activeVenueId,
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  const saveMutation = useMutation({
    mutationFn: (data) => editingId ? venuesApi.update(editingId, data) : venuesApi.create(data),
    onSuccess: () => {
      toast.success(editingId ? 'Venue updated!' : 'Venue created!');
      resetForm(); queryClient.invalidateQueries({ queryKey: ['venues'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => venuesApi.delete(id),
    onSuccess: () => { toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['venues'] }); },
  });

  const venues = Array.isArray(data) ? data : [];
  const events = Array.isArray(eventsData) ? eventsData : [];
  const venueAvailability = Array.isArray(venueAvailabilityData) ? venueAvailabilityData : [];
  const selectedVenue = venues.find((v) => String(v.id) === String(activeVenueId));
  const eventWindows = normalizeEventAvailabilityForVenue(events, activeVenueId);
  const mergedAvailability = mergeAvailabilityRows(venueAvailability, eventWindows);

  const resetForm = () => { reset(); setEditingId(null); setShowForm(false); };

  const startEdit = (venue) => {
    setEditingId(venue.id);
    setValue('name', venue.name);
    setValue('address', venue.address);
    setValue('capacity', venue.capacity);
    setValue('description', venue.description);
    setValue('amenities', venue.amenities);
    setShowForm(true);
  };

  return (
    <div>
      <PageHeader title="Venue Management" subtitle={`${venues.length} venues`}
        action={<button onClick={() => { resetForm(); setShowForm(true); }} className="neo-btn bg-neo-yellow">
          <HiPlus /> Add Venue
        </button>} />

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="neo-card p-6 mb-6">
            <h3 className="font-heading text-sm uppercase mb-4">{editingId ? 'Edit Venue' : 'New Venue'}</h3>
            <form onSubmit={handleSubmit((d) => saveMutation.mutate({ ...d, capacity: Number(d.capacity) }))}
              className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="neo-label" htmlFor="venue-name">Name</label>
                <input
                  id="venue-name"
                  {...register('name', { required: 'Venue name is required' })}
                  className="neo-input"
                  placeholder="Venue name"
                />
                {errors.name && <p className="text-xs text-neo-red mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="neo-label" htmlFor="venue-capacity">Capacity</label>
                <input
                  id="venue-capacity"
                  type="number"
                  {...register('capacity', {
                    required: 'Capacity is required',
                    min: { value: 1, message: 'Capacity must be at least 1' },
                    valueAsNumber: true,
                  })}
                  className="neo-input"
                  placeholder="Max capacity"
                />
                {errors.capacity && <p className="text-xs text-neo-red mt-1">{errors.capacity.message}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="neo-label" htmlFor="venue-address">Address</label>
                <input
                  id="venue-address"
                  {...register('address', { required: 'Address is required' })}
                  className="neo-input"
                  placeholder="Full address"
                />
                {errors.address && <p className="text-xs text-neo-red mt-1">{errors.address.message}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="neo-label" htmlFor="venue-description">Description</label>
                <textarea id="venue-description" {...register('description')} className="neo-textarea" placeholder="Venue details" />
              </div>
              <div className="md:col-span-2">
                <label className="neo-label" htmlFor="venue-amenities">Amenities</label>
                <input id="venue-amenities" {...register('amenities')} className="neo-input" placeholder="WiFi, Parking, A/V..." />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" disabled={saveMutation.isPending} className="neo-btn-primary">
                  {saveMutation.isPending ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={resetForm} className="neo-btn bg-neo-white">Cancel</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="animate-pulse space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="neo-card h-24" />)}</div>
      ) : venues.length === 0 ? (
        <EmptyState icon={HiLocationMarker} title="No Venues" description="Add your first venue" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {venues.map((venue, i) => (
            <motion.div key={venue.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="neo-card p-4 sm:p-6 border-l-8 border-neo-blue">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-heading text-sm uppercase tracking-wider break-words">{venue.name}</h3>
                  <p className="font-body text-xs text-neo-black/65 mt-1 break-words">{venue.address}</p>
                </div>
                <div className="grid w-full grid-cols-4 gap-2 sm:flex sm:w-auto sm:gap-2">
                  <button
                    onClick={() => setActiveVenueId((current) => (current === venue.id ? null : venue.id))}
                    className="neo-btn neo-btn-sm bg-neo-white col-span-2 sm:col-auto text-[10px] min-[360px]:text-xs leading-tight"
                  >
                    {activeVenueId === venue.id ? 'Hide Availability' : 'View Availability'}
                  </button>
                  <button onClick={() => startEdit(venue)} className="neo-btn neo-btn-sm bg-neo-white col-span-1 sm:col-auto justify-center"><HiPencil size={14} /></button>
                  <button onClick={() => setDeleteId(venue.id)} className="neo-btn neo-btn-sm bg-neo-white text-neo-red col-span-1 sm:col-auto justify-center"><HiTrash size={14} /></button>
                </div>
              </div>
              {venue.capacity && <span className="neo-badge bg-neo-cream">{venue.capacity} seats</span>}
              {venue.amenities && <p className="font-body text-xs text-neo-black/55 mt-2">{venue.amenities}</p>}
            </motion.div>
          ))}
        </div>
      )}

      {activeVenueId && (
        <div className="neo-card p-6 mt-6 space-y-4">
          <h3 className="font-heading text-sm uppercase tracking-wider border-b-3 border-neo-black/10 pb-3">
            Venue Availability
          </h3>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-body text-xs text-neo-black/70">
                Venue: {venueDetails?.name || selectedVenue?.name || activeVenueId}
              </p>
              <p className="font-body text-xs text-neo-black/65">
                {venueDetails?.address || selectedVenue?.address || 'Address unavailable'}
              </p>
            </div>
            <button
              type="button"
              className="neo-btn neo-btn-sm bg-neo-white"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['venue-details', activeVenueId] });
                queryClient.invalidateQueries({ queryKey: ['venue-availability', activeVenueId] });
                queryClient.invalidateQueries({ queryKey: ['events-for-venue-availability-admin'] });
              }}
            >
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="neo-card p-3 text-center">
              <p className="font-heading text-[10px] uppercase">Capacity</p>
              <p className="font-heading text-sm">{venueDetails?.capacity || selectedVenue?.capacity || '-'}</p>
            </div>
            <div className="neo-card p-3 text-center">
              <p className="font-heading text-[10px] uppercase">Bookings</p>
              <p className="font-heading text-sm">{mergedAvailability.length}</p>
            </div>
            <div className="neo-card p-3 text-center">
              <p className="font-heading text-[10px] uppercase">Confirmed Windows</p>
              <p className="font-heading text-sm">{venueAvailability.length}</p>
            </div>
            <div className="neo-card p-3 text-center">
              <p className="font-heading text-[10px] uppercase">Event Timelines</p>
              <p className="font-heading text-sm">{eventWindows.length}</p>
            </div>
          </div>

          <div className="neo-card p-4">
            <h4 className="font-heading text-xs uppercase tracking-wider mb-3">Blocked Windows</h4>
            <div className="space-y-2">
              {mergedAvailability.length === 0 ? (
                <p className="font-body text-xs text-neo-black/65">No blocked windows found for this venue yet.</p>
              ) : (
                mergedAvailability.map((entry) => {
                  const dateStr = formatWindowDate(entry.startTime);
                  const startTimeStr = formatWindowTime(entry.startTime);
                  const endTimeStr = formatWindowTime(entry.endTime);
                  const statusLabel = entry.status ? String(entry.status).replace(/_/g, ' ') : 'booked';

                  return (
                    <div key={entry.id || `${entry.startTime}-${entry.endTime}`}
                      className="neo-card p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                    >
                      <div>
                        <p className="font-heading text-xs uppercase tracking-wider">
                          {entry.eventTitle || `Event #${entry.eventId}`}
                        </p>
                        <p className="font-body text-xs text-neo-black/70 mt-0.5">
                          {dateStr} | {startTimeStr} - {endTimeStr}
                        </p>
                      </div>
                      <span className={`neo-badge text-[9px] ${
                        statusLabel === 'PUBLISHED' ? 'bg-neo-blue text-white' :
                        statusLabel === 'CONFIRMED' ? 'bg-neo-green' :
                        'bg-neo-lavender text-neo-black/80'
                      }`}>
                        {statusLabel}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { deleteMutation.mutate(deleteId); setDeleteId(null); }}
        title="Delete Venue" message="This cannot be undone. Continue?" confirmLabel="Delete" danger />
    </div>
  );
}
