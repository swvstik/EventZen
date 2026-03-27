package com.eventzen.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.eventzen.model.VenueBooking;

import lombok.Getter;

@Getter
public class VenueBookingAllocationResponse {
    private final Long venueBookingId;
    private final Long eventId;
    private final Long venueId;
    private final String vendorUserId;
    private final BigDecimal venueDailyRate;
    private final Integer bookingDays;
    private final BigDecimal totalVenueCost;
    private final String currency;
    private final LocalDateTime startTime;
    private final LocalDateTime endTime;
    private final LocalDateTime bookedAt;

    public VenueBookingAllocationResponse(VenueBooking booking) {
        this.venueBookingId = booking.getId();
        this.eventId = booking.getEvent().getId();
        this.venueId = booking.getVenue().getId();
        this.vendorUserId = booking.getEvent().getVendorUserId();
        this.venueDailyRate = booking.getVenueDailyRate();
        this.bookingDays = booking.getBookingDays();
        this.totalVenueCost = booking.getTotalVenueCost();
        this.currency = booking.getCostCurrency();
        this.startTime = booking.getStartTime();
        this.endTime = booking.getEndTime();
        this.bookedAt = booking.getCreatedAt();
    }
}
