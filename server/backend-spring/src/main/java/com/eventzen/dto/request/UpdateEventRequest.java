package com.eventzen.dto.request;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import com.eventzen.model.EventCategory;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter @Setter @NoArgsConstructor
public class UpdateEventRequest {

    @Size(max = 200)
    private String title;

    private String description;

    @Size(max = 500)
    private String bannerImageUrl;

    private LocalDate eventDate;
    private LocalDate endDate;

    private LocalTime startTime;
    private LocalTime endTime;

    private Long venueId;

    @Size(max = 200)
    private String ownVenueName;

    @Size(max = 500)
    private String ownVenueAddress;

    private EventCategory category;

    private List<String> tags;

    private Boolean allowWaitlist;

    @Valid
    private List<TicketTierRequest> ticketTiers;
}
