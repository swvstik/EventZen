package com.eventzen.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.eventzen.model.BookingStatus;
import com.eventzen.model.VenueBooking;

@Repository
public interface VenueBookingRepository extends JpaRepository<VenueBooking, Long> {

    /**
     * Overlap detection query - the star feature.
     * Two bookings overlap when: startA < endB AND endA > startB.
     * Ignores CANCELLED bookings - a cancelled slot is available again.
     */
    @Query("""
        SELECT COUNT(b) FROM VenueBooking b
        WHERE b.venue.id  = :venueId
          AND b.status   != 'CANCELLED'
          AND b.startTime < :requestedEnd
          AND b.endTime   > :requestedStart
        """)
    long countConflicting(
        @Param("venueId")        Long venueId,
        @Param("requestedStart") LocalDateTime requestedStart,
        @Param("requestedEnd")   LocalDateTime requestedEnd
    );

    /** All CONFIRMED bookings for a venue - used by availability calendar. */
    List<VenueBooking> findByVenueIdAndStatus(Long venueId, BookingStatus status);

    /** All CONFIRMED bookings for a set of venues - used by bulk availability views. */
    List<VenueBooking> findByVenueIdInAndStatus(List<Long> venueIds, BookingStatus status);

    /** All bookings for a venue (any status) - admin history view. */
    List<VenueBooking> findByVenueIdOrderByStartTimeAsc(Long venueId);

    /** Vendor-scoped bookings for a venue (only vendor-owned events). */
    List<VenueBooking> findByVenueIdAndEventVendorUserIdOrderByStartTimeAsc(Long venueId, String vendorUserId);

    /** All confirmed bookings for an event, newest first. */
    List<VenueBooking> findByEventIdAndStatusOrderByCreatedAtDesc(Long eventId, BookingStatus status);

    /** Latest confirmed booking snapshot for an event - used for reconciliation. */
    VenueBooking findFirstByEventIdAndStatusOrderByCreatedAtDesc(Long eventId, BookingStatus status);

    /** Check if a booking already exists for a given venue + event + status. */
    long countByVenueIdAndEventIdAndStatus(Long venueId, Long eventId, BookingStatus status);
}
