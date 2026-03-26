package com.eventzen.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import com.eventzen.model.Event;
import com.eventzen.model.EventCategory;
import com.eventzen.model.EventStatus;

import lombok.Getter;

@Getter
public class EventResponse {
    private final Long id;
    private final String title;
    private final String description;
    private final String bannerImageUrl;
    private final LocalDate eventDate;
    private final LocalDate endDate;
    private final LocalTime startTime;
    private final LocalTime endTime;
    private final VenueResponse venue;
    private final String ownVenueName;
    private final String ownVenueAddress;
    private final EventCategory category;
    private final List<String> tags;
    private final EventStatus status;
    private final Boolean allowWaitlist;
    private final String vendorUserId;
    private final String organizerName;
    private final BigDecimal avgRating;
    private final LocalDateTime createdAt;
    private final List<TicketTierResponse> ticketTiers;
    private final List<ScheduleSlotResponse> scheduleSlots;
    private final int attendeeCount;

    public EventResponse(Event e) {
        this(e, 0, null);
    }

    public EventResponse(Event e, int attendeeCount) {
        this(e, attendeeCount, null);
    }

    public EventResponse(Event e, int attendeeCount, String organizerName) {
        this.id              = e.getId();
        this.title           = e.getTitle();
        this.description     = e.getDescription();
        this.bannerImageUrl  = e.getBannerImageUrl();
        this.eventDate       = e.getEventDate();
        this.endDate         = e.getEndDate();
        this.startTime       = e.getStartTime();
        this.endTime         = e.getEndTime();
        this.venue           = e.getVenue() != null ? new VenueResponse(e.getVenue()) : null;
        this.ownVenueName    = e.getOwnVenueName();
        this.ownVenueAddress = e.getOwnVenueAddress();
        this.category        = e.getCategory();
        this.tags            = e.getTags();
        this.status          = e.getStatus();
        this.allowWaitlist   = Boolean.TRUE.equals(e.getAllowWaitlist());
        this.vendorUserId    = e.getVendorUserId();
        this.organizerName   = organizerName;
        this.avgRating       = e.getAvgRating();
        this.createdAt       = e.getCreatedAt();
        this.ticketTiers     = e.getTicketTiers().stream().map(TicketTierResponse::new).toList();
        this.scheduleSlots   = e.getScheduleSlots().stream().map(ScheduleSlotResponse::new).toList();
        this.attendeeCount   = Math.max(attendeeCount, 0);
    }
}
