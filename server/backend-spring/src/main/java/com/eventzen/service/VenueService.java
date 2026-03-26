package com.eventzen.service;

import com.eventzen.dto.request.BookVenueRequest;
import com.eventzen.dto.request.VenueRequest;
import com.eventzen.dto.response.VenueBookingResponse;
import com.eventzen.dto.response.VenueResponse;
import com.eventzen.exception.ConflictException;
import com.eventzen.exception.EventZenException;
import com.eventzen.model.*;
import com.eventzen.repository.EventRepository;
import com.eventzen.repository.VenueBookingRepository;
import com.eventzen.repository.VenueRepository;
import com.eventzen.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class VenueService {

    private final VenueRepository        venueRepo;
    private final VenueBookingRepository bookingRepo;
    private final EventRepository        eventRepo;

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

        long conflicts = bookingRepo.countConflicting(venueId, req.getStartTime(), req.getEndTime());
        if (conflicts > 0) {
            throw new ConflictException(
                "Venue '" + venue.getName() + "' is already booked during that time window. " +
                "Choose a different time or venue.");
        }

        VenueBooking booking = VenueBooking.builder()
            .venue(venue)
            .event(event)
            .startTime(req.getStartTime())
            .endTime(req.getEndTime())
            .status(BookingStatus.CONFIRMED)
            .bookedByUserId(actor.getUserId())
            .build();

        return new VenueBookingResponse(bookingRepo.save(booking));
    }

    /** All CONFIRMED bookings for a venue - availability calendar. */
    @Transactional(readOnly = true)
    public List<VenueBookingResponse> getAvailability(Long venueId) {
        findVenueOrThrow(venueId);
        return bookingRepo.findByVenueIdAndStatus(venueId, BookingStatus.CONFIRMED)
            .stream().map(VenueBookingResponse::new).toList();
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
        return new VenueBookingResponse(bookingRepo.save(booking));
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
}
