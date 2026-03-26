package com.eventzen.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Getter @Setter @NoArgsConstructor
public class VenueRequest {

    @NotBlank(message = "Venue name is required")
    @Size(max = 200)
    private String name;

    @Size(max = 500)
    private String address;

    @Size(max = 100)
    private String city;

    @Min(value = 1, message = "Capacity must be at least 1")
    private Integer capacity;

    private String facilities;

    @Size(max = 100)
    private String contactName;

    @Email(message = "Invalid contact email")
    @Size(max = 255)
    private String contactEmail;

    @Size(max = 20)
    private String contactPhone;
}
