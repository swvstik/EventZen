package com.eventzen.repository;

import com.eventzen.model.VenueBooking;
import com.eventzen.model.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

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

    /** All bookings for a venue (any status) - admin history view. */
    List<VenueBooking> findByVenueIdOrderByStartTimeAsc(Long venueId);

    /** Vendor-scoped bookings for a venue (only vendor-owned events). */
    List<VenueBooking> findByVenueIdAndEventVendorUserIdOrderByStartTimeAsc(Long venueId, String vendorUserId);

    /** Check if a booking already exists for a given venue + event + status. */
    long countByVenueIdAndEventIdAndStatus(Long venueId, Long eventId, BookingStatus status);
}
