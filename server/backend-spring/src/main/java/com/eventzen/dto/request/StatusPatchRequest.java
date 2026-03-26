package com.eventzen.dto.request;

import com.eventzen.model.EventStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Getter @Setter @NoArgsConstructor
public class StatusPatchRequest {

    @NotNull(message = "Status is required")
    private EventStatus status;
}
