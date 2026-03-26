import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HiSearch } from 'react-icons/hi';
import { eventsApi } from '@/shared/api';
import { EVENT_CATEGORIES, CATEGORY_COLORS } from '@/shared/constants/enums';
import { formatDate, formatCurrency } from '@/shared/utils/formatters';
import { StatusBadge, SkeletonCard, EmptyState, ErrorState } from '@/shared/ui';

function EventCard({ event, index }) {
  const lowestPrice = event.ticketTiers?.reduce(
    (min, t) => Math.min(min, t.price || 0), Infinity
  );
  const venueLabel = event?.venue?.name || event?.venueName || event?.ownVenueName;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Link to={`/events/${event.id}`}>
        <div className="neo-card overflow-hidden group cursor-pointer h-full flex flex-col">
          {/* Image */}
          <div className="relative h-48 overflow-hidden border-b-3 border-neo-black">
            {event.bannerImageUrl ? (
              <img
                src={event.bannerImageUrl}
                alt={event.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className={`w-full h-full ${CATEGORY_COLORS[event.category] || 'bg-neo-lavender'}
                            flex items-center justify-center`}>
                <span className="font-heading-shade text-4xl text-neo-black/20 uppercase">
                  {event.category || 'EVENT'}
                </span>
              </div>
            )}
            {/* Category badge */}
            <span className={`absolute top-3 left-3 neo-badge ${CATEGORY_COLORS[event.category] || 'bg-neo-lavender'} text-neo-black`}>
              {event.category}
            </span>
          </div>

          {/* Content */}
          <div className="p-5 flex-1 flex flex-col">
            <h3 className="font-heading text-sm uppercase tracking-wider mb-2 line-clamp-2 group-hover:text-neo-red transition-colors">
              {event.title}
            </h3>
            <p className="font-body text-xs text-neo-black/65 mb-3">
              {formatDate(event.eventDate)}
              {venueLabel ? ` - ${venueLabel}` : ''}
            </p>

            <div className="mt-auto flex items-center justify-between">
              <span className="font-heading text-lg text-neo-red">
                {lowestPrice === 0 ? 'FREE' : lowestPrice !== Infinity ? `From ${formatCurrency(lowestPrice)}` : '-'}
              </span>
              <span className="neo-btn-sm neo-btn bg-neo-yellow text-[10px]">
                View -&gt;
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const page = parseInt(searchParams.get('page') || '0', 10);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['events', { q: search, category: selectedCategory, page, status: 'PUBLISHED' }],
    queryFn: () => eventsApi.getAll({ q: search || undefined, category: selectedCategory || undefined, page, limit: 12, status: 'PUBLISHED' }).then(r => r.data),
  });

  const events = data?.events || [];
  const totalPages = data?.totalPages || 1;

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (selectedCategory) params.set('category', selectedCategory);
    params.set('page', '0');
    setSearchParams(params);
  };

  const handleCategoryFilter = (cat) => {
    const newCat = cat === selectedCategory ? '' : cat;
    setSelectedCategory(newCat);
    const params = new URLSearchParams(searchParams);
    if (newCat) params.set('category', newCat); else params.delete('category');
    params.set('page', '0');
    setSearchParams(params);
  };

  const clearCategoryFilter = () => {
    setSelectedCategory('');
    const params = new URLSearchParams(searchParams);
    params.delete('category');
    params.set('page', '0');
    setSearchParams(params);
  };

  return (
    <div className="neo-section">
      <div className="neo-container">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="neo-badge bg-neo-yellow text-neo-black mb-4 inline-block">Explore</span>
          <h1 className="font-heading text-3xl md:text-4xl uppercase tracking-wider">
            Discover Events
          </h1>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="max-w-3xl mx-auto mb-8">
          <div className="neo-card neo-card-no-hover p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0">
              <div className="flex-1 relative min-w-0">
              <label htmlFor="events-search" className="sr-only">Search events</label>
              <HiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-neo-black/55" size={20} />
              <input
                id="events-search"
                name="q"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events..."
                className="neo-input pl-12 sm:border-r-0 w-full"
                autoComplete="off"
              />
              </div>
              <button type="submit" className="neo-btn bg-neo-yellow sm:border-l-0 w-full sm:w-auto">
                Search
              </button>
            </div>
            <p className="font-body text-[11px] text-neo-black/65 mt-2 px-1">
              Use keyword + category filters together for quicker event discovery.
            </p>
          </div>
        </form>

        {/* Category filters */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            onClick={clearCategoryFilter}
            className={`neo-btn-sm neo-btn ${
              !selectedCategory
                ? 'bg-neo-yellow shadow-neo-sm'
                : 'bg-neo-white'
            }`}
          >
            All
          </button>
          {EVENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryFilter(cat)}
              className={`neo-btn-sm neo-btn ${
                selectedCategory === cat
                  ? `${CATEGORY_COLORS[cat]} shadow-neo-sm`
                  : 'bg-neo-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <ErrorState message="Could not load events" onRetry={refetch} />
        ) : events.length === 0 ? (
          <EmptyState
            title="No Events Found"
            description="Try adjusting your search or filters"
            icon={HiSearch}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-3 mt-10">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams);
                      params.set('page', String(i));
                      setSearchParams(params);
                    }}
                    className={`neo-btn-sm neo-btn ${
                      page === i ? 'bg-neo-yellow shadow-neo-sm' : 'bg-neo-white'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
