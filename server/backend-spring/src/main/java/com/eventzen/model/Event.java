package com.eventzen.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
    name = "events",
    indexes = {
        @Index(name = "idx_events_status", columnList = "status"),
        @Index(name = "idx_events_category", columnList = "category"),
        @Index(name = "idx_events_event_date", columnList = "event_date"),
        @Index(name = "idx_events_vendor", columnList = "organiser_user_id")
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "banner_image_url", length = 500)
    private String bannerImageUrl;

    @Column(name = "event_date", nullable = false)
    private LocalDate eventDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venue_id")
    private Venue venue;

    @Column(name = "own_venue_name", length = 200)
    private String ownVenueName;

    @Column(name = "own_venue_address", length = 500)
    private String ownVenueAddress;

    @Column(length = 50)
    @Enumerated(EnumType.STRING)
    private EventCategory category;

    /**
     * Stored as MySQL JSON column - e.g. ["outdoor","family-friendly"]
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "json")
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private EventStatus status = EventStatus.DRAFT;

    @Column(name = "allow_waitlist", nullable = false)
    @Builder.Default
    private Boolean allowWaitlist = Boolean.TRUE;

    /**
     * Cross-service reference to Node.js users._id.
     * Stored as string - no FK constraint.
     */
    @Column(name = "organiser_user_id", nullable = false, length = 50)
    private String vendorUserId;

    @Column(name = "avg_rating", precision = 3, scale = 2)
    @Builder.Default
    private BigDecimal avgRating = BigDecimal.ZERO;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<TicketTier> ticketTiers = new ArrayList<>();

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<EventScheduleSlot> scheduleSlots = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (endDate == null && eventDate != null) {
            endDate = eventDate;
        }
        createdAt = LocalDateTime.now();
    }
}
