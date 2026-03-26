package com.eventzen.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.eventzen.model.Event;
import com.eventzen.model.EventStatus;

class NotificationClientServiceTest {

    @Test
    void notifyEventPendingApprovalFallbackDoesNotThrow() {
        NotificationClientService service = new NotificationClientService(
            null,
            new ObjectMapper(),
            "http://localhost:8081",
            "secret",
            false,
            "eventzen.event.lifecycle"
        );

        Event event = Event.builder()
            .id(101L)
            .title("Launch Night")
            .vendorUserId("vendor-11")
            .build();

        assertDoesNotThrow(() -> service.notifyEventPendingApproval(event));
    }

    @Test
    void notifyEventStatusDecisionFallbackDoesNotThrow() {
        NotificationClientService service = new NotificationClientService(
            null,
            new ObjectMapper(),
            "http://localhost:8081",
            "secret",
            false,
            "eventzen.event.lifecycle"
        );

        Event event = Event.builder()
            .id(202L)
            .title("Expo")
            .vendorUserId("vendor-22")
            .build();

        assertDoesNotThrow(() -> service.notifyEventStatusDecision(event, EventStatus.PUBLISHED));
    }
}
