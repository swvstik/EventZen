package com.eventzen.service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.eventzen.dto.request.CreateEventRequest;
import com.eventzen.dto.request.TicketTierRequest;
import com.eventzen.dto.request.UpdateEventRequest;
import com.eventzen.dto.response.EventOwnershipResponse;
import com.eventzen.dto.response.EventResponse;
import com.eventzen.dto.response.EventSummaryResponse;
import com.eventzen.dto.response.PagedResponse;
import com.eventzen.exception.EventZenException;
import com.eventzen.model.BookingStatus;
import com.eventzen.model.Event;
import com.eventzen.model.EventCategory;
import com.eventzen.model.EventStatus;
import com.eventzen.model.TicketTier;
import com.eventzen.model.Venue;
import com.eventzen.model.VenueBooking;
import com.eventzen.repository.EventRepository;
import com.eventzen.repository.VenueBookingRepository;
import com.eventzen.repository.VenueRepository;
import com.eventzen.security.AuthenticatedUser;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository   eventRepo;
    private final VenueRepository   venueRepo;
    private final VenueBookingRepository bookingRepo;
    private final AttendeeClientService attendeeClientService;
    private final NotificationClientService notificationClientService;
    private final VendorProfileClientService vendorProfileClientService;
    private final JdbcTemplate jdbcTemplate;

    @Value("${internal.secret}")
    private String internalSecret;

    @PostConstruct
    public void ensureFullTextIndex() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(1)
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name = 'events'
                  AND index_name = 'ft_events_search'
                """,
                Integer.class
            );

            if (count != null && count == 0) {
                jdbcTemplate.execute("ALTER TABLE events ADD FULLTEXT INDEX ft_events_search (title, description)");
                log.info("Created FULLTEXT index ft_events_search on events(title, description)");
            }
        } catch (RuntimeException ex) {
            log.warn("FULLTEXT index bootstrap skipped: {}", ex.getMessage());
        }
    }

    // -- List (paginated + filtered) -----------------------------------------

    @Transactional(readOnly = true)
    public PagedResponse<EventSummaryResponse> listEvents(
            String q, EventCategory category, EventStatus status,
            LocalDate date, int page, int limit, AuthenticatedUser actor) {

        PageRequest pageable = PageRequest.of(page, limit, Sort.by("eventDate").ascending());
        String normalizedQuery = (q != null && !q.isBlank()) ? q.trim() : null;
        String draftOwnerUserId = resolveDraftOwnerForVisibility(actor);
        // Drafts are owner-scoped only; admins must not see all drafts in list views.
        boolean includeAllDrafts = false;

        Page<Event> result = eventRepo.findAllFiltered(
            normalizedQuery,
            category,
            status,
            date,
            draftOwnerUserId,
            includeAllDrafts,
            pageable
        );

        return new PagedResponse<>(result, e -> new EventSummaryResponse((Event) e));
    }

    // -- Get single event ----------------------------------------------------

    @Transactional(readOnly = true)
    public EventResponse getEvent(Long id, AuthenticatedUser actor) {
        Event event = findOrThrow(id);
        assertCanView(event, actor);
        int attendeeCount = attendeeClientService.getRegisteredCount(event.getId());
        String organizerName = vendorProfileClientService.resolveVendorDisplayName(event.getVendorUserId());
        return new EventResponse(event, attendeeCount, organizerName);
    }

    // -- Create --------------------------------------------------------------

    @Transactional
    public EventResponse createEvent(CreateEventRequest req, AuthenticatedUser actor) {
        assertCanCreate(actor);
        assertEventDateNotInPast(req.getEventDate());
        LocalDate normalizedEndDate = req.getEndDate() != null ? req.getEndDate() : req.getEventDate();
        assertValidEventRange(req.getEventDate(), normalizedEndDate);
        assertValidEventWindow(req.getStartTime(), req.getEndTime());
        Venue venue = resolveVenue(req.getVenueId());
        assertTicketCapacityWithinVenue(req.getTicketTiers(), venue);
        EventStatus initialStatus = resolveInitialStatus(req, actor);

        Event event = Event.builder()
            .title(req.getTitle())
            .description(req.getDescription())
            .bannerImageUrl(req.getBannerImageUrl())
            .eventDate(req.getEventDate())
            .endDate(normalizedEndDate)
            .startTime(req.getStartTime())
            .endTime(req.getEndTime())
            .venue(venue)
            .category(req.getCategory())
            .tags(req.getTags() != null ? req.getTags() : new ArrayList<>())
            .status(initialStatus)
                .allowWaitlist(req.getAllowWaitlist() == null ? Boolean.TRUE : req.getAllowWaitlist())
            .vendorUserId(actor.getUserId())
            .ticketTiers(new ArrayList<>())
            .scheduleSlots(new ArrayList<>())
               .ownVenueName(venue != null ? null : trimToNull(req.getOwnVenueName()))
               .ownVenueAddress(venue != null ? null : trimToNull(req.getOwnVenueAddress()))
            .build();

        // Attach ticket tiers
        if (req.getTicketTiers() != null) {
            req.getTicketTiers().forEach(t -> {
                TicketTier tier = TicketTier.builder()
                    .event(event)
                    .name(t.getName())
                    .price(t.getPrice())
                    .currency(t.getCurrency() != null ? t.getCurrency() : "INR")
                    .capacity(t.getCapacity())
                    .maxPerOrder(t.getMaxPerOrder() != null ? t.getMaxPerOrder() : 10)
                    .description(t.getDescription())
                    .build();
                event.getTicketTiers().add(tier);
            });
        }

        Event saved = eventRepo.save(event);
        if (saved.getStatus() == EventStatus.PENDING_APPROVAL) {
            notificationClientService.notifyEventPendingApproval(saved);
        }
        autoBookVenueIfPublished(saved);
        return new EventResponse(saved);
    }

    // -- Update --------------------------------------------------------------

    @Transactional
    public EventResponse updateEvent(Long id, UpdateEventRequest req, AuthenticatedUser actor) {
        Event event = findOrThrow(id);
        assertCanModify(event, actor);

        if (event.getStatus() == EventStatus.CANCELLED) {
            throw EventZenException.badRequest("Cancelled events are read-only.");
        }

        if (req.getEventDate() != null) {
            assertEventDateNotInPast(req.getEventDate());
        }

        LocalDate nextEventDate = req.getEventDate() != null ? req.getEventDate() : event.getEventDate();
        LocalDate nextEndDate = req.getEndDate() != null
            ? req.getEndDate()
            : (event.getEndDate() != null ? event.getEndDate() : nextEventDate);
        assertValidEventRange(nextEventDate, nextEndDate);

        LocalTime nextStart = req.getStartTime() != null ? req.getStartTime() : event.getStartTime();
        LocalTime nextEnd   = req.getEndTime() != null ? req.getEndTime() : event.getEndTime();
        assertValidEventWindow(nextStart, nextEnd);

        if (req.getTitle()          != null) event.setTitle(req.getTitle());
        if (req.getDescription()    != null) event.setDescription(req.getDescription());
        if (req.getBannerImageUrl() != null) event.setBannerImageUrl(req.getBannerImageUrl());
        if (req.getEventDate()      != null) event.setEventDate(req.getEventDate());
        if (req.getEndDate()        != null) event.setEndDate(req.getEndDate());
        if (req.getStartTime()      != null) event.setStartTime(req.getStartTime());
        if (req.getEndTime()        != null) event.setEndTime(req.getEndTime());
        if (req.getCategory()       != null) event.setCategory(req.getCategory());
        if (req.getTags()           != null) event.setTags(req.getTags());
        if (req.getAllowWaitlist()  != null) event.setAllowWaitlist(req.getAllowWaitlist());

        if (req.getVenueId() != null) {
            event.setVenue(resolveVenue(req.getVenueId()));
            event.setOwnVenueName(null);
            event.setOwnVenueAddress(null);
        } else {
            if (req.getOwnVenueName() != null) event.setOwnVenueName(trimToNull(req.getOwnVenueName()));
            if (req.getOwnVenueAddress() != null) event.setOwnVenueAddress(trimToNull(req.getOwnVenueAddress()));
        }

        Venue targetVenue = event.getVenue();
        List<TicketTierRequest> effectiveTiers = req.getTicketTiers() != null
            ? req.getTicketTiers()
            : event.getTicketTiers().stream().map(existing -> {
                TicketTierRequest tier = new TicketTierRequest();
                tier.setId(existing.getId());
                tier.setName(existing.getName());
                tier.setPrice(existing.getPrice());
                tier.setCurrency(existing.getCurrency());
                tier.setCapacity(existing.getCapacity());
                tier.setMaxPerOrder(existing.getMaxPerOrder());
                tier.setDescription(existing.getDescription());
                return tier;
            }).toList();

        assertTicketCapacityWithinVenue(effectiveTiers, targetVenue);

        // Replace ticket tiers if provided
        if (req.getTicketTiers() != null) {
            mergeTicketTiers(event, req.getTicketTiers());
        }

        return new EventResponse(eventRepo.save(event));
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    // -- Delete behavior by lifecycle ------------------------------------------

    @Transactional
    public void deleteEvent(Long id, AuthenticatedUser actor) {
        Event event = findOrThrow(id);
        assertCanModify(event, actor);

        if (event.getStatus() == EventStatus.DRAFT) {
            eventRepo.delete(event);
            return;
        }

        event.setStatus(EventStatus.CANCELLED);
        eventRepo.save(event);

        boolean synced = attendeeClientService.cancelRegistrationsForEvent(event.getId());
        if (!synced) {
            log.warn("Event {} marked CANCELLED but attendee cancellation sync could not be confirmed.", event.getId());
        }
    }

    // -- Submit for approval (VENDOR only) -----------------------------------

    @Transactional
    public EventResponse submitForApproval(Long id, AuthenticatedUser actor) {
        Event event = findOrThrow(id);

        String role = actor.getRole();
        if (!("VENDOR".equals(role) || "ADMIN".equals(role))) {
            throw EventZenException.forbidden("Only vendors or admins can submit events for approval.");
        }
        if ("VENDOR".equals(role) && !event.getVendorUserId().equals(actor.getUserId())) {
            throw EventZenException.forbidden("You can only submit your own events.");
        }
        if (event.getStatus() != EventStatus.DRAFT) {
            throw EventZenException.badRequest(
                "Only DRAFT events can be submitted. Current status: " + event.getStatus());
        }

        event.setStatus(EventStatus.PENDING_APPROVAL);
        Event saved = eventRepo.save(event);
        notificationClientService.notifyEventPendingApproval(saved);
        return new EventResponse(saved);
    }

    // -- Change status (ADMIN only) -------------------------------------------

    @Transactional
    public EventResponse changeStatus(Long id, EventStatus newStatus, AuthenticatedUser actor) {
        if (!"ADMIN".equals(actor.getRole())) {
            throw EventZenException.forbidden("Only admins can change event status.");
        }

        Event event = findOrThrow(id);
        EventStatus previousStatus = event.getStatus();
        event.setStatus(newStatus);
        Event saved = eventRepo.save(event);
        boolean isApprovalDecision = previousStatus == EventStatus.PENDING_APPROVAL
            && (newStatus == EventStatus.PUBLISHED || newStatus == EventStatus.DRAFT);
        if (isApprovalDecision) {
            notificationClientService.notifyEventStatusDecision(saved, newStatus);
        }
        if (newStatus == EventStatus.PUBLISHED) {
            autoBookVenueIfPublished(saved);
        }
        return new EventResponse(saved);
    }

    // -- Update avg rating (internal - Node.js reviews module) ---------------

    @Transactional
    public void updateRating(Long id, BigDecimal avgRating, String secret) {
        assertInternalSecret(secret);
        int updated = eventRepo.updateAvgRating(id, avgRating);
        if (updated == 0) throw EventZenException.notFound("Event not found: " + id);
    }

    @Transactional(readOnly = true)
    public EventOwnershipResponse getOwnership(Long id, String secret) {
        assertInternalSecret(secret);
        Event event = findOrThrow(id);

        return new EventOwnershipResponse(
            event.getId(),
            event.getVendorUserId(),
            event.getTitle(),
            event.getStatus().name()
        );
    }

    // -- Helpers -------------------------------------------------------------

    private Event findOrThrow(Long id) {
        return eventRepo.findById(id)
            .orElseThrow(() -> EventZenException.notFound("Event not found: " + id));
    }

    private Venue resolveVenue(Long venueId) {
        if (venueId == null) return null;
        return venueRepo.findById(venueId)
            .orElseThrow(() -> EventZenException.notFound("Venue not found: " + venueId));
    }

    private void mergeTicketTiers(Event event, List<TicketTierRequest> requests) {
        List<TicketTier> existingTiers = event.getTicketTiers();
        Map<Long, TicketTier> byId = new HashMap<>();
        for (TicketTier tier : existingTiers) {
            if (tier.getId() != null) {
                byId.put(tier.getId(), tier);
            }
        }

        List<TicketTier> retained = new ArrayList<>();

        for (int i = 0; i < requests.size(); i++) {
            TicketTierRequest request = requests.get(i);
            TicketTier target = null;

            if (request.getId() != null) {
                target = byId.get(request.getId());
            }

            // Backward-compat fallback when old clients send tiers without ids.
            if (target == null && request.getId() == null && i < existingTiers.size()) {
                TicketTier fallback = existingTiers.get(i);
                if (!retained.contains(fallback)) {
                    target = fallback;
                }
            }

            if (target == null) {
                target = new TicketTier();
                target.setEvent(event);
            }

            target.setName(request.getName());
            target.setPrice(request.getPrice());
            target.setCurrency(request.getCurrency() != null ? request.getCurrency() : "INR");
            target.setCapacity(request.getCapacity());
            target.setMaxPerOrder(request.getMaxPerOrder() != null ? request.getMaxPerOrder() : 10);
            target.setDescription(request.getDescription());

            retained.add(target);
        }

        boolean protectExistingTierMapping = event.getStatus() == EventStatus.PUBLISHED
            || event.getStatus() == EventStatus.ONGOING
            || event.getStatus() == EventStatus.COMPLETED;

        if (protectExistingTierMapping) {
            long removedExistingTierCount = existingTiers.stream()
                .filter(tier -> tier.getId() != null && !retained.contains(tier))
                .count();

            if (removedExistingTierCount > 0) {
                throw EventZenException.badRequest(
                    "Cannot remove existing ticket tiers after event is published. Keep existing tiers and adjust capacities/prices if needed."
                );
            }
        }

        existingTiers.removeIf(tier -> !retained.contains(tier));
        for (TicketTier tier : retained) {
            if (!existingTiers.contains(tier)) {
                existingTiers.add(tier);
            }
        }
    }

    /** VENDOR may only modify their own events. ADMIN may modify any event. */
    private void assertCanCreate(AuthenticatedUser actor) {
        String role = actor.getRole();
        if ("ADMIN".equals(role) || "VENDOR".equals(role)) return;
        throw EventZenException.forbidden("Only vendors or admins can create events.");
    }

    private void assertCanModify(Event event, AuthenticatedUser actor) {
        String role = actor.getRole();
        if ("ADMIN".equals(role)) return;
        if ("VENDOR".equals(role) && event.getVendorUserId().equals(actor.getUserId())) return;
        throw EventZenException.forbidden("You do not have permission to modify this event.");
    }

    private void assertCanView(Event event, AuthenticatedUser actor) {
        if (event.getStatus() != EventStatus.DRAFT) return;

        if (actor != null
            && ("VENDOR".equals(actor.getRole()) || "ADMIN".equals(actor.getRole()))
            && event.getVendorUserId().equals(actor.getUserId())) {
            return;
        }

        throw EventZenException.notFound("Event not found: " + event.getId());
    }

    private String resolveDraftOwnerForVisibility(AuthenticatedUser actor) {
        if (actor != null && ("VENDOR".equals(actor.getRole()) || "ADMIN".equals(actor.getRole()))) {
            return actor.getUserId();
        }
        return null;
    }

    private EventStatus resolveInitialStatus(CreateEventRequest req, AuthenticatedUser actor) {
        boolean saveAsDraft = req.getSaveAsDraft() == null || req.getSaveAsDraft();
        String role = actor.getRole();

        if ("VENDOR".equals(role)) {
            return saveAsDraft ? EventStatus.DRAFT : EventStatus.PENDING_APPROVAL;
        }

        if ("ADMIN".equals(role)) {
            return saveAsDraft ? EventStatus.DRAFT : EventStatus.PUBLISHED;
        }

        throw EventZenException.forbidden("Only vendors or admins can create events.");
    }

    private void assertInternalSecret(String providedSecret) {
        if (providedSecret == null || internalSecret == null) {
            throw EventZenException.unauthorized("Invalid internal secret.");
        }

        boolean isMatch = MessageDigest.isEqual(
            providedSecret.getBytes(StandardCharsets.UTF_8),
            internalSecret.getBytes(StandardCharsets.UTF_8)
        );

        if (!isMatch) {
            throw EventZenException.unauthorized("Invalid internal secret.");
        }
    }

    private void assertEventDateNotInPast(LocalDate eventDate) {
        if (eventDate != null && eventDate.isBefore(LocalDate.now())) {
            throw EventZenException.badRequest("Event date must be today or in the future.");
        }
    }

    private void assertValidEventRange(LocalDate eventDate, LocalDate endDate) {
        if (eventDate == null || endDate == null) return;
        if (endDate.isBefore(eventDate)) {
            throw EventZenException.badRequest("endDate must be on or after eventDate.");
        }
    }

    private void assertValidEventWindow(LocalTime startTime, LocalTime endTime) {
        if (startTime == null || endTime == null) return;
        if (!endTime.isAfter(startTime)) {
            throw EventZenException.badRequest("endTime must be after startTime.");
        }
    }

    /**
     * Auto-create a CONFIRMED VenueBooking when an event becomes PUBLISHED,
     * if it has a venue and date/time window.
     * Silently skips if booking already exists or conflicts.
     */
    private void autoBookVenueIfPublished(Event event) {
        if (event.getStatus() != EventStatus.PUBLISHED) return;
        if (event.getVenue() == null) return;
        if (event.getEventDate() == null || event.getStartTime() == null || event.getEndTime() == null) return;

        // Check if a booking already exists for this event + venue
        long existing = bookingRepo.countByVenueIdAndEventIdAndStatus(
            event.getVenue().getId(), event.getId(), BookingStatus.CONFIRMED
        );
        if (existing > 0) return;

        try {
            java.time.LocalDateTime startDt = java.time.LocalDateTime.of(event.getEventDate(), event.getStartTime());
            java.time.LocalDateTime endDt = java.time.LocalDateTime.of(
                event.getEndDate() != null ? event.getEndDate() : event.getEventDate(),
                event.getEndTime()
            );

            VenueBooking booking = VenueBooking.builder()
                .venue(event.getVenue())
                .event(event)
                .startTime(startDt)
                .endTime(endDt)
                .status(BookingStatus.CONFIRMED)
                .bookedByUserId(event.getVendorUserId())
                .build();

            bookingRepo.save(booking);
            log.info("Auto-booked venue {} for published event {}", event.getVenue().getId(), event.getId());
        } catch (Exception ex) {
            log.warn("Auto venue booking skipped for event {}: {}", event.getId(), ex.getMessage());
        }
    }

    private void assertTicketCapacityWithinVenue(List<? extends TicketTierRequest> tiers, Venue venue) {
        if (venue == null || tiers == null || tiers.isEmpty()) return;
        if (venue.getCapacity() == null || venue.getCapacity() < 1) return;

        int totalTierCapacity = tiers.stream()
            .mapToInt(t -> {
                Integer capacity = t.getCapacity();
                return capacity != null ? capacity.intValue() : 0;
            })
            .sum();

        if (totalTierCapacity > venue.getCapacity()) {
            throw EventZenException.badRequest(
                "Total ticket tier capacity (" + totalTierCapacity + ") exceeds venue capacity (" + venue.getCapacity() + ")."
            );
        }
    }
}
