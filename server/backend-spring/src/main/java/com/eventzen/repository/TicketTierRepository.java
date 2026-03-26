package com.eventzen.repository;

import com.eventzen.model.TicketTier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TicketTierRepository extends JpaRepository<TicketTier, Long> {
}
