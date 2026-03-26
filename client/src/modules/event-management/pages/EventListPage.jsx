import { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { HiPlus, HiPencil, HiTrash, HiCurrencyDollar, HiUsers, HiEye, HiSearch, HiFilter } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { eventsApi, usersApi } from '@/shared/api';
import { EVENT_STATUS } from '@/shared/constants/enums';
import { formatDate } from '@/shared/utils/formatters';
import { StatusBadge, PageHeader, EmptyState, ErrorState, ConfirmDialog } from '@/shared/ui';
import useAuthStore from '@/shared/store/authStore';

const PAGE_SIZE = 20;

const STATUS_FILTER_ORDER = [
  EVENT_STATUS.PENDING_APPROVAL,
  EVENT_STATUS.PUBLISHED,
  EVENT_STATUS.ONGOING,
  EVENT_STATUS.COMPLETED,
  EVENT_STATUS.DRAFT,
  EVENT_STATUS.CANCELLED,
];

export default function EventListPage() {
  const { user } = useAuthStore();
  const [deleteId, setDeleteId] = useState(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [activeStatus, setActiveStatus] = useState('ALL');
  const [pendingStatus, setPendingStatus] = useState('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [pendingStartDate, setPendingStartDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const queryClient = useQueryClient();
  const currentUserId = user?.userId || user?.id || user?._id || null;
  const visibleStatusFilters = useMemo(() => {
    if (user?.role === 'ADMIN') {
      return STATUS_FILTER_ORDER.filter((statusKey) => statusKey !== EVENT_STATUS.DRAFT);
    }
    return STATUS_FILTER_ORDER;
  }, [user?.role]);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    refetch,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['admin-events', searchQuery, activeStatus, currentUserId],
    queryFn: async ({ pageParam = 0 }) => {
      const params = { page: pageParam, limit: PAGE_SIZE };
      if (activeStatus !== 'ALL') params.status = activeStatus;
      const response = await eventsApi.getAll(params);
      // httpClient unwraps { success, data } → response.data is the inner payload directly
      const payload = response?.data || response || {};
      return {
        events: Array.isArray(payload?.events) ? payload.events : [],
        totalPages: Number(payload?.totalPages || 1),
        currentPage: pageParam,
      };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.currentPage + 1 < lastPage.totalPages) {
        return lastPage.currentPage + 1;
      }
      return undefined;
    },
    initialPageParam: 0,
    refetchInterval: 60000,
    enabled: Boolean(user),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => eventsApi.delete(id),
    onSuccess: () => { toast.success('Event deleted or cancelled'); queryClient.invalidateQueries({ queryKey: ['admin-events'] }); },
    onError: () => toast.error('Delete failed'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => eventsApi.changeStatus(id, status),
    onSuccess: () => { toast.success('Status updated'); queryClient.invalidateQueries({ queryKey: ['admin-events'] }); },
    onError: () => toast.error('Status update failed'),
  });

  const toStatus = (status) => String(status || '').toUpperCase();

  const handleSearch = useCallback((e) => {
    e?.preventDefault?.();
    setSearchQuery(searchInput.trim());
  }, [searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
  }, []);

  const allEvents = useMemo(() => {
    if (!data?.pages) return [];
    let rows = data.pages.flatMap((page) => page.events);
    if (user?.role === 'VENDOR' && currentUserId) {
      rows = rows.filter(
        (event) => String(event.vendorUserId) === String(currentUserId)
          || String(event.organiserUserId) === String(currentUserId)
      );
    }
    return rows;
  }, [data, user, currentUserId]);

  const events = useMemo(() => {
    let rows = [...allEvents];

    if (searchQuery) {
      const needle = String(searchQuery).toLowerCase();
      rows = rows.filter((event) => {
        const title = String(event?.title || '').toLowerCase();
        const description = String(event?.description || '').toLowerCase();
        const category = String(event?.category || '').toLowerCase();
        return title.includes(needle) || description.includes(needle) || category.includes(needle);
      });
    }

    if (startDateFilter) {
      return rows.filter((event) => String(event?.eventDate || '') >= startDateFilter);
    }

    return rows;
  }, [allEvents, searchQuery, startDateFilter]);

  const totalLoaded = events.length;

  const vendorIds = useMemo(() => {
    if (user?.role !== 'ADMIN') return [];
    return Array.from(new Set(
      events
        .map((event) => String(event?.vendorUserId || '').trim())
        .filter(Boolean)
    ));
  }, [events, user?.role]);

  const { data: vendorMap = {} } = useQuery({
    queryKey: ['event-vendors', vendorIds.join('|')],
    enabled: user?.role === 'ADMIN' && vendorIds.length > 0,
    queryFn: async () => {
      const response = await usersApi.getAll({ page: 0, limit: 500 });
      const payload = response?.data || {};
      const users = Array.isArray(payload?.users) ? payload.users : (Array.isArray(payload) ? payload : []);
      const map = {};
      users.forEach((entry) => {
        const key = String(entry?._id || entry?.id || '').trim();
        if (key) {
          map[key] = {
            name: String(entry?.name || '').trim(),
            email: String(entry?.email || '').trim(),
          };
        }
      });
      return map;
    },
    staleTime: 60000,
  });

  const getVendorLabel = useCallback((event) => {
    const vendorId = String(event?.vendorUserId || '').trim();
    if (!vendorId) return 'Unknown vendor';
    const vendor = vendorMap[vendorId];
    if (vendor?.name && vendor?.email) return `${vendor.name} (${vendor.email})`;
    if (vendor?.name) return vendor.name;
    if (vendor?.email) return vendor.email;
    return vendorId;
  }, [vendorMap]);

  const subtitleStatus = activeStatus === 'ALL' ? 'all statuses' : activeStatus.replaceAll('_', ' ').toLowerCase();
  const isPublishedEvent = (status) => toStatus(status) === 'PUBLISHED';
  const isCancelledEvent = (status) => toStatus(status) === 'CANCELLED';

  const applyFilters = () => {
    setActiveStatus(pendingStatus);
    setStartDateFilter(pendingStartDate);
    setFilterModalOpen(false);
  };

  const resetAllFilters = () => {
    setActiveStatus('ALL');
    setPendingStatus('ALL');
    setStartDateFilter('');
    setPendingStartDate('');
    setSearchInput('');
    setSearchQuery('');
  };

  const hasActiveFilters = activeStatus !== 'ALL' || Boolean(startDateFilter) || Boolean(searchQuery);

  return (
    <div>
      <PageHeader
        title="Event Operations"
        subtitle={`${events.length} events shown (${subtitleStatus})`}
        action={
          <div className="flex w-full sm:w-auto gap-2">
            <Link to="/admin/events/new" className="neo-btn bg-neo-yellow w-full sm:w-auto px-4 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm">
              <HiPlus /> New Event
            </Link>
          </div>
        }
      />

      <form onSubmit={handleSearch} className="neo-card neo-card-no-hover neo-toolbar-surface p-2.5 sm:p-3 md:p-4 mb-4 space-y-2.5">
        <div>
          <h2 className="font-heading text-[11px] sm:text-xs uppercase tracking-wider">Event Finder</h2>
          <p className="font-body text-[11px] text-neo-black/65">Loaded {totalLoaded} events</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="relative min-w-0">
            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neo-black/55" size={16} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title, description, category..."
              className="neo-input pl-9 w-full text-[15px] sm:text-base"
            />
          </div>

          <div className="flex flex-col min-[420px]:flex-row gap-2">
            <button type="submit" className="neo-btn neo-btn-sm bg-neo-yellow px-4 w-full min-[420px]:w-auto">
              Search
            </button>
            {searchQuery ? (
              <button type="button" onClick={handleClearSearch} className="neo-btn neo-btn-sm bg-neo-white px-4 w-full min-[420px]:w-auto">
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 min-[640px]:flex min-[640px]:flex-wrap min-[640px]:items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPendingStatus(activeStatus);
              setPendingStartDate(startDateFilter);
              setFilterModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 font-heading text-[10px] sm:text-[11px] uppercase tracking-wider border-2 border-neo-black bg-neo-white hover:bg-neo-cream"
          >
            <HiFilter size={14} />
            <span>Filters</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center px-3 py-2 font-heading text-[10px] sm:text-[11px] uppercase tracking-wider border-2 border-neo-black bg-neo-white hover:bg-neo-cream disabled:opacity-50"
            onClick={resetAllFilters}
            disabled={!hasActiveFilters}
          >
            Reset Filters
          </button>
          <span className="inline-flex items-center justify-center min-[380px]:justify-start px-3 py-2 font-heading text-[10px] uppercase tracking-wider border-2 border-neo-black bg-neo-cream min-[380px]:col-span-2 min-[640px]:col-auto">
            Status: {activeStatus === 'ALL' ? 'ALL' : activeStatus.replaceAll('_', ' ')}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {startDateFilter ? <span className="neo-badge bg-neo-cream">Start date: {startDateFilter}</span> : null}
          {searchQuery ? <span className="neo-badge bg-neo-cream">Search: {searchQuery}</span> : null}
        </div>

      </form>

      <AnimatePresence>
        {filterModalOpen ? (
          <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              onClick={() => setFilterModalOpen(false)}
              aria-label="Close filter modal"
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              className="relative neo-card w-full max-w-md p-5"
            >
              <h3 className="font-heading text-sm uppercase tracking-wider">Filter Events</h3>
              <p className="font-body text-xs text-neo-black/65 mt-1">Filter by status and start date.</p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="neo-label" htmlFor="event-filter-status">Status</label>
                  <select
                    id="event-filter-status"
                    value={pendingStatus}
                    onChange={(e) => setPendingStatus(e.target.value)}
                    className="neo-select"
                  >
                    <option value="ALL">All statuses</option>
                    {visibleStatusFilters.map((statusKey) => (
                      <option key={statusKey} value={statusKey}>{statusKey.replaceAll('_', ' ')}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="neo-label" htmlFor="event-filter-start-date">Start Date (on or after)</label>
                  <input
                    id="event-filter-start-date"
                    type="date"
                    value={pendingStartDate}
                    onChange={(e) => setPendingStartDate(e.target.value)}
                    className="neo-input"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="neo-btn neo-btn-sm bg-neo-white"
                  onClick={() => {
                    setPendingStatus(activeStatus);
                    setPendingStartDate(startDateFilter);
                    setFilterModalOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="neo-btn neo-btn-sm bg-neo-white"
                  onClick={() => {
                    setPendingStatus('ALL');
                    setPendingStartDate('');
                  }}
                >
                  Clear
                </button>
                <button type="button" className="neo-btn neo-btn-sm bg-neo-yellow" onClick={applyFilters}>
                  Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="neo-card h-20 animate-pulse" />
        ))}</div>
      ) : error ? (
        <ErrorState message="Could not load events" onRetry={refetch} />
      ) : events.length === 0 ? (
          <EmptyState title="No Events" description={searchQuery ? `No events matching "${searchQuery}"` : 'Create your first event'}
          action={!searchQuery && <Link to="/admin/events/new" className="neo-btn-primary neo-btn-sm">Create Event</Link>} />
      ) : (
        <div className="space-y-3">
          {events.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="neo-card neo-card-no-hover neo-retroui-panel p-4 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-heading text-sm uppercase tracking-wider truncate">{event.title}</h3>
                  <StatusBadge status={event.status} />
                </div>
                <p className="font-body text-xs text-neo-black/65">
                  {formatDate(event.eventDate)}{event.endDate && event.endDate !== event.eventDate ? ` — ${formatDate(event.endDate)}` : ''} - {event.category || 'General'}
                </p>
                {event.description ? (
                  <p className="font-body text-xs text-neo-black/70 mt-1 line-clamp-1">{event.description}</p>
                ) : null}
                <p className="font-body text-[11px] text-neo-black/65 mt-1">
                  Venue: {event?.venueName || event?.venue?.name || event?.ownVenueName || 'Not assigned'} - Tickets: {(event.ticketTiers || []).reduce((sum, t) => sum + Number(t.capacity || 0), 0)} seats
                </p>
                {user?.role === 'ADMIN' ? (
                  <p className="font-body text-[11px] text-neo-black/65 mt-1">
                    Vendor: {getVendorLabel(event)}
                  </p>
                ) : null}
              </div>

              <div className="neo-card neo-card-no-hover neo-retroui-inset p-2 flex flex-wrap items-center gap-2 flex-shrink-0">
                {toStatus(event.status) === 'PENDING_APPROVAL' && user?.role === 'ADMIN' && (
                  <>
                    <button
                      onClick={() => statusMutation.mutate({ id: event.id, status: 'PUBLISHED' })}
                      className="neo-btn neo-btn-sm bg-neo-green"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => statusMutation.mutate({ id: event.id, status: 'DRAFT' })}
                      className="neo-btn neo-btn-sm bg-neo-white text-neo-red"
                    >
                      Reject
                    </button>
                  </>
                )}
                {isPublishedEvent(event.status) && (
                  <Link to={`/events/${event.id}`} className="neo-btn neo-btn-sm bg-neo-white" title="View Event">
                    <HiEye size={14} />
                    <span>View</span>
                  </Link>
                )}
                <Link to={`/admin/events/${event.id}/attendees`} className="neo-btn neo-btn-sm bg-neo-white" title="Attendees">
                  <HiUsers size={14} />
                  <span>Attendees</span>
                </Link>
                <Link to={`/admin/events/${event.id}/budget`} className="neo-btn neo-btn-sm bg-neo-white" title="Budget">
                  <HiCurrencyDollar size={14} />
                  <span>View Budget</span>
                </Link>
                <Link
                  to={`/admin/events/${event.id}/edit`}
                  className="neo-btn neo-btn-sm bg-neo-white"
                  title={isCancelledEvent(event.status) ? 'View (read-only)' : 'Edit'}
                >
                  <HiPencil size={14} />
                  <span>{isCancelledEvent(event.status) ? 'View' : 'Edit'}</span>
                </Link>
                {toStatus(event.status) === 'DRAFT' && (
                  <button onClick={() => setDeleteId(event.id)} className="neo-btn neo-btn-sm bg-neo-white text-neo-red" title="Delete">
                    <HiTrash size={14} />
                    <span>Delete</span>
                  </button>
                )}
                {['PUBLISHED', 'ONGOING', 'COMPLETED'].includes(toStatus(event.status)) && (
                  <button
                    onClick={() => {
                      if (user?.role === 'ADMIN') {
                        statusMutation.mutate({ id: event.id, status: 'CANCELLED' });
                        return;
                      }
                      deleteMutation.mutate(event.id);
                    }}
                    className="neo-btn neo-btn-sm bg-neo-white text-neo-red"
                    title="Cancel"
                  >
                    <HiTrash size={14} />
                    <span>Cancel</span>
                  </button>
                )}
              </div>
            </motion.div>
          ))}

          {/* Load More */}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="neo-btn bg-neo-cream"
              >
                {isFetchingNextPage ? 'Loading more...' : 'Load More Events'}
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { deleteMutation.mutate(deleteId); setDeleteId(null); }}
        title="Delete Event"
        message="This will permanently delete this draft event. Continue?"
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
