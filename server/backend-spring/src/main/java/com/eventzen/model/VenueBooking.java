package com.eventzen.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
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

    @Column(name = "venue_daily_rate", nullable = false, precision = 12, scale = 2)
    private BigDecimal venueDailyRate;

    @Column(name = "booking_days", nullable = false)
    private Integer bookingDays;

    @Column(name = "total_venue_cost", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalVenueCost;

    @Column(name = "cost_currency", nullable = false, length = 3)
    private String costCurrency;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
