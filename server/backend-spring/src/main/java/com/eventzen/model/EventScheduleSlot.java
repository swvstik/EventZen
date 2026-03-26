package com.eventzen.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(
    name = "event_schedule_slots",
    indexes = @Index(name = "idx_schedule_event_id", columnList = "event_id")
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EventScheduleSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @Column(name = "session_title", nullable = false, length = 200)
    private String sessionTitle;

    @Column(name = "session_date")
    private LocalDate sessionDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "speaker_name", length = 100)
    private String speakerName;

    @Column(name = "location_note", length = 200)
    private String locationNote;
}
