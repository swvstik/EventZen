import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HiCalendar, HiLocationMarker, HiClock, HiTicket, HiUsers, HiStar, HiTrash, HiShare } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { eventsApi, scheduleApi, attendeesApi, reviewsApi } from '@/shared/api';
import { formatDate, formatTime, formatCurrency, formatRelative } from '@/shared/utils/formatters';
import { withCacheBust } from '@/shared/utils/images';
import { CATEGORY_COLORS } from '@/shared/constants/enums';
import { StatusBadge, ErrorState, Drawer } from '@/shared/ui';
import useAuthStore from '@/shared/store/authStore';

function splitOwnVenueMeta(description) {
  const content = String(description || '');
  const markerRegex = /(?:\r?\n){0,2}\[Own Venue\]\r?\n/i;
  const match = markerRegex.exec(content);
  if (!match) {
    return { base: content.trimEnd(), meta: '' };
  }

  const base = content.slice(0, match.index).trimEnd();
  const meta = content.slice(match.index + match[0].length).trim();
  return { base, meta };
}

function extractOwnVenueDetails(description) {
  const { meta } = splitOwnVenueMeta(description);
  if (!meta) return { name: '', address: '' };

  const payload = meta;
  const [name = '', address = ''] = payload.split('|').map((part) => part.trim());
  return { name, address };
}

function stripOwnVenueDetails(description) {
  return splitOwnVenueMeta(description).base;
}

function parseTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (typeof tags !== 'string' || !tags.trim()) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
}

function formatTimeOrTbd(value) {
  if (!value) return 'TBD';
  try {
    return formatTime(value);
  } catch {
    return 'TBD';
  }
}

