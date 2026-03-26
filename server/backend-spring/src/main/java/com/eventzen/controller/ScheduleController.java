package com.eventzen.controller;

import com.eventzen.dto.request.ScheduleSlotRequest;
import com.eventzen.dto.response.ApiResponse;
import com.eventzen.dto.response.ScheduleSlotResponse;
import com.eventzen.security.AuthenticatedUser;
import com.eventzen.service.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/schedule")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    /**
     * GET /api/schedule/:eventId
     * Public. Returns all agenda slots ordered by startTime.
     */
    @GetMapping("/{eventId}")
    public ResponseEntity<ApiResponse<List<ScheduleSlotResponse>>> getSlots(
            @PathVariable Long eventId) {

        return ResponseEntity.ok(ApiResponse.ok(scheduleService.getSlots(eventId)));
    }

    /**
     * POST /api/schedule/:eventId
        * JWT + VENDOR (own event) or ADMIN. Adds an agenda slot.
     */
    @PostMapping("/{eventId}")
    public ResponseEntity<ApiResponse<ScheduleSlotResponse>> addSlot(
            @PathVariable Long eventId,
            @Valid @RequestBody ScheduleSlotRequest req,
            @AuthenticationPrincipal AuthenticatedUser actor) {

        ScheduleSlotResponse slot = scheduleService.addSlot(eventId, req, actor);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Slot added.", slot));
    }

    /**
     * PUT /api/schedule/slot/:slotId
        * JWT + VENDOR (own event) or ADMIN. Updates a slot.
     */
    @PutMapping("/slot/{slotId}")
    public ResponseEntity<ApiResponse<ScheduleSlotResponse>> updateSlot(
            @PathVariable Long slotId,
            @Valid @RequestBody ScheduleSlotRequest req,
            @AuthenticationPrincipal AuthenticatedUser actor) {

        return ResponseEntity.ok(
            ApiResponse.ok("Slot updated.", scheduleService.updateSlot(slotId, req, actor))
        );
    }

    /**
     * DELETE /api/schedule/slot/:slotId
        * JWT + VENDOR (own event) or ADMIN. Removes a slot.
     */
    @DeleteMapping("/slot/{slotId}")
    public ResponseEntity<ApiResponse<Void>> deleteSlot(
            @PathVariable Long slotId,
            @AuthenticationPrincipal AuthenticatedUser actor) {

        scheduleService.deleteSlot(slotId, actor);
        return ResponseEntity.ok(ApiResponse.ok("Slot removed."));
    }
}
