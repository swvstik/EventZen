package com.eventzen.dto.response;

import com.eventzen.model.BookingStatus;
import com.eventzen.model.VenueBooking;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class VenueBookingResponse {
    private final Long id;
    private final Long venueId;
    private final String venueName;
    private final Long eventId;
    private final String eventTitle;
    private final LocalDateTime startTime;
    private final LocalDateTime endTime;
    private final BookingStatus status;
    private final String bookedByUserId;
    private final LocalDateTime createdAt;

    public VenueBookingResponse(VenueBooking b) {
        this.id            = b.getId();
        this.venueId       = b.getVenue().getId();
        this.venueName     = b.getVenue().getName();
        this.eventId       = b.getEvent().getId();
        this.eventTitle    = b.getEvent().getTitle();
        this.startTime     = b.getStartTime();
        this.endTime       = b.getEndTime();
        this.status        = b.getStatus();
        this.bookedByUserId = b.getBookedByUserId();
        this.createdAt     = b.getCreatedAt();
    }
}
