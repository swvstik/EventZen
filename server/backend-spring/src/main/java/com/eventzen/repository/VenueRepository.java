package com.eventzen.repository;

import com.eventzen.model.Venue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VenueRepository extends JpaRepository<Venue, Long> {

    @Query("""
        SELECT v FROM Venue v
        WHERE (:city     IS NULL OR LOWER(v.city)    LIKE LOWER(CONCAT('%', :city, '%')))
          AND (:capacity IS NULL OR v.capacity       >= :capacity)
        """)
    List<Venue> findAllFiltered(
        @Param("city")     String city,
        @Param("capacity") Integer capacity
    );
}
