package com.eventzen.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.eventzen.dto.request.BookVenueRequest;
import com.eventzen.dto.request.VenueRequest;
import com.eventzen.dto.response.VenueBookingAllocationResponse;
import com.eventzen.dto.response.VenueBookingResponse;
import com.eventzen.dto.response.VenueResponse;
import com.eventzen.exception.ConflictException;
import com.eventzen.exception.EventZenException;
import com.eventzen.model.BookingStatus;
import com.eventzen.model.Event;
import com.eventzen.model.Venue;
import com.eventzen.model.VenueBooking;
import com.eventzen.repository.EventRepository;
import com.eventzen.repository.VenueBookingRepository;
import com.eventzen.repository.VenueRepository;
import com.eventzen.security.AuthenticatedUser;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class VenueService {

    private final VenueRepository        venueRepo;
    private final VenueBookingRepository bookingRepo;
    private final EventRepository        eventRepo;
    private final VenueBookingEventPublisher venueBookingEventPublisher;

    @Value("${internal.secret}")
    private String internalSecret;

    // -- Venue CRUD (ADMIN only) ----------------------------------------------

    @Transactional(readOnly = true)
    public List<VenueResponse> listVenues(String city, Integer capacity) {
        return venueRepo.findAllFiltered(
                (city != null && city.isBlank()) ? null : city,
                capacity
            ).stream().map(VenueResponse::new).toList();
    }

    @Transactional(readOnly = true)
    public VenueResponse getVenue(Long id) {
        return new VenueResponse(findVenueOrThrow(id));
    }

    @Transactional
    public VenueResponse createVenue(VenueRequest req, AuthenticatedUser actor) {
        assertAdmin(actor);
        Venue venue = Venue.builder()
            .name(req.getName())
            .address(req.getAddress())
            .city(req.getCity())
            .capacity(req.getCapacity())
            .facilities(req.getFacilities())
            .contactName(req.getContactName())
            .contactEmail(req.getContactEmail())
            .contactPhone(req.getContactPhone())
            .dailyRate(req.getDailyRate())
            .rateCurrency(normalizeCurrencyOrDefault(req.getRateCurrency()))
            .build();
        return new VenueResponse(venueRepo.save(venue));
    }

    @Transactional
    public VenueResponse updateVenue(Long id, VenueRequest req, AuthenticatedUser actor) {
        assertAdmin(actor);
        Venue venue = findVenueOrThrow(id);
        if (req.getName()         != null) venue.setName(req.getName());
        if (req.getAddress()      != null) venue.setAddress(req.getAddress());
        if (req.getCity()         != null) venue.setCity(req.getCity());
        if (req.getCapacity()     != null) venue.setCapacity(req.getCapacity());
        if (req.getFacilities()   != null) venue.setFacilities(req.getFacilities());
        if (req.getContactName()  != null) venue.setContactName(req.getContactName());
        if (req.getContactEmail() != null) venue.setContactEmail(req.getContactEmail());
        if (req.getContactPhone() != null) venue.setContactPhone(req.getContactPhone());
        if (req.getDailyRate()    != null) venue.setDailyRate(req.getDailyRate());
        if (req.getRateCurrency() != null) venue.setRateCurrency(normalizeCurrencyOrDefault(req.getRateCurrency()));
        return new VenueResponse(venueRepo.save(venue));
    }

    @Transactional
    public void deleteVenue(Long id, AuthenticatedUser actor) {
        assertAdmin(actor);
        if (!venueRepo.existsById(id)) throw EventZenException.notFound("Venue not found: " + id);
        venueRepo.deleteById(id);
    }

    // -- Bookings -------------------------------------------------------------

    /**
     * THE STAR FEATURE: @Transactional conflict detection.
     * Step 1 - count non-cancelled bookings whose window overlaps the requested window.
     * Step 2 - if count > 0, throw 409 ConflictException.
     * Step 3 - otherwise save the new booking.
     * The @Transactional ensures the check+save is atomic (no race condition).
     */
    @Transactional
    public VenueBookingResponse bookVenue(Long venueId, BookVenueRequest req, AuthenticatedUser actor) {
        assertVendorOrAdmin(actor);
        Venue venue = findVenueOrThrow(venueId);
        Event event = eventRepo.findById(req.getEventId())
            .orElseThrow(() -> EventZenException.notFound("Event not found: " + req.getEventId()));

        if ("VENDOR".equals(actor.getRole()) && !event.getVendorUserId().equals(actor.getUserId())) {
            throw EventZenException.forbidden("Vendors can only book venues for their own events.");
        }

        if (req.getEndTime().isBefore(req.getStartTime()) ||
            req.getEndTime().isEqual(req.getStartTime())) {
            throw EventZenException.badRequest("endTime must be after startTime.");
        }

        if (venue.getDailyRate() == null || venue.getDailyRate().compareTo(BigDecimal.ZERO) <= 0) {
            throw EventZenException.badRequest("Venue daily rate must be configured before booking.");
        }

        long conflicts = bookingRepo.countConflicting(venueId, req.getStartTime(), req.getEndTime());
        if (conflicts > 0) {
            throw new ConflictException(
                "Venue '" + venue.getName() + "' is already booked during that time window. " +
                "Choose a different time or venue.");
        }

        int bookingDays = calculateBookingDays(req.getStartTime(), req.getEndTime());
        BigDecimal venueDailyRate = venue.getDailyRate().setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalVenueCost = venueDailyRate
            .multiply(BigDecimal.valueOf(bookingDays))
            .setScale(2, RoundingMode.HALF_UP);

        VenueBooking booking = VenueBooking.builder()
            .venue(venue)
            .event(event)
            .startTime(req.getStartTime())
            .endTime(req.getEndTime())
            .status(BookingStatus.CONFIRMED)
            .bookedByUserId(actor.getUserId())
            .venueDailyRate(venueDailyRate)
            .bookingDays(bookingDays)
            .totalVenueCost(totalVenueCost)
            .costCurrency(normalizeCurrencyOrDefault(venue.getRateCurrency()))
            .build();

        VenueBooking savedBooking = bookingRepo.save(booking);
        venueBookingEventPublisher.publishBookingCreated(savedBooking);
        return new VenueBookingResponse(savedBooking);
    }

    /** All CONFIRMED bookings for a venue - availability calendar. */
    @Transactional(readOnly = true)
    public List<VenueBookingResponse> getAvailability(Long venueId) {
        findVenueOrThrow(venueId);
        return bookingRepo.findByVenueIdAndStatus(venueId, BookingStatus.CONFIRMED)
            .stream().map(VenueBookingResponse::new).toList();
    }

    /** All CONFIRMED bookings for multiple venues keyed by venueId. */
    @Transactional(readOnly = true)
    public Map<Long, List<VenueBookingResponse>> getAvailabilityBulk(List<Long> venueIds) {
        if (venueIds == null || venueIds.isEmpty()) {
            return Collections.emptyMap();
        }

        return bookingRepo.findByVenueIdInAndStatus(venueIds, BookingStatus.CONFIRMED)
            .stream()
            .collect(Collectors.groupingBy(
                booking -> booking.getVenue().getId(),
                Collectors.mapping(VenueBookingResponse::new, Collectors.toList())
            ));
    }

    /** All bookings for a venue (all statuses) - admin history. */
    @Transactional(readOnly = true)
    public List<VenueBookingResponse> getAllBookings(Long venueId, AuthenticatedUser actor) {
        assertVendorOrAdmin(actor);
        findVenueOrThrow(venueId);

        List<VenueBooking> bookings;
        if ("ADMIN".equals(actor.getRole())) {
            bookings = bookingRepo.findByVenueIdOrderByStartTimeAsc(venueId);
        } else {
            bookings = bookingRepo.findByVenueIdAndEventVendorUserIdOrderByStartTimeAsc(
                venueId, actor.getUserId());
        }

        return bookings.stream().map(VenueBookingResponse::new).toList();
    }

    @Transactional(readOnly = true)
    public VenueBookingAllocationResponse getLatestConfirmedBookingAllocation(Long eventId, String secret) {
        assertInternalSecret(secret);
        VenueBooking booking = bookingRepo.findFirstByEventIdAndStatusOrderByCreatedAtDesc(eventId, BookingStatus.CONFIRMED);
        if (booking == null) {
            throw EventZenException.notFound("No confirmed venue booking found for event: " + eventId);
        }
        return new VenueBookingAllocationResponse(booking);
    }

    /** Cancel a booking - slot becomes available again. */
    @Transactional
    public VenueBookingResponse cancelBooking(Long bookingId, AuthenticatedUser actor) {
        assertVendorOrAdmin(actor);
        VenueBooking booking = bookingRepo.findById(bookingId)
            .orElseThrow(() -> EventZenException.notFound("Booking not found: " + bookingId));

        if ("VENDOR".equals(actor.getRole()) &&
            !booking.getEvent().getVendorUserId().equals(actor.getUserId())) {
            throw EventZenException.forbidden("Vendors can only cancel bookings for their own events.");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw EventZenException.badRequest("Booking is already cancelled.");
        }
        booking.setStatus(BookingStatus.CANCELLED);
        VenueBooking saved = bookingRepo.save(booking);
        venueBookingEventPublisher.publishBookingCancelled(saved);
        return new VenueBookingResponse(saved);
    }

    // -- Helper ---------------------------------------------------------------

    private Venue findVenueOrThrow(Long id) {
        return venueRepo.findById(id)
            .orElseThrow(() -> EventZenException.notFound("Venue not found: " + id));
    }

    private void assertAdmin(AuthenticatedUser actor) {
        if (actor == null) {
            throw EventZenException.unauthorized("Authentication required.");
        }
        if (!"ADMIN".equals(actor.getRole())) {
            throw EventZenException.forbidden("Only admins can manage venues.");
        }
    }

    private void assertVendorOrAdmin(AuthenticatedUser actor) {
        if (actor == null) {
            throw EventZenException.unauthorized("Authentication required.");
        }
        if ("ADMIN".equals(actor.getRole()) || "VENDOR".equals(actor.getRole())) {
            return;
        }
        throw EventZenException.forbidden("Access denied. Requires VENDOR or ADMIN role.");
    }

    private void assertInternalSecret(String secret) {
        if (secret == null || !secret.equals(internalSecret)) {
            throw EventZenException.unauthorized("Invalid internal secret.");
        }
    }

    private int calculateBookingDays(java.time.LocalDateTime start, java.time.LocalDateTime end) {
        long minutes = Duration.between(start, end).toMinutes();
        if (minutes <= 0) {
            return 1;
        }
        return (int) Math.max(1, (minutes + (24 * 60 - 1)) / (24 * 60));
    }

    private String normalizeCurrencyOrDefault(String currency) {
        if (currency == null || currency.isBlank()) {
            return "INR";
        }
        return currency.trim().toUpperCase();
    }
}
