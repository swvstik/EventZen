package com.eventzen.service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.eventzen.dto.request.ScheduleSlotRequest;
import com.eventzen.dto.response.ScheduleSlotResponse;
import com.eventzen.exception.EventZenException;
import com.eventzen.model.Event;
import com.eventzen.model.EventScheduleSlot;
import com.eventzen.repository.EventRepository;
import com.eventzen.repository.ScheduleSlotRepository;
import com.eventzen.security.AuthenticatedUser;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ScheduleService {

    private final ScheduleSlotRepository slotRepo;
    private final EventRepository        eventRepo;

    // -- List slots for an event ---------------------------------------------

    @Transactional(readOnly = true)
    public List<ScheduleSlotResponse> getSlots(Long eventId) {
        findEventOrThrow(eventId); // ensure event exists
        return slotRepo.findByEventIdOrderBySessionDateAscStartTimeAsc(eventId)
            .stream().map(ScheduleSlotResponse::new).toList();
    }

    // -- Add slot ------------------------------------------------------------

    @Transactional
    public ScheduleSlotResponse addSlot(Long eventId, ScheduleSlotRequest req, AuthenticatedUser actor) {
        Event event = findEventOrThrow(eventId);
        assertCanModify(event, actor);

        if (req.getSessionDate() == null) {
            throw EventZenException.badRequest("sessionDate is required for schedule slots.");
        }
        assertSlotDateWithinEventWindow(event, req.getSessionDate());

        if (req.getStartTime() == null || req.getEndTime() == null) {
            throw EventZenException.badRequest("startTime and endTime are required for schedule slots.");
        }

        assertValidSlotRange(req.getStartTime(), req.getEndTime());
        assertNoScheduleConflict(eventId, req.getSessionDate(), req.getStartTime(), req.getEndTime(), null);

        EventScheduleSlot slot = EventScheduleSlot.builder()
            .event(event)
            .sessionTitle(req.getSessionTitle())
            .sessionDate(req.getSessionDate())
            .startTime(req.getStartTime())
            .endTime(req.getEndTime())
            .speakerName(req.getSpeakerName())
            .locationNote(req.getLocationNote())
            .build();

        return new ScheduleSlotResponse(slotRepo.save(slot));
    }

    // -- Update slot ---------------------------------------------------------

    @Transactional
    public ScheduleSlotResponse updateSlot(Long slotId, ScheduleSlotRequest req, AuthenticatedUser actor) {
        EventScheduleSlot slot = findSlotOrThrow(slotId);
        assertCanModify(slot.getEvent(), actor);

        LocalDate nextDate = req.getSessionDate() != null ? req.getSessionDate() : slot.getSessionDate();
        LocalTime nextStart = req.getStartTime() != null ? req.getStartTime() : slot.getStartTime();
        LocalTime nextEnd   = req.getEndTime() != null ? req.getEndTime() : slot.getEndTime();

        if (nextDate == null) {
            throw EventZenException.badRequest("sessionDate is required for schedule slots.");
        }
        assertSlotDateWithinEventWindow(slot.getEvent(), nextDate);

        if (nextStart == null || nextEnd == null) {
            throw EventZenException.badRequest("Schedule slot must have both startTime and endTime.");
        }

        assertValidSlotRange(nextStart, nextEnd);
        assertNoScheduleConflict(slot.getEvent().getId(), nextDate, nextStart, nextEnd, slot.getId());

        if (req.getSessionTitle() != null) slot.setSessionTitle(req.getSessionTitle());
        if (req.getSessionDate()  != null) slot.setSessionDate(req.getSessionDate());
        if (req.getStartTime()    != null) slot.setStartTime(req.getStartTime());
        if (req.getEndTime()      != null) slot.setEndTime(req.getEndTime());
        if (req.getSpeakerName()  != null) slot.setSpeakerName(req.getSpeakerName());
        if (req.getLocationNote() != null) slot.setLocationNote(req.getLocationNote());

        return new ScheduleSlotResponse(slotRepo.save(slot));
    }

    // -- Delete slot ---------------------------------------------------------

    @Transactional
    public void deleteSlot(Long slotId, AuthenticatedUser actor) {
        EventScheduleSlot slot = findSlotOrThrow(slotId);
        assertCanModify(slot.getEvent(), actor);
        slotRepo.delete(slot);
    }

    // -- Helpers -------------------------------------------------------------

    private Event findEventOrThrow(Long eventId) {
        return eventRepo.findById(eventId)
            .orElseThrow(() -> EventZenException.notFound("Event not found: " + eventId));
    }

    private EventScheduleSlot findSlotOrThrow(Long slotId) {
        return slotRepo.findById(slotId)
            .orElseThrow(() -> EventZenException.notFound("Schedule slot not found: " + slotId));
    }

    private void assertCanModify(Event event, AuthenticatedUser actor) {
        String role = actor.getRole();
        if ("ADMIN".equals(role)) return;
        if ("VENDOR".equals(role) && event.getVendorUserId().equals(actor.getUserId())) return;
        throw EventZenException.forbidden("You do not have permission to modify this schedule.");
    }

    private void assertValidSlotRange(LocalTime start, LocalTime end) {
        if (!end.isAfter(start)) {
            throw EventZenException.badRequest("endTime must be after startTime.");
        }
    }

    private void assertNoScheduleConflict(Long eventId, LocalDate date, LocalTime start, LocalTime end, Long currentSlotId) {
        long conflicts = currentSlotId == null
            ? slotRepo.countConflicting(eventId, date, start, end)
            : slotRepo.countConflictingExcludingSlot(eventId, currentSlotId, date, start, end);

        if (conflicts > 0) {
            throw EventZenException.badRequest("Schedule slot conflicts with an existing slot for this event.");
        }
    }

    private void assertSlotDateWithinEventWindow(Event event, LocalDate slotDate) {
        LocalDate start = event.getEventDate();
        LocalDate end = event.getEndDate() != null ? event.getEndDate() : event.getEventDate();
        if (start == null || end == null) return;

        if (slotDate.isBefore(start) || slotDate.isAfter(end)) {
            throw EventZenException.badRequest("Schedule slot date must be within event date range.");
        }
    }
}
