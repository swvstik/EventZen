package com.eventzen.dto.request;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

import com.eventzen.model.EventCategory;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

class CreateEventRequestValidationTest {

    private final Validator validator;

    CreateEventRequestValidationTest() {
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        this.validator = factory.getValidator();
    }

    @Test
    void validateFailsWhenRequiredFieldsAreMissing() {
        CreateEventRequest req = new CreateEventRequest();

        Set<ConstraintViolation<CreateEventRequest>> violations = validator.validate(req);
        Set<String> paths = violations.stream()
            .map(v -> v.getPropertyPath().toString())
            .collect(Collectors.toSet());

        assertTrue(paths.contains("title"));
        assertTrue(paths.contains("description"));
        assertTrue(paths.contains("eventDate"));
        assertTrue(paths.contains("category"));
        assertTrue(paths.contains("ticketTiers"));
    }

    @Test
    void validateSucceedsForMinimalValidPayload() {
        CreateEventRequest req = new CreateEventRequest();
        req.setTitle("Test Event");
        req.setDescription("This is a valid event description.");
        req.setEventDate(LocalDate.now().plusDays(3));
        req.setCategory(EventCategory.TECH);

        TicketTierRequest tier = new TicketTierRequest();
        tier.setName("General");
        tier.setPrice(java.math.BigDecimal.valueOf(1000));
        tier.setCapacity(100);
        tier.setMaxPerOrder(4);
        req.setTicketTiers(List.of(tier));

        Set<ConstraintViolation<CreateEventRequest>> violations = validator.validate(req);
        assertTrue(violations.isEmpty());
    }
}
