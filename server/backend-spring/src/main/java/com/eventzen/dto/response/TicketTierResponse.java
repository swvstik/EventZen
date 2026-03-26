package com.eventzen.dto.response;

import com.eventzen.model.TicketTier;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class TicketTierResponse {
    private final Long id;
    private final String name;
    private final BigDecimal price;
    private final String currency;
    private final Integer capacity;
    private final Integer maxPerOrder;
    private final String description;

    public TicketTierResponse(TicketTier t) {
        this.id          = t.getId();
        this.name        = t.getName();
        this.price       = t.getPrice();
        this.currency    = t.getCurrency();
        this.capacity    = t.getCapacity();
        this.maxPerOrder = t.getMaxPerOrder();
        this.description = t.getDescription();
    }
}
