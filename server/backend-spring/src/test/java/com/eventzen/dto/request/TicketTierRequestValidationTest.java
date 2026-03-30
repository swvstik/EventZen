package com.eventzen.dto.request;

import java.math.BigDecimal;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

class TicketTierRequestValidationTest {

    private final Validator validator;

    TicketTierRequestValidationTest() {
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        this.validator = factory.getValidator();
    }

    @Test
    void validateFailsForMissingAndInvalidFields() {
        TicketTierRequest req = new TicketTierRequest();
        req.setPrice(BigDecimal.valueOf(-1));
        req.setCapacity(0);
        req.setMaxPerOrder(0);

        Set<ConstraintViolation<TicketTierRequest>> violations = validator.validate(req);
        Set<String> paths = violations.stream()
            .map(v -> v.getPropertyPath().toString())
            .collect(Collectors.toSet());

        assertTrue(paths.contains("name"));
        assertTrue(paths.contains("price"));
        assertTrue(paths.contains("capacity"));
        assertTrue(paths.contains("maxPerOrder"));
    }

    @Test
    void validateSucceedsForValidTier() {
        TicketTierRequest req = new TicketTierRequest();
        req.setName("VIP");
        req.setPrice(BigDecimal.valueOf(4999));
        req.setCapacity(50);
        req.setMaxPerOrder(2);

        Set<ConstraintViolation<TicketTierRequest>> violations = validator.validate(req);
        assertTrue(violations.isEmpty());
    }
}
