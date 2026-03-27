package com.eventzen.dto.request;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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

    @DecimalMin(value = "0.0", inclusive = false, message = "Daily rate must be greater than 0")
    @Digits(integer = 10, fraction = 2, message = "Daily rate must be a valid monetary amount")
    private BigDecimal dailyRate;

    @Pattern(regexp = "^[A-Z]{3}$", message = "Rate currency must be a 3-letter uppercase code")
    private String rateCurrency;
}
