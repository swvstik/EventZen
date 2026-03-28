package com.eventzen.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.eventzen.model.Event;
import com.eventzen.model.EventCategory;
import com.eventzen.model.EventStatus;
import com.eventzen.repository.EventRepository;
import com.eventzen.repository.VenueBookingRepository;
import com.eventzen.security.AuthenticatedUser;

class EventServiceStatusCascadeTest {

    @BeforeEach
    void setUp() {}

    @Test
    void changeStatusToCancelledCancelsRegistrations() {
        AtomicReference<Event> stored = new AtomicReference<>(Event.builder()
            .id(501L)
            .title("Admin Cancel Scenario")
            .category(EventCategory.TECH)
            .vendorUserId("vendor-501")
            .eventDate(LocalDate.now().plusDays(2))
            .status(EventStatus.PUBLISHED)
            .build());

        TrackingAttendeeClientService attendeeClientService = new TrackingAttendeeClientService();
        EventService eventService = new EventService(
            createEventRepositoryProxy(stored),
            null,
            createVenueBookingRepositoryProxy(),
            null,
            attendeeClientService,
            null,
            null,
            null
        );

        Event event = Event.builder()
            .id(501L)
            .title("Admin Cancel Scenario")
            .category(EventCategory.TECH)
            .vendorUserId("vendor-501")
            .eventDate(LocalDate.now().plusDays(2))
            .status(EventStatus.PUBLISHED)
            .build();

        stored.set(event);

        AuthenticatedUser admin = new AuthenticatedUser("admin-1", "admin@eventzen.io", "ADMIN");
        var response = eventService.changeStatus(501L, EventStatus.CANCELLED, admin);

        assertEquals(EventStatus.CANCELLED, response.getStatus());
        assertTrue(attendeeClientService.called);
        assertEquals(501L, attendeeClientService.cancelledEventId);
    }

    @Test
    void changeStatusToPublishedDoesNotCancelRegistrations() {
        AtomicReference<Event> stored = new AtomicReference<>(Event.builder()
            .id(502L)
            .title("Publish Scenario")
            .category(EventCategory.TECH)
            .vendorUserId("vendor-502")
            .eventDate(LocalDate.now().plusDays(3))
            .status(EventStatus.DRAFT)
            .build());

        TrackingAttendeeClientService attendeeClientService = new TrackingAttendeeClientService();
        EventService eventService = new EventService(
            createEventRepositoryProxy(stored),
            null,
            createVenueBookingRepositoryProxy(),
            null,
            attendeeClientService,
            null,
            null,
            null
        );

        Event event = Event.builder()
            .id(502L)
            .title("Publish Scenario")
            .category(EventCategory.TECH)
            .vendorUserId("vendor-502")
            .eventDate(LocalDate.now().plusDays(3))
            .status(EventStatus.DRAFT)
            .build();

        stored.set(event);

        AuthenticatedUser admin = new AuthenticatedUser("admin-1", "admin@eventzen.io", "ADMIN");
        var response = eventService.changeStatus(502L, EventStatus.PUBLISHED, admin);

        assertEquals(EventStatus.PUBLISHED, response.getStatus());
        assertFalse(attendeeClientService.called);
    }

    private EventRepository createEventRepositoryProxy(AtomicReference<Event> storage) {
        InvocationHandler handler = (Object proxy, Method method, Object[] args) -> {
            String name = method.getName();
            if ("findById".equals(name)) {
                Long id = (Long) args[0];
                Event current = storage.get();
                if (current != null && id.equals(current.getId())) {
                    return Optional.of(current);
                }
                return Optional.empty();
            }
            if ("save".equals(name)) {
                Event saved = (Event) args[0];
                storage.set(saved);
                return saved;
            }
            if ("toString".equals(name)) {
                return "EventRepositoryProxy";
            }
            if ("hashCode".equals(name)) {
                return System.identityHashCode(proxy);
            }
            if ("equals".equals(name)) {
                return proxy == args[0];
            }
            throw new UnsupportedOperationException("Method not supported in test proxy: " + name);
        };

        return (EventRepository) Proxy.newProxyInstance(
            EventRepository.class.getClassLoader(),
            new Class<?>[] { EventRepository.class },
            handler
        );
    }

    private VenueBookingRepository createVenueBookingRepositoryProxy() {
        InvocationHandler handler = (Object proxy, Method method, Object[] args) -> {
            String name = method.getName();
            if ("findByEventIdAndStatusOrderByCreatedAtDesc".equals(name)) {
                return List.of();
            }
            if ("toString".equals(name)) {
                return "VenueBookingRepositoryProxy";
            }
            if ("hashCode".equals(name)) {
                return System.identityHashCode(proxy);
            }
            if ("equals".equals(name)) {
                return proxy == args[0];
            }
            throw new UnsupportedOperationException("Method not supported in test proxy: " + name);
        };

        return (VenueBookingRepository) Proxy.newProxyInstance(
            VenueBookingRepository.class.getClassLoader(),
            new Class<?>[] { VenueBookingRepository.class },
            handler
        );
    }

    private static class TrackingAttendeeClientService extends AttendeeClientService {
        boolean called;
        Long cancelledEventId;

        TrackingAttendeeClientService() {
            super("http://localhost:8081", "internal-secret");
        }

        @Override
        public boolean cancelRegistrationsForEvent(Long eventId) {
            this.called = true;
            this.cancelledEventId = eventId;
            return true;
        }
    }
}
