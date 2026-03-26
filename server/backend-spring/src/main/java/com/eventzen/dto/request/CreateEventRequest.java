package com.eventzen.dto.request;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

import com.eventzen.model.EventCategory;

import jakarta.validation.Valid;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter @Setter @NoArgsConstructor
public class CreateEventRequest {

    @NotBlank(message = "Title is required")
    @Size(max = 200, message = "Title must not exceed 200 characters")
    private String title;

    @NotBlank(message = "Description is required")
    @Size(min = 10, max = 5000, message = "Description must be between 10 and 5000 characters")
    private String description;

    @Size(max = 500)
    private String bannerImageUrl;

    @NotNull(message = "Event date is required")
    @FutureOrPresent(message = "Event date must be today or in the future")
    private LocalDate eventDate;

    @FutureOrPresent(message = "End date must be today or in the future")
    private LocalDate endDate;

    private LocalTime startTime;
    private LocalTime endTime;

    private Long venueId;

    @Size(max = 200, message = "Own venue name must not exceed 200 characters")
    private String ownVenueName;

    @Size(max = 500, message = "Own venue address must not exceed 500 characters")
    private String ownVenueAddress;

    @NotNull(message = "Category is required")
    private EventCategory category;

    private List<String> tags = new ArrayList<>();

    @Valid
    @NotEmpty(message = "At least one ticket tier is required")
    private List<TicketTierRequest> ticketTiers = new ArrayList<>();

    /**
     * Vendor-only drafting toggle.
     * true  -> keep as DRAFT
     * false -> submit as PENDING_APPROVAL
     */
    private Boolean saveAsDraft = Boolean.TRUE;

    /**
     * Event-level waitlist control.
     * true -> sold-out tiers can join waitlist
     * false -> sold-out tiers reject new registrations
     */
    private Boolean allowWaitlist = Boolean.TRUE;
}