/** Inline star rating display / input */
function StarRating({ value = 0, onChange, size = 20, interactive = false }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="inline-flex items-center gap-0.5">
      {stars.map((s) => (
        <button
          key={s}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onChange?.(s)}
          className={`transition-colors ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
          aria-label={`${s} star${s > 1 ? 's' : ''}`}
        >
          <HiStar
            size={size}
            className={s <= value ? 'text-neo-yellow fill-neo-yellow' : 'text-neo-black/35'}
            style={s <= value ? { fill: '#FACC15' } : {}}
          />
        </button>
      ))}
    </div>
  );
}

export default function EventDetailPage() {
  const { id } = useParams();
  const { isAuthenticated, user } = useAuthStore();
  const [selectedTier, setSelectedTier] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [editingMyReview, setEditingMyReview] = useState(false);
  const [editReviewRating, setEditReviewRating] = useState(0);
  const [editReviewComment, setEditReviewComment] = useState('');
  const queryClient = useQueryClient();

  const { data: eventData, isLoading, error, dataUpdatedAt: eventDataUpdatedAt } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.getById(id).then(r => r.data),
    refetchInterval: 30 * 1000,
  });

  const { data: scheduleData } = useQuery({
    queryKey: ['schedule', id],
    queryFn: () => scheduleApi.getByEvent(id).then(r => r.data),
    enabled: !eventData?.scheduleSlots?.length,
    refetchInterval: 30 * 1000,
  });

  const { data: countData } = useQuery({
    queryKey: ['event-count', id],
    queryFn: () => attendeesApi.getCount(id).then(r => r.data),
    enabled: !!id,
    refetchInterval: 30 * 1000,
  });

  const { data: waitlistCountData } = useQuery({
    queryKey: ['event-waitlist-count', id],
    queryFn: () => attendeesApi.getWaitlistCount(id).then(r => r.data),
    enabled: !!id,
    refetchInterval: 30 * 1000,
  });

  const { data: myRegsData } = useQuery({
    queryKey: ['my-registrations'],
    queryFn: () => attendeesApi.getMy().then((r) => r.data),
    enabled: isAuthenticated,
  });

  // Reviews queries
  const {
    data: reviewsData,
    fetchNextPage: fetchMoreReviews,
    hasNextPage: hasMoreReviews,
    isFetchingNextPage: isFetchingMoreReviews,
  } = useInfiniteQuery({
    queryKey: ['reviews', id],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await reviewsApi.getByEvent(id, { page: pageParam, limit: 10 });
      const payload = res?.data || res || {};
      return {
        reviews: payload?.reviews || [],
        totalPages: Number(payload?.totalPages || 1),
        total: Number(payload?.total || 0),
        currentPage: pageParam,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.currentPage + 1 < lastPage.totalPages ? lastPage.currentPage + 1 : undefined,
    initialPageParam: 0,
    enabled: !!id,
  });

  const { data: myReviewData } = useQuery({
    queryKey: ['my-review', id],
    queryFn: () => reviewsApi.getMine(id).then(r => r.data),
    enabled: isAuthenticated && !!id,
  });

  const registerMutation = useMutation({
    mutationFn: (data) => attendeesApi.register(data),
    onSuccess: (res) => {
      const result = res?.data?.data || res?.data || {};

      if (result?.requiresPayment && result?.checkoutUrl) {
        toast.success('Redirecting to secure checkout...');
        window.location.href = result.checkoutUrl;
        return;
      }

      const registrations = Array.isArray(result?.registrations)
        ? result.registrations
        : (result?.registration ? [result.registration] : []);

      const waitlisted = registrations.filter((r) => r.status === 'WAITLISTED').length;
      const registered = registrations.filter((r) => r.status === 'REGISTERED').length;

      if (registered > 0 && waitlisted > 0) {
        toast.success(`${registered} ticket(s) registered and ${waitlisted} added to waitlist.`);
      } else if (registered > 0) {
        toast.success(`Successfully registered ${registered} ticket(s)!`);
      } else if (waitlisted > 0) {
        const firstPosition = registrations.find((r) => r.waitlistPosition)?.waitlistPosition;
        toast.success(
          firstPosition
            ? `Added ${waitlisted} ticket(s) to waitlist. First position: #${firstPosition}`
            : `Added ${waitlisted} ticket(s) to waitlist.`
        );
      } else {
        toast.success('Registration completed.');
      }

      setQuantity(1);
      setCheckoutOpen(false);
      queryClient.invalidateQueries({ queryKey: ['event-count', id] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Registration failed');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (data) => reviewsApi.create(data),
    onSuccess: () => {
      toast.success('Review submitted!');
      setReviewRating(0);
      setReviewComment('');
      queryClient.invalidateQueries({ queryKey: ['reviews', id] });
      queryClient.invalidateQueries({ queryKey: ['my-review', id] });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to submit review'),
  });

  const updateReviewMutation = useMutation({
    mutationFn: ({ reviewId, data }) => reviewsApi.update(reviewId, data),
    onSuccess: () => {
      toast.success('Review updated.');
      setEditingMyReview(false);
      queryClient.invalidateQueries({ queryKey: ['reviews', id] });
      queryClient.invalidateQueries({ queryKey: ['my-review', id] });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update review'),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId) => reviewsApi.delete(reviewId),
    onSuccess: () => {
      toast.success('Review deleted.');
      queryClient.invalidateQueries({ queryKey: ['reviews', id] });
      queryClient.invalidateQueries({ queryKey: ['my-review', id] });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    },
    onError: () => toast.error('Failed to delete review'),
  });

  const event = eventData;
  if (isLoading) {
    return (
      <div className="neo-container py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-64 bg-neo-lavender border-3 border-neo-black" />
          <div className="h-8 bg-neo-lavender w-3/4" />
          <div className="h-4 bg-neo-lavender w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="neo-container py-12">
        <ErrorState message="Could not load event" />
      </div>
    );
  }

  const schedule = event?.scheduleSlots?.length ? event.scheduleSlots : (scheduleData || []);
  const bannerSrc = withCacheBust(
    event?.bannerImageUrl,
    event?.updatedAt || event?.updatedAtUtc || eventDataUpdatedAt
  );
  const tiers = event?.ticketTiers || [];
  const selectedTierConfig = tiers.find((tier) => String(tier.id) === String(selectedTier));
  const selectedTierMaxPerOrder = Math.max(1, Number(selectedTierConfig?.maxPerOrder || 10));
  const effectiveQuantity = Math.min(quantity, selectedTierMaxPerOrder);
  const myRegistrations = Array.isArray(myRegsData) ? myRegsData : (myRegsData?.registrations || []);
  const myEventRegistrations = myRegistrations.filter(
    (r) => String(r.eventId) === String(event?.id) && r.status !== 'CANCELLED'
  );
  const ownedByTier = myEventRegistrations.reduce((acc, reg) => {
    const key = String(reg.tierId);
    acc[key] = (acc[key] || 0) + Number(reg.quantity || 1);
    return acc;
  }, {});
  const totalOwned = myEventRegistrations.reduce((sum, reg) => sum + Number(reg.quantity || 1), 0);
  const countsByTier = (Array.isArray(countData) ? countData : []).reduce((acc, item) => {
    acc[String(item.tierId)] = Number(item.count || 0);
    return acc;
  }, {});
  const waitlistCountsByTier = (Array.isArray(waitlistCountData) ? waitlistCountData : []).reduce((acc, item) => {
    acc[String(item.tierId)] = Number(item.count || 0);
    return acc;
  }, {});

  const allReviews = reviewsData?.pages?.flatMap((p) => p.reviews) || [];
  const totalReviewCount = reviewsData?.pages?.[0]?.total || 0;
  const myReview = myReviewData || null;
  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN';
  const isVendor = String(user?.role || '').toUpperCase() === 'VENDOR';
  const isVendorOwnEvent = isVendor && String(event?.vendorUserId || '') === String(user?.userId || user?.id || user?._id || '');
  const hasReviewEligibleRegistration = myEventRegistrations.some(
    (r) => r.status === 'REGISTERED' || r.status === 'CHECKED_IN'
  );
  const canReview = isAuthenticated && (isAdmin || isVendorOwnEvent || hasReviewEligibleRegistration) && !myReview;
  const avgRating = Number(event?.avgRating || 0);
  const legacyOwnVenueDetails = extractOwnVenueDetails(event?.description);
  const ownVenueName = event?.ownVenueName || legacyOwnVenueDetails.name;
  const ownVenueAddress = event?.ownVenueAddress || legacyOwnVenueDetails.address;
  const hasManagedVenueLocation = Boolean(
    event?.venue?.name || event?.venueName || event?.venue?.address || event?.venueAddress
  );
  const venueDisplayName = hasManagedVenueLocation
    ? (event?.venue?.name || event?.venueName || 'Venue')
    : (ownVenueName || 'Own Venue');
  const venueDisplayAddress = hasManagedVenueLocation
    ? (event?.venue?.address || event?.venueAddress || 'Address not provided')
    : (ownVenueAddress || 'Address not provided');
  const showVenueLocationCard = hasManagedVenueLocation || Boolean(ownVenueName || ownVenueAddress);
  const eventDescription = stripOwnVenueDetails(event?.description);
  const organizerName = String(event?.organizerName || '').trim();
  const parsedTags = parseTags(event?.tags);
  const selectedTierPrice = Number(selectedTierConfig?.price || 0);
  const selectedTierRegisteredCount = Number(countsByTier[String(selectedTierConfig?.id || selectedTier)] || 0);
  const selectedTierCapacity = Number(selectedTierConfig?.capacity || 0);
  const selectedTierRemaining = Math.max(selectedTierCapacity - selectedTierRegisteredCount, 0);
  const selectedTierSoldOut = Boolean(selectedTierConfig) && selectedTierRemaining <= 0;
  const waitlistEnabled = event?.allowWaitlist !== false;
  const selectedTierCanJoinWaitlist = selectedTierSoldOut && waitlistEnabled;
  const selectedTierSoldOutNoWaitlist = selectedTierSoldOut && !waitlistEnabled;
  const estimatedSubtotal = selectedTierPrice * Number(effectiveQuantity || 1);
  const estimatedFees = selectedTierPrice > 0 ? Math.round(estimatedSubtotal * 0.1) : 0;
  const estimatedTotal = estimatedSubtotal + estimatedFees;

  const handleOpenCheckout = () => {
    if (!selectedTier) return toast.error('Please select a ticket tier');
    if (selectedTierSoldOutNoWaitlist) {
      return toast.error('Tickets are sold out for this tier and waitlist is disabled.');
    }
    setCheckoutOpen(true);
  };

  const handleProceedCheckout = () => {
    if (!selectedTier) return toast.error('Please select a ticket tier');
    if (selectedTierSoldOutNoWaitlist) {
      return toast.error('Tickets are sold out for this tier and waitlist is disabled.');
    }
    registerMutation.mutate({ eventId: event.id, tierId: selectedTier, quantity: effectiveQuantity });
  };

  const handleShareEvent = async () => {
    const shareUrl = window.location.href;
    const shareTitle = event?.title || 'Event';

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: `Check out this event on EventZen: ${shareTitle}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Event link copied to clipboard.');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        toast.error('Could not share event right now.');
      }
    }
  };

  const handleSubmitReview = (e) => {
    e.preventDefault();
    if (reviewRating < 1) return toast.error('Please select a star rating');
    reviewMutation.mutate({ eventId: String(event.id), rating: reviewRating, comment: reviewComment });
  };

  const handleSaveMyReviewUpdate = () => {
    if (!myReview?._id) return;
    if (editReviewRating < 1) {
      toast.error('Please select a star rating');
      return;
    }
    updateReviewMutation.mutate({
      reviewId: myReview._id,
      data: {
        rating: editReviewRating,
        comment: editReviewComment,
      },
    });
  };

  const startEditMyReview = () => {
    setEditReviewRating(Number(myReview?.rating || 0));
    setEditReviewComment(myReview?.comment || '');
    setEditingMyReview(true);
  };

  return (
    <div className="neo-section">
      <div className="neo-container">
        {/* Hero banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative h-64 md:h-80 mb-8 border-3 border-neo-black shadow-neo-lg overflow-hidden"
        >
          {event.bannerImageUrl ? (
            <img src={bannerSrc} alt={event.title}
              className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full ${CATEGORY_COLORS[event.category] || 'bg-neo-lavender'}
                          flex items-center justify-center`}>
              <span className="font-heading-shade text-6xl text-neo-black/10">{event.category}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-neo-black/60 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex items-center gap-3 mb-3">
              <StatusBadge status={event.status} />
              {avgRating > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neo-black/40 backdrop-blur-sm border border-white/20 text-white font-heading text-xs">
                  <HiStar size={14} style={{ fill: '#FACC15' }} className="text-neo-yellow" />
                  {avgRating.toFixed(1)} ({totalReviewCount})
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <h1 className="font-heading text-2xl md:text-4xl text-white uppercase tracking-wider">
                {event.title}
              </h1>
              <button
                type="button"
                onClick={handleShareEvent}
                className="neo-btn neo-btn-sm bg-neo-white/90 hover:bg-neo-white text-neo-black"
                aria-label="Share this event"
                title="Share event"
              >
                <HiShare size={16} />
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Info pills */}
            <div className="flex flex-wrap gap-3">
              {[
                { icon: HiCalendar, text: formatDate(event.eventDate) },
                { icon: HiClock, text: `${formatTimeOrTbd(event.startTime)} - ${formatTimeOrTbd(event.endTime)}` },
                (showVenueLocationCard && venueDisplayName) && { icon: HiLocationMarker, text: venueDisplayName },
                { icon: HiTicket, text: event.category },
              ].filter(Boolean).map((item, i) => (
                <span key={i} className="neo-chip">
                  <item.icon size={16} />
                  {item.text}
                </span>
              ))}
            </div>

            {showVenueLocationCard && (
              <div className="neo-card neo-card-no-hover neo-retroui-panel p-4 bg-neo-cream">
                <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/70 mb-2">Venue Location</p>
                <p className="font-body text-sm text-neo-black/80 mb-3">
                  {venueDisplayName} - {venueDisplayAddress}
                </p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venueDisplayName || ''} ${venueDisplayAddress || ''}`.trim())}`}
                  target="_blank"
                  rel="noreferrer"
                  className="neo-btn neo-btn-sm bg-neo-white"
                >
                  Open in Maps
                </a>
              </div>
            )}

            {/* Description */}
            <div className="neo-card neo-card-no-hover neo-retroui-panel p-6">
              <h2 className="font-heading text-lg uppercase tracking-wider mb-4">About</h2>
              <p className="font-body text-sm leading-relaxed whitespace-pre-wrap">{eventDescription}</p>
              {organizerName ? (
                <p className="font-body text-sm text-neo-black/80 mt-4 pt-3 border-t-2 border-neo-black/15">
                  <strong>Organized by:</strong> {organizerName}
                </p>
              ) : null}
            </div>

            {/* Schedule */}
            {schedule.length > 0 && (
              <div className="neo-card neo-card-no-hover neo-retroui-panel p-6">
                <h2 className="font-heading text-lg uppercase tracking-wider mb-4">Schedule</h2>
                <div className="space-y-3">
                  {schedule.map((slot, i) => (
                    <motion.div
                      key={slot.id || i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex gap-4 p-4 bg-neo-cream border-3 border-neo-black/20 neo-retroui-inset"
                    >
                      <div className="text-center min-w-[60px]">
                        <p className="font-heading text-xs text-neo-black/65">{formatTimeOrTbd(slot.startTime)}</p>
                        <p className="font-body text-[10px] text-neo-black/55">{formatTimeOrTbd(slot.endTime)}</p>
                      </div>
                      <div className="border-l-3 border-neo-yellow pl-4">
                        <p className="font-heading text-sm uppercase tracking-wider">{slot.sessionTitle}</p>
                        {slot.sessionDate && (
                          <p className="font-body text-xs text-neo-black/70 mt-1">Date: {formatDate(slot.sessionDate)}</p>
                        )}
                        {slot.speakerName && (
                          <p className="font-body text-xs text-neo-black/65 mt-1">Speaker: {slot.speakerName}</p>
                        )}
                        {slot.locationNote && (
                          <p className="font-body text-xs text-neo-black/55">Location: {slot.locationNote}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {parsedTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {parsedTags.map((tag) => (
                  <span key={tag} className="neo-badge bg-neo-lavender text-neo-black">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* ───── Reviews Section ───── */}
            <div className="neo-card neo-card-no-hover neo-retroui-panel p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading text-lg uppercase tracking-wider">
                  Reviews {totalReviewCount > 0 && <span className="text-neo-black/55">({totalReviewCount})</span>}
                </h2>
                {avgRating > 0 && (
                  <div className="flex items-center gap-2">
                    <StarRating value={Math.round(avgRating)} size={18} />
                    <span className="font-heading text-sm">{avgRating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {isAdmin && (
                <p className="font-body text-[10px] text-neo-black/65 mb-4">
                  Admin moderation is enabled: you can remove inappropriate reviews from this list.
                </p>
              )}

              {/* Review form */}
              {canReview && (
                <form onSubmit={handleSubmitReview} className="mb-6 p-4 bg-neo-cream border-3 border-neo-black/20 neo-retroui-inset">
                  <p className="font-heading text-xs uppercase tracking-wider mb-3">Leave a Review</p>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-body text-xs text-neo-black/70">Your rating:</span>
                    <StarRating value={reviewRating} onChange={setReviewRating} interactive size={24} />
                    {reviewRating > 0 && <span className="font-body text-xs text-neo-black/65">{reviewRating}/5</span>}
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience (optional)..."
                    maxLength={1000}
                    rows={3}
                    className="neo-input w-full mb-3 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={reviewMutation.isPending || reviewRating < 1}
                    className="neo-btn neo-btn-sm bg-neo-yellow disabled:opacity-50"
                  >
                    {reviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>
              )}

              {/* My existing review */}
              {myReview && (
                <div className="mb-6 p-4 bg-neo-lavender/30 border-3 border-neo-black/20 neo-retroui-inset">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-xs uppercase tracking-wider">Your Review</span>
                      <StarRating value={editingMyReview ? editReviewRating : myReview.rating} size={14} onChange={setEditReviewRating} interactive={editingMyReview} />
                    </div>
                    <div className="flex items-center gap-2">
                      {!editingMyReview && (
                        <button
                          type="button"
                          onClick={startEditMyReview}
                          className="neo-btn neo-btn-sm bg-neo-white"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteReviewMutation.mutate(myReview._id)}
                        disabled={deleteReviewMutation.isPending}
                        className="neo-btn neo-btn-sm bg-neo-white text-neo-red"
                        title="Delete your review"
                      >
                        <HiTrash size={12} />
                      </button>
                    </div>
                  </div>

                  {editingMyReview ? (
                    <div className="space-y-2">
                      <textarea
                        value={editReviewComment}
                        onChange={(e) => setEditReviewComment(e.target.value)}
                        maxLength={1000}
                        rows={3}
                        className="neo-input w-full resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSaveMyReviewUpdate}
                          disabled={updateReviewMutation.isPending}
                          className="neo-btn neo-btn-sm bg-neo-yellow"
                        >
                          {updateReviewMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMyReview(false);
                            setEditReviewRating(Number(myReview?.rating || 0));
                            setEditReviewComment(myReview?.comment || '');
                          }}
                          className="neo-btn neo-btn-sm bg-neo-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    myReview.comment && (
                      <p className="font-body text-xs text-neo-black/80">{myReview.comment}</p>
                    )
                  )}
                </div>
              )}

              {!isAuthenticated && (
                <p className="font-body text-xs text-neo-black/65 mb-4">
                  <Link to="/login" className="text-neo-blue underline">Log in</Link> and register to leave a review.
                </p>
              )}

              {isAuthenticated && !hasReviewEligibleRegistration && !myReview && !isAdmin && !isVendorOwnEvent && (
                <p className="font-body text-xs text-neo-black/65 mb-4">
                  You need a registered or checked-in ticket for this event before you can leave a review.
                </p>
              )}

              {/* Reviews list */}
              {allReviews.length === 0 ? (
                <p className="font-body text-xs text-neo-black/65">No reviews yet. Be the first to review!</p>
              ) : (
                <div className="space-y-3">
                  {allReviews.map((review) => (
                    <motion.div
                      key={review._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-3 border-b-2 border-neo-black/10 last:border-b-0 neo-retroui-inset"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-neo-blue border-2 border-neo-black flex items-center justify-center
                                        font-heading text-[10px] text-white uppercase flex-shrink-0">
                            {review.userName?.[0] || '?'}
                          </div>
                          <span className="font-heading text-[10px] uppercase tracking-wider">{review.userName}</span>
                          <StarRating value={review.rating} size={12} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-body text-[10px] text-neo-black/55">
                            {formatRelative(review.createdAt)}
                          </span>
                          {isAdmin && String(review.userId) !== String(user?.userId) && (
                            <button
                              type="button"
                              onClick={() => deleteReviewMutation.mutate(review._id)}
                              disabled={deleteReviewMutation.isPending}
                              className="neo-btn neo-btn-sm bg-neo-white text-neo-red"
                              title="Admin delete review"
                            >
                              <HiTrash size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="font-body text-xs text-neo-black/80 ml-9">{review.comment}</p>
                      )}
                    </motion.div>
                  ))}
                  {hasMoreReviews && (
                    <button
                      type="button"
                      onClick={() => fetchMoreReviews()}
                      disabled={isFetchingMoreReviews}
                      className="neo-btn neo-btn-sm bg-neo-cream w-full"
                    >
                      {isFetchingMoreReviews ? 'Loading...' : 'Load More Reviews'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Ticket Tiers */}
          <div className="space-y-6">
            <div className="neo-card p-6 sticky top-24">
              <h2 className="font-heading text-lg uppercase tracking-wider mb-4">
                <HiTicket className="inline mr-2" />
                Tickets
              </h2>

              <div className="space-y-3 mb-6">
                {tiers.map((tier) => {
                  const isSelected = selectedTier === tier.id;
                  const registeredCount = Number(countsByTier[String(tier.id)] || 0);
                  const waitlistedCount = Number(waitlistCountsByTier[String(tier.id)] || 0);
                  const capacity = Number(tier.capacity || 0);
                  const remaining = Math.max(capacity - registeredCount, 0);
                  const soldOut = remaining <= 0;
                  const ownedCount = Number(ownedByTier[String(tier.id)] || 0);
                  return (
                    <motion.button
                      key={tier.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedTier(tier.id)}
                      className={`w-full text-left p-4 border-3 transition-all
                                ${isSelected 
                                  ? 'border-neo-yellow bg-neo-yellow/10 shadow-neo-yellow'
                                  : 'border-neo-black bg-neo-white hover:bg-neo-cream'
                                }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-heading text-sm uppercase tracking-wider">{tier.name}</span>
                        <span className="font-heading text-lg text-neo-red">
                          {tier.price === 0 ? 'FREE' : formatCurrency(tier.price, tier.currency)}
                        </span>
                      </div>
                      {tier.description && (
                        <p className="font-body text-xs text-neo-black/65">{tier.description}</p>
                      )}
                      {soldOut ? (
                        <p className="font-body text-[10px] text-neo-red mt-2 uppercase tracking-wider">
                          Sold out
                        </p>
                      ) : (
                        <p className="font-body text-[10px] text-neo-black/55 mt-2">
                          {remaining} left of {capacity}
                        </p>
                      )}
                      {soldOut && waitlistEnabled && (
                        <p className="font-body text-[10px] text-neo-black/70 mt-1">
                          Tickets are sold out, join waitlist?
                        </p>
                      )}
                      {waitlistedCount > 0 && (
                        <p className="font-body text-[10px] text-neo-black/70 mt-1">
                          {waitlistedCount} people in waitlist currently
                        </p>
                      )}
                      {ownedCount > 0 && (
                        <p className="font-body text-[10px] text-neo-blue mt-1">
                          You own {ownedCount} ticket(s) in this tier
                        </p>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {totalOwned > 0 && (
                <div className="mb-4 p-3 bg-neo-lavender border-2 border-neo-black">
                  <p className="font-heading text-[10px] uppercase tracking-wider">
                    You currently own {totalOwned} ticket(s) for this event
                  </p>
                </div>
              )}

              <div className="mb-6">
                <label className="neo-label" htmlFor="ticket-quantity">Quantity</label>
                <input
                  id="ticket-quantity"
                  type="number"
                  min={1}
                  max={selectedTierMaxPerOrder}
                  value={effectiveQuantity}
                  onChange={(e) => setQuantity(Math.min(selectedTierMaxPerOrder, Math.max(1, Number(e.target.value) || 1)))}
                  disabled={selectedTierSoldOutNoWaitlist}
                  className="neo-input"
                />
                <p className="font-body text-[10px] text-neo-black/65 mt-1">
                  Max per person for this tier: {selectedTierMaxPerOrder}.
                </p>
              </div>

              {isAuthenticated ? (
                <div className="space-y-2">
                  {totalOwned > 0 && (
                    <Link to="/dashboard" className="block w-full text-center neo-btn neo-btn-lg bg-neo-white">
                      Check Tickets
                    </Link>
                  )}
                  <button
                    onClick={handleOpenCheckout}
                    disabled={registerMutation.isPending || !selectedTier || selectedTierSoldOutNoWaitlist}
                    className="w-full neo-btn-primary neo-btn-lg disabled:opacity-50"
                  >
                    {registerMutation.isPending
                      ? 'Processing...'
                      : selectedTierSoldOutNoWaitlist
                        ? 'Sold Out'
                        : selectedTierCanJoinWaitlist
                          ? 'Join Waitlist'
                          : (totalOwned > 0 ? 'Buy More Tickets' : 'Register Now')}
                  </button>
                  {selectedTierSoldOutNoWaitlist && (
                    <p className="font-body text-[11px] text-neo-red mt-2">Tickets are sold out.</p>
                  )}
                  {selectedTierCanJoinWaitlist && (
                    <p className="font-body text-[11px] text-neo-black/75 mt-2">Tickets are sold out, join waitlist?</p>
                  )}
                </div>
              ) : (
                <Link to="/login" className="block w-full text-center neo-btn neo-btn-lg bg-neo-yellow">
                  Login to Register
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <Drawer
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Ticket Checkout"
        description="Review event name, tickets, and payment details before continuing."
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setCheckoutOpen(false)}
              className="neo-btn neo-btn-sm bg-neo-white"
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={handleProceedCheckout}
              disabled={registerMutation.isPending || !selectedTier}
              className="neo-btn neo-btn-sm bg-neo-yellow disabled:opacity-50"
            >
              {registerMutation.isPending ? 'Processing...' : 'Proceed to Checkout'}
            </button>
          </div>
        )}
      >
        <div className="space-y-3">
          <div className="neo-card neo-card-no-hover neo-retroui-inset p-4">
            <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/65">Event Name</p>
            <p className="font-heading text-sm uppercase tracking-wider mt-1">{event.title}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="neo-card neo-card-no-hover p-4 bg-neo-cream">
              <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/65">Tickets</p>
              <p className="font-heading text-sm mt-1">{selectedTierConfig?.name || 'No tier selected'}</p>
              <p className="font-body text-xs text-neo-black/70 mt-1">Quantity: {effectiveQuantity}</p>
            </div>

            <div className="neo-card neo-card-no-hover p-4 bg-neo-lavender/35">
              <p className="font-heading text-[10px] uppercase tracking-wider text-neo-black/65">Payment</p>
              <p className="font-body text-xs text-neo-black/70 mt-1">Subtotal: {formatCurrency(estimatedSubtotal, selectedTierConfig?.currency)}</p>
              <p className="font-body text-xs text-neo-black/70">Platform fee (10%): {formatCurrency(estimatedFees, selectedTierConfig?.currency)}</p>
              <p className="font-heading text-sm mt-1">Total: {formatCurrency(estimatedTotal, selectedTierConfig?.currency)}</p>
            </div>
          </div>

          <p className="font-body text-xs text-neo-black/65">
            {selectedTierCanJoinWaitlist
              ? 'This tier is currently sold out. Proceed to join the waitlist for the selected quantity.'
              : 'Proceeding creates your registration and redirects to secure payment checkout when payment is required.'}
          </p>
        </div>
      </Drawer>
    </div>
  );
}
