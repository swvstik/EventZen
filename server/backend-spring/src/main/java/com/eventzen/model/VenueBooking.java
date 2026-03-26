package com.eventzen.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "venue_bookings",
    indexes = {
        @Index(name = "idx_booking_venue_id", columnList = "venue_id"),
        @Index(name = "idx_booking_event_id", columnList = "event_id")
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class VenueBooking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    /** Booking window start - used in conflict query */
    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    /** Booking window end - used in conflict query */
    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private BookingStatus status = BookingStatus.CONFIRMED;

    /** Node.js users._id from JWT - who made the booking */
    @Column(name = "booked_by_user_id", nullable = false, length = 50)
    private String bookedByUserId;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
