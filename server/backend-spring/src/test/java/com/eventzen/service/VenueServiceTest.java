package com.eventzen.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import com.eventzen.dto.request.BookVenueRequest;
import com.eventzen.dto.response.VenueBookingResponse;
import com.eventzen.exception.ConflictException;
import com.eventzen.model.Event;
import com.eventzen.model.Venue;
import com.eventzen.model.VenueBooking;
import com.eventzen.repository.EventRepository;
import com.eventzen.repository.VenueBookingRepository;
import com.eventzen.repository.VenueRepository;
import com.eventzen.security.AuthenticatedUser;

class VenueServiceTest {

    private VenueRepository venueRepo;
    private VenueBookingRepository bookingRepo;
    private EventRepository eventRepo;
    private VenueBookingEventPublisher venueBookingEventPublisher;
    private VenueService venueService;

    private void setupService() {
        venueRepo = mock(VenueRepository.class);
        bookingRepo = mock(VenueBookingRepository.class);
        eventRepo = mock(EventRepository.class);
        venueBookingEventPublisher = new VenueBookingEventPublisher(
            null,
            null,
            false,
            "eventzen.venue.bookings"
        );
        venueService = new VenueService(venueRepo, bookingRepo, eventRepo, venueBookingEventPublisher);
    }

    @Test
    void bookVenueThrowsConflictWhenOverlappingBookingExists() {
        setupService();

        Venue venue = Venue.builder()
            .id(10L)
            .name("Grand Hall")
            .dailyRate(new BigDecimal("1200.00"))
            .rateCurrency("INR")
            .build();

        Event event = Event.builder()
            .id(77L)
            .title("Tech Expo")
            .vendorUserId("vendor-1")
            .eventDate(LocalDate.now())
            .startTime(LocalTime.of(10, 0))
            .endTime(LocalTime.of(18, 0))
            .build();

        when(venueRepo.findById(10L)).thenReturn(Optional.of(venue));
        when(eventRepo.findById(77L)).thenReturn(Optional.of(event));
        when(bookingRepo.countConflicting(any(), any(), any())).thenReturn(1L);

        AuthenticatedUser actor = new AuthenticatedUser("vendor-1", "vendor@eventzen.com", "VENDOR");
        BookVenueRequest request = new BookVenueRequest();
        request.setEventId(77L);
        request.setStartTime(LocalDateTime.of(2026, 3, 10, 9, 0));
        request.setEndTime(LocalDateTime.of(2026, 3, 11, 9, 0));

        assertThrows(ConflictException.class, () -> {
            venueService.bookVenue(10L, request, actor);
        });
        Mockito.verify(bookingRepo, Mockito.never()).save(any());
    }

    @Test
    void bookVenueCalculatesBookingDaysAndTotalCost() {
        setupService();

        Venue venue = Venue.builder()
            .id(11L)
            .name("Riverfront Center")
            .dailyRate(new BigDecimal("999.99"))
            .rateCurrency("usd")
            .build();

        Event event = Event.builder()
            .id(88L)
            .title("Design Summit")
            .vendorUserId("vendor-2")
            .eventDate(LocalDate.now())
            .startTime(LocalTime.of(8, 0))
            .endTime(LocalTime.of(19, 0))
            .build();

        when(venueRepo.findById(11L)).thenReturn(Optional.of(venue));
        when(eventRepo.findById(88L)).thenReturn(Optional.of(event));
        when(bookingRepo.countConflicting(any(), any(), any())).thenReturn(0L);
        when(bookingRepo.save(any(VenueBooking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthenticatedUser actor = new AuthenticatedUser("vendor-2", "vendor2@eventzen.com", "VENDOR");
        BookVenueRequest request = new BookVenueRequest();
        request.setEventId(88L);
        request.setStartTime(LocalDateTime.of(2026, 4, 1, 10, 0));
        request.setEndTime(LocalDateTime.of(2026, 4, 3, 9, 59));

        VenueBookingResponse response = venueService.bookVenue(11L, request, actor);

        ArgumentCaptor<VenueBooking> bookingCaptor = ArgumentCaptor.forClass(VenueBooking.class);
        Mockito.verify(bookingRepo).save(bookingCaptor.capture());
        VenueBooking savedBooking = bookingCaptor.getValue();

        assertEquals(2, savedBooking.getBookingDays());
        assertEquals(new BigDecimal("1999.98"), savedBooking.getTotalVenueCost());
        assertEquals("USD", savedBooking.getCostCurrency());
        assertEquals(2, response.getBookingDays());
        assertEquals(new BigDecimal("1999.98"), response.getTotalVenueCost());
    }
}
