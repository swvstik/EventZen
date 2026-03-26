package com.eventzen.dto.request;

import com.eventzen.model.AssignmentStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Getter @Setter @NoArgsConstructor
public class AssignmentStatusRequest {

    @NotNull(message = "status is required")
    private AssignmentStatus status;
}
