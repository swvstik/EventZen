package com.eventzen.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.eventzen.dto.response.ApiResponse;
import com.eventzen.dto.response.VenueBookingAllocationResponse;
import com.eventzen.service.VenueService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/internal/venue-bookings")
@RequiredArgsConstructor
public class InternalVenueBookingController {

    private final VenueService venueService;

    @GetMapping("/events/{eventId}/latest-confirmed")
    public ResponseEntity<ApiResponse<VenueBookingAllocationResponse>> getLatestConfirmedForEvent(
            @PathVariable Long eventId,
            @RequestHeader("X-Internal-Secret") String secret) {

        return ResponseEntity.ok(ApiResponse.ok(venueService.getLatestConfirmedBookingAllocation(eventId, secret)));
    }
}
