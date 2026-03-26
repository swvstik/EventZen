package com.eventzen.controller;

import com.eventzen.dto.request.RatingPatchRequest;
import com.eventzen.dto.response.ApiResponse;
import com.eventzen.dto.response.EventOwnershipResponse;
import com.eventzen.service.EventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/internal/events")
@RequiredArgsConstructor
public class InternalEventController {

    private final EventService eventService;

    @PatchMapping("/{id}/rating")
    public ResponseEntity<ApiResponse<Void>> updateRating(
            @PathVariable Long id,
            @Valid @RequestBody RatingPatchRequest req,
            @RequestHeader("X-Internal-Secret") String secret) {

        eventService.updateRating(id, req.getAvgRating(), secret);
        return ResponseEntity.ok(ApiResponse.ok("Rating updated."));
    }

    @GetMapping("/{id}/ownership")
    public ResponseEntity<ApiResponse<EventOwnershipResponse>> getOwnership(
            @PathVariable Long id,
            @RequestHeader("X-Internal-Secret") String secret) {

        return ResponseEntity.ok(ApiResponse.ok(eventService.getOwnership(id, secret)));
    }
}
