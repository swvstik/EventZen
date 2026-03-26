package com.eventzen.dto.response;

import lombok.Getter;

@Getter
public class EventOwnershipResponse {
    private final Long eventId;
    private final String vendorUserId;
    private final String title;
    private final String status;

    public EventOwnershipResponse(Long eventId, String vendorUserId, String title, String status) {
        this.eventId = eventId;
        this.vendorUserId = vendorUserId;
        this.title = title;
        this.status = status;
    }
}
