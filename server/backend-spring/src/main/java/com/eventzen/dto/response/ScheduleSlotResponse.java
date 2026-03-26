package com.eventzen.dto.response;

import java.time.LocalDate;
import java.time.LocalTime;

import com.eventzen.model.EventScheduleSlot;

import lombok.Getter;

@Getter
public class ScheduleSlotResponse {
    private final Long id;
    private final Long eventId;
    private final String sessionTitle;
    private final LocalDate sessionDate;
    private final LocalTime startTime;
    private final LocalTime endTime;
    private final String speakerName;
    private final String locationNote;

    public ScheduleSlotResponse(EventScheduleSlot s) {
        this.id           = s.getId();
        this.eventId      = s.getEvent().getId();
        this.sessionTitle = s.getSessionTitle();
        this.sessionDate  = s.getSessionDate();
        this.startTime    = s.getStartTime();
        this.endTime      = s.getEndTime();
        this.speakerName  = s.getSpeakerName();
        this.locationNote = s.getLocationNote();
    }
}
