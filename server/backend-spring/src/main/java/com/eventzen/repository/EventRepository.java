package com.eventzen.repository;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.eventzen.model.Event;
import com.eventzen.model.EventCategory;
import com.eventzen.model.EventStatus;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {

    /**
     * Filtered paginated search - all params nullable (treated as "no filter").
     * Uses LIKE-based keyword filtering for compatibility across environments.
     */
    @Query(
        """
            SELECT e FROM Event e
            WHERE (
                :q IS NULL
                OR LOWER(e.title) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(COALESCE(e.description, '')) LIKE LOWER(CONCAT('%', :q, '%'))
            )
              AND (:category IS NULL OR e.category = :category)
              AND (:status   IS NULL OR e.status   = :status)
              AND (:date     IS NULL OR e.eventDate = :date)
              AND (
                    e.status <> com.eventzen.model.EventStatus.DRAFT
                    OR :includeAllDrafts = true
                    OR (:draftOwnerUserId IS NOT NULL AND e.vendorUserId = :draftOwnerUserId)
                  )
        """
    )
    Page<Event> findAllFiltered(
        @Param("q")        String q,
        @Param("category") EventCategory category,
        @Param("status")   EventStatus status,
        @Param("date")     LocalDate date,
        @Param("draftOwnerUserId") String draftOwnerUserId,
        @Param("includeAllDrafts") boolean includeAllDrafts,
        Pageable pageable
    );

    /**
     * Native MySQL full-text search. Falls back to LIKE query when unavailable.
     */
    @Query(
        value = """
            SELECT * FROM events e
            WHERE (:q IS NULL OR MATCH(e.title, e.description) AGAINST (:q IN BOOLEAN MODE))
              AND (:category IS NULL OR e.category = :category)
              AND (:status   IS NULL OR e.status   = :status)
              AND (:date     IS NULL OR e.event_date = :date)
                            AND (e.status <> 'DRAFT' OR :includeAllDrafts = true OR (:draftOwnerUserId IS NOT NULL AND e.vendor_user_id = :draftOwnerUserId))
            ORDER BY e.event_date ASC
        """,
        countQuery = """
            SELECT COUNT(*) FROM events e
            WHERE (:q IS NULL OR MATCH(e.title, e.description) AGAINST (:q IN BOOLEAN MODE))
              AND (:category IS NULL OR e.category = :category)
              AND (:status   IS NULL OR e.status   = :status)
              AND (:date     IS NULL OR e.event_date = :date)
                            AND (e.status <> 'DRAFT' OR :includeAllDrafts = true OR (:draftOwnerUserId IS NOT NULL AND e.vendor_user_id = :draftOwnerUserId))
        """,
        nativeQuery = true
    )
    Page<Event> findAllFilteredFullText(
        @Param("q")        String q,
        @Param("category") String category,
        @Param("status")   String status,
        @Param("date")     LocalDate date,
        @Param("draftOwnerUserId") String draftOwnerUserId,
        @Param("includeAllDrafts") boolean includeAllDrafts,
        Pageable pageable
    );

    /**
     * Patch avgRating without loading the full entity - single UPDATE statement.
     */
    @Modifying
    @Query("UPDATE Event e SET e.avgRating = :rating WHERE e.id = :id")
    int updateAvgRating(@Param("id") Long id, @Param("rating") BigDecimal rating);

    /**
     * Patch status without loading the full entity - single UPDATE statement.
     */
    @Modifying
    @Query("UPDATE Event e SET e.status = :status WHERE e.id = :id")
    int updateStatus(@Param("id") Long id, @Param("status") EventStatus status);
}
