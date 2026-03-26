package com.eventzen.dto.request;

import java.time.LocalDate;
import java.time.LocalTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter @Setter @NoArgsConstructor
public class ScheduleSlotRequest {

    @NotBlank(message = "Session title is required")
    @Size(max = 200)
    private String sessionTitle;

    private LocalDate sessionDate;

    private LocalTime startTime;
    private LocalTime endTime;

    @Size(max = 100)
    private String speakerName;

    @Size(max = 200)
    private String locationNote;
}
