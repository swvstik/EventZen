package com.eventzen.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import com.eventzen.model.Event;
import com.eventzen.model.EventCategory;
import com.eventzen.model.EventStatus;

import lombok.Getter;

/**
 * Lightweight projection used in the paginated GET /api/events list.
 * Omits schedule slots and full description to keep payload small.
 */
@Getter
public class EventSummaryResponse {
    private final Long id;
    private final String title;
    private final String description;
    private final String bannerImageUrl;
    private final LocalDate eventDate;
    private final LocalDate endDate;
    private final LocalTime startTime;
    private final LocalTime endTime;
    private final Long venueId;
    private final String venueName;
    private final String venueAddress;
    private final String ownVenueName;
    private final String ownVenueAddress;
    private final EventCategory category;
    private final List<String> tags;
    private final EventStatus status;
    private final Boolean allowWaitlist;
    private final String vendorUserId;
    private final BigDecimal avgRating;
    private final List<TicketTierResponse> ticketTiers;

    public EventSummaryResponse(Event e) {
        this.id              = e.getId();
        this.title           = e.getTitle();
        this.description     = e.getDescription();
        this.bannerImageUrl  = e.getBannerImageUrl();
        this.eventDate       = e.getEventDate();
        this.endDate         = e.getEndDate();
        this.startTime       = e.getStartTime();
        this.endTime         = e.getEndTime();
        this.venueId         = e.getVenue() != null ? e.getVenue().getId() : null;
        this.venueName       = e.getVenue() != null ? e.getVenue().getName() : null;
        this.venueAddress    = e.getVenue() != null ? e.getVenue().getAddress() : null;
        this.ownVenueName    = e.getOwnVenueName();
        this.ownVenueAddress = e.getOwnVenueAddress();
        this.category        = e.getCategory();
        this.tags            = e.getTags();
        this.status          = e.getStatus();
        this.allowWaitlist   = Boolean.TRUE.equals(e.getAllowWaitlist());
        this.vendorUserId    = e.getVendorUserId();
        this.avgRating       = e.getAvgRating();
        this.ticketTiers     = e.getTicketTiers().stream().map(TicketTierResponse::new).toList();
    }
}
