package com.eventzen.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter @Setter @NoArgsConstructor
public class RatingPatchRequest {

    @NotNull(message = "Rating is required")
    @DecimalMin(value = "0.0") @DecimalMax(value = "5.0")
    @Digits(integer = 1, fraction = 2)
    private BigDecimal avgRating;
}
