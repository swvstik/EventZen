package com.eventzen.controller;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.eventzen.dto.request.CreateEventRequest;
import com.eventzen.dto.request.StatusPatchRequest;
import com.eventzen.dto.request.UpdateEventRequest;
import com.eventzen.dto.response.ApiResponse;
import com.eventzen.dto.response.EventResponse;
import com.eventzen.dto.response.EventSummaryResponse;
import com.eventzen.dto.response.PagedResponse;
import com.eventzen.model.EventCategory;
import com.eventzen.model.EventStatus;
import com.eventzen.security.AuthenticatedUser;
import com.eventzen.service.EventService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    /**
     * GET /api/events
     * Public. Query: ?q=&category=&status=&date=&page=0&limit=12
     * Returns { events, totalCount, totalPages, currentPage }
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<EventSummaryResponse>>> listEvents(
            @RequestParam(required = false)                                        String q,
            @RequestParam(required = false)                                        EventCategory category,
            @RequestParam(required = false)                                        EventStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "0")                                      int page,
            @RequestParam(defaultValue = "12")                                     int limit,
            @AuthenticationPrincipal AuthenticatedUser actor) {

        return ResponseEntity.ok(
            ApiResponse.ok(eventService.listEvents(q, category, status, date, page, limit, actor))
        );
    }

    /**
     * GET /api/events/:id
     * Public. Returns full event with ticketTiers, scheduleSlots, venue info.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EventResponse>> getEvent(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedUser actor) {

        return ResponseEntity.ok(ApiResponse.ok(eventService.getEvent(id, actor)));
    }

    /**
     * POST /api/events
        * JWT + VENDOR or ADMIN. Vendor -> status=DRAFT.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<EventResponse>> createEvent(
            @Valid @RequestBody CreateEventRequest req,
            @AuthenticationPrincipal AuthenticatedUser actor) {

        EventResponse created = eventService.createEvent(req, actor);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Event created.", created));
    }

    /**
     * PUT /api/events/:id
        * JWT + VENDOR (own) or ADMIN. Replaces mutable fields.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<EventResponse>> updateEvent(
            @PathVariable Long id,
            @Valid @RequestBody UpdateEventRequest req,
            @AuthenticationPrincipal AuthenticatedUser actor) {

        return ResponseEntity.ok(ApiResponse.ok("Event updated.", eventService.updateEvent(id, req, actor)));
    }

    /**
     * DELETE /api/events/:id
        * JWT + VENDOR (own) or ADMIN. Soft delete -> CANCELLED.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteEvent(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedUser actor) {

        eventService.deleteEvent(id, actor);
        return ResponseEntity.ok(ApiResponse.ok("Event cancelled."));
    }

    /**
     * POST /api/events/:id/submit
        * JWT + VENDOR only. Moves DRAFT -> PENDING_APPROVAL.
     */
    @PostMapping("/{id}/submit")
    public ResponseEntity<ApiResponse<EventResponse>> submitForApproval(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedUser actor) {

        return ResponseEntity.ok(
            ApiResponse.ok("Event submitted for approval.", eventService.submitForApproval(id, actor))
        );
    }

    /**
     * PATCH /api/events/:id/status
     * JWT + ADMIN only. Change to any status. Only ADMIN can set PUBLISHED.
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<EventResponse>> changeStatus(
            @PathVariable Long id,
            @Valid @RequestBody StatusPatchRequest req,
            @AuthenticationPrincipal AuthenticatedUser actor) {

        return ResponseEntity.ok(
            ApiResponse.ok("Status updated.", eventService.changeStatus(id, req.getStatus(), actor))
        );
    }

}
