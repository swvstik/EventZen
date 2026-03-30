package com.eventzen.controller;

import java.time.LocalDate;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import com.eventzen.dto.request.CreateEventRequest;
import com.eventzen.dto.request.StatusPatchRequest;
import com.eventzen.dto.request.UpdateEventRequest;
import com.eventzen.dto.response.ApiResponse;
import com.eventzen.dto.response.EventResponse;
import com.eventzen.dto.response.EventSummaryResponse;
import com.eventzen.dto.response.PagedResponse;
import com.eventzen.model.Event;
import com.eventzen.model.EventCategory;
import com.eventzen.model.EventStatus;
import com.eventzen.security.AuthenticatedUser;
import com.eventzen.service.EventService;

class EventControllerUnitTest {

    @Test
    void createEventReturns201WithWrappedPayload() {
        EventResponse created = buildResponse(11L, EventStatus.DRAFT);
        EventService service = new FakeEventService(created);

        EventController controller = new EventController(service);
        CreateEventRequest req = new CreateEventRequest();
        AuthenticatedUser actor = new AuthenticatedUser("vendor-1", "vendor@ez.local", "VENDOR");

        ResponseEntity<ApiResponse<EventResponse>> response = controller.createEvent(req, actor);

        assertEquals(201, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(true, response.getBody().isSuccess());
        assertEquals("Event created.", response.getBody().getMessage());
    }

    @Test
    void changeStatusReturns200AndDelegatesToService() {
        EventResponse updated = buildResponse(10L, EventStatus.PUBLISHED);
        EventService service = new FakeEventService(updated);

        EventController controller = new EventController(service);
        AuthenticatedUser actor = new AuthenticatedUser("admin-1", "admin@ez.local", "ADMIN");

        StatusPatchRequest req = new StatusPatchRequest();
        req.setStatus(EventStatus.PUBLISHED);

        ResponseEntity<ApiResponse<EventResponse>> response = controller.changeStatus(10L, req, actor);

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(true, response.getBody().isSuccess());
        assertEquals("Status updated.", response.getBody().getMessage());
    }

    private static EventResponse buildResponse(Long id, EventStatus status) {
        Event event = Event.builder()
            .id(id)
            .title("Demo")
            .description("Demo description")
            .eventDate(LocalDate.now().plusDays(1))
            .endDate(LocalDate.now().plusDays(1))
            .category(EventCategory.TECH)
            .status(status)
            .allowWaitlist(Boolean.TRUE)
            .vendorUserId("vendor-1")
            .ticketTiers(new ArrayList<>())
            .scheduleSlots(new ArrayList<>())
            .build();
        return new EventResponse(event);
    }

    private static final class FakeEventService extends EventService {
        private final EventResponse cannedResponse;

        FakeEventService(EventResponse cannedResponse) {
            super(null, null, null, null, null, null, null, null);
            this.cannedResponse = cannedResponse;
        }

        @Override
        public EventResponse createEvent(CreateEventRequest req, AuthenticatedUser actor) {
            return cannedResponse;
        }

        @Override
        public EventResponse changeStatus(Long id, EventStatus newStatus, AuthenticatedUser actor) {
            return cannedResponse;
        }

        @Override
        public PagedResponse<EventSummaryResponse> listEvents(String q, EventCategory category, EventStatus status, LocalDate date, int page, int limit, AuthenticatedUser actor) {
            throw new UnsupportedOperationException();
        }

        @Override
        public EventResponse getEvent(Long id, AuthenticatedUser actor) {
            throw new UnsupportedOperationException();
        }

        @Override
        public EventResponse updateEvent(Long id, UpdateEventRequest req, AuthenticatedUser actor) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deleteEvent(Long id, AuthenticatedUser actor) {
            throw new UnsupportedOperationException();
        }

        @Override
        public EventResponse submitForApproval(Long id, AuthenticatedUser actor) {
            throw new UnsupportedOperationException();
        }
    }
}
