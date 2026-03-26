package com.eventzen.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.eventzen.model.EventScheduleSlot;

@Repository
public interface ScheduleSlotRepository extends JpaRepository<EventScheduleSlot, Long> {

    List<EventScheduleSlot> findByEventIdOrderBySessionDateAscStartTimeAsc(Long eventId);

    @Query("""
        SELECT COUNT(s) FROM EventScheduleSlot s
        WHERE s.event.id = :eventId
                    AND s.sessionDate = :requestedDate
          AND s.startTime IS NOT NULL
          AND s.endTime IS NOT NULL
          AND s.startTime < :requestedEnd
          AND s.endTime > :requestedStart
        """)
    long countConflicting(
        @Param("eventId") Long eventId,
        @Param("requestedDate") java.time.LocalDate requestedDate,
        @Param("requestedStart") java.time.LocalTime requestedStart,
        @Param("requestedEnd") java.time.LocalTime requestedEnd
    );

    @Query("""
        SELECT COUNT(s) FROM EventScheduleSlot s
        WHERE s.event.id = :eventId
          AND s.id <> :slotId
                    AND s.sessionDate = :requestedDate
          AND s.startTime IS NOT NULL
          AND s.endTime IS NOT NULL
          AND s.startTime < :requestedEnd
          AND s.endTime > :requestedStart
        """)
    long countConflictingExcludingSlot(
        @Param("eventId") Long eventId,
        @Param("slotId") Long slotId,
        @Param("requestedDate") java.time.LocalDate requestedDate,
        @Param("requestedStart") java.time.LocalTime requestedStart,
        @Param("requestedEnd") java.time.LocalTime requestedEnd
    );
}
