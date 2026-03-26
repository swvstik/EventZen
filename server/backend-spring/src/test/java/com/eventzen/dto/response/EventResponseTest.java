package com.eventzen.dto.response;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.eventzen.model.Event;
import com.eventzen.model.EventCategory;
import com.eventzen.model.EventScheduleSlot;
import com.eventzen.model.EventStatus;
import com.eventzen.model.TicketTier;

class EventResponseTest {

    @Test
    void mapsScheduleSlotsAndAttendeeCount() {
        Event event = Event.builder()
            .id(42L)
            .title("Test Event")
            .eventDate(LocalDate.of(2026, 3, 20))
            .category(EventCategory.TECH)
            .status(EventStatus.PUBLISHED)
            .vendorUserId("vendor-1")
            .build();

        TicketTier tier = TicketTier.builder()
            .id(100L)
            .event(event)
            .name("General")
            .price(new BigDecimal("499.00"))
            .currency("INR")
            .capacity(100)
            .build();

        EventScheduleSlot slot = EventScheduleSlot.builder()
            .id(55L)
            .event(event)
            .sessionTitle("Opening")
            .startTime(LocalTime.of(10, 0))
            .endTime(LocalTime.of(10, 30))
            .build();

        event.setTicketTiers(List.of(tier));
        event.setScheduleSlots(List.of(slot));

        EventResponse response = new EventResponse(event, 27);

        assertEquals(1, response.getTicketTiers().size());
        assertEquals(1, response.getScheduleSlots().size());
        assertEquals("Opening", response.getScheduleSlots().get(0).getSessionTitle());
        assertEquals(27, response.getAttendeeCount());
    }
}
