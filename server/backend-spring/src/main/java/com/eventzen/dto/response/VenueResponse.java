package com.eventzen.dto.response;

import java.math.BigDecimal;

import com.eventzen.model.Venue;

import lombok.Getter;

@Getter
public class VenueResponse {
    private final Long id;
    private final String name;
    private final String address;
    private final String city;
    private final Integer capacity;
    private final String facilities;
    private final String contactName;
    private final String contactEmail;
    private final String contactPhone;
    private final BigDecimal dailyRate;
    private final String rateCurrency;

    public VenueResponse(Venue v) {
        this.id           = v.getId();
        this.name         = v.getName();
        this.address      = v.getAddress();
        this.city         = v.getCity();
        this.capacity     = v.getCapacity();
        this.facilities   = v.getFacilities();
        this.contactName  = v.getContactName();
        this.contactEmail = v.getContactEmail();
        this.contactPhone = v.getContactPhone();
        this.dailyRate    = v.getDailyRate();
        this.rateCurrency = v.getRateCurrency();
    }
}
