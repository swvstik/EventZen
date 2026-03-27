package com.eventzen.service;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import com.eventzen.model.VenueBooking;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class VenueBookingEventPublisher {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final boolean kafkaEnabled;
    private final String venueBookingsTopic;

    public VenueBookingEventPublisher(
        KafkaTemplate<String, String> kafkaTemplate,
        ObjectMapper objectMapper,
        @Value("${app.kafka.enabled:true}") boolean kafkaEnabled,
        @Value("${app.kafka.topics.venue-bookings:eventzen.venue.bookings}") String venueBookingsTopic
    ) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.kafkaEnabled = kafkaEnabled;
        this.venueBookingsTopic = venueBookingsTopic;
    }

    public void publishBookingCreated(VenueBooking booking) {
        if (!kafkaEnabled || booking == null) {
            return;
        }

        Map<String, Object> payload = Map.ofEntries(
            Map.entry("eventType", "VENUE_BOOKING_CREATED"),
            Map.entry("venueBookingId", booking.getId()),
            Map.entry("venueId", booking.getVenue().getId()),
            Map.entry("eventId", booking.getEvent().getId()),
            Map.entry("vendorUserId", booking.getEvent().getVendorUserId() == null ? "" : booking.getEvent().getVendorUserId()),
            Map.entry("totalVenueCost", booking.getTotalVenueCost()),
            Map.entry("venueDailyRate", booking.getVenueDailyRate()),
            Map.entry("bookingDays", booking.getBookingDays()),
            Map.entry("currency", booking.getCostCurrency()),
            Map.entry("startTime", booking.getStartTime()),
            Map.entry("endTime", booking.getEndTime()),
            Map.entry("bookedAt", booking.getCreatedAt())
        );

        try {
            String body = objectMapper.writeValueAsString(payload);
            kafkaTemplate.send(venueBookingsTopic, String.valueOf(booking.getEvent().getId()), body);
        } catch (JsonProcessingException ex) {
            log.warn("Failed to serialize venue booking event: {}", ex.getMessage());
        } catch (RuntimeException ex) {
            log.warn("Failed to publish venue booking event: {}", ex.getMessage());
        }
    }

    public void publishBookingCancelled(VenueBooking booking) {
        if (!kafkaEnabled || booking == null) {
            return;
        }

        Map<String, Object> payload = Map.ofEntries(
            Map.entry("eventType", "VENUE_BOOKING_CANCELLED"),
            Map.entry("venueBookingId", booking.getId()),
            Map.entry("venueId", booking.getVenue().getId()),
            Map.entry("eventId", booking.getEvent().getId()),
            Map.entry("vendorUserId", booking.getEvent().getVendorUserId() == null ? "" : booking.getEvent().getVendorUserId()),
            Map.entry("cancelledAt", java.time.LocalDateTime.now())
        );

        try {
            String body = objectMapper.writeValueAsString(payload);
            kafkaTemplate.send(venueBookingsTopic, String.valueOf(booking.getEvent().getId()), body);
        } catch (JsonProcessingException ex) {
            log.warn("Failed to serialize venue booking cancellation event: {}", ex.getMessage());
        } catch (RuntimeException ex) {
            log.warn("Failed to publish venue booking cancellation event: {}", ex.getMessage());
        }
    }
}
