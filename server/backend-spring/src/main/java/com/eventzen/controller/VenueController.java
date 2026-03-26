package com.eventzen.controller;

import com.eventzen.dto.request.BookVenueRequest;
import com.eventzen.dto.request.VenueRequest;
import com.eventzen.dto.response.ApiResponse;
import com.eventzen.dto.response.VenueBookingResponse;
import com.eventzen.dto.response.VenueResponse;
import com.eventzen.security.AuthenticatedUser;
import com.eventzen.service.VenueService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/venues")
@RequiredArgsConstructor
public class VenueController {

    private final VenueService venueService;

    /**
     * GET /api/venues
     * Public. Query: ?city=&capacity=
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<VenueResponse>>> listVenues(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) Integer capacity) {
        return ResponseEntity.ok(ApiResponse.ok(venueService.listVenues(city, capacity)));
    }

    /**
     * GET /api/venues/:id
     * Public.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<VenueResponse>> getVenue(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(venueService.getVenue(id)));
    }

    /**
     * GET /api/venues/:id/availability
     * Public. All CONFIRMED bookings - used by admin portal booking calendar.
     */
    @GetMapping("/{id}/availability")
    public ResponseEntity<ApiResponse<List<VenueBookingResponse>>> getAvailability(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(venueService.getAvailability(id)));
    }

    /**
     * POST /api/venues
     * JWT + ADMIN only.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<VenueResponse>> createVenue(
            @Valid @RequestBody VenueRequest req,
            @AuthenticationPrincipal AuthenticatedUser actor) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.ok("Venue created.", venueService.createVenue(req, actor)));
    }

    /**
     * PUT /api/venues/:id
     * JWT + ADMIN only.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<VenueResponse>> updateVenue(
            @PathVariable Long id,
            @Valid @RequestBody VenueRequest req,
            @AuthenticationPrincipal AuthenticatedUser actor) {
        return ResponseEntity.ok(ApiResponse.ok("Venue updated.", venueService.updateVenue(id, req, actor)));
    }

    /**
     * DELETE /api/venues/:id
     * JWT + ADMIN only.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteVenue(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedUser actor) {
        venueService.deleteVenue(id, actor);
        return ResponseEntity.ok(ApiResponse.ok("Venue deleted."));
    }

    /**
     * POST /api/venues/:id/bookings
        * JWT + VENDOR/ADMIN. Vendors can book only their own events. 409 on overlap.
     */
    @PostMapping("/{id}/bookings")
    public ResponseEntity<ApiResponse<VenueBookingResponse>> bookVenue(
            @PathVariable Long id,
            @Valid @RequestBody BookVenueRequest req,
            @AuthenticationPrincipal AuthenticatedUser actor) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.ok("Venue booked.", venueService.bookVenue(id, req, actor)));
    }

    /**
     * GET /api/venues/:id/bookings
     * JWT + VENDOR/ADMIN. Admin sees all; vendor sees own-event bookings only.
     */
    @GetMapping("/{id}/bookings")
    public ResponseEntity<ApiResponse<List<VenueBookingResponse>>> getAllBookings(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedUser actor) {
        return ResponseEntity.ok(ApiResponse.ok(venueService.getAllBookings(id, actor)));
    }

    /**
     * DELETE /api/venues/bookings/:id
     * JWT + VENDOR/ADMIN. Vendors can cancel only own-event bookings.
     */
    @DeleteMapping("/bookings/{id}")
    public ResponseEntity<ApiResponse<VenueBookingResponse>> cancelBooking(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedUser actor) {
        return ResponseEntity.ok(ApiResponse.ok("Booking cancelled.", venueService.cancelBooking(id, actor)));
    }
}
