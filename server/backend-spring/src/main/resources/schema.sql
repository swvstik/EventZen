-- ============================================================
-- EventZen — Spring Boot Service — Full MySQL Schema (M1+M2+M3)
-- Database: eventzen
-- Hibernate ddl-auto=update handles table creation automatically.
-- Run this script only if you need manual bootstrap or a fresh DB.
-- ============================================================

CREATE DATABASE IF NOT EXISTS eventzen CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE eventzen;

-- ── venues ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
    id            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(200) NOT NULL,
    address       VARCHAR(500),
    city          VARCHAR(100),
    capacity      INT,
    facilities    TEXT,
    contact_name  VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    INDEX idx_venues_city (city)
);

-- ── events ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    id                BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title             VARCHAR(200) NOT NULL,
    description       TEXT,
    banner_image_url  VARCHAR(500),
    event_date        DATE         NOT NULL,
    end_date          DATE,
    start_time        TIME,
    end_time          TIME,
    venue_id          BIGINT,
    own_venue_name    VARCHAR(200),
    own_venue_address VARCHAR(500),
    category          VARCHAR(50),
    tags              JSON,
    status            ENUM('DRAFT','PENDING_APPROVAL','PUBLISHED','ONGOING','COMPLETED','CANCELLED')
                                   NOT NULL DEFAULT 'DRAFT',
    allow_waitlist    TINYINT(1)   NOT NULL DEFAULT 1,
    organiser_user_id VARCHAR(50)  NOT NULL,
    avg_rating        DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_events_venue FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL,

    INDEX  idx_events_status     (status),
    INDEX  idx_events_category   (category),
    INDEX  idx_events_event_date (event_date),
    INDEX  idx_events_organiser  (organiser_user_id),
    FULLTEXT INDEX ft_events_search (title, description)
);

-- ── ticket_tiers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_tiers (
    id          BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_id    BIGINT        NOT NULL,
    name        VARCHAR(100)  NOT NULL,
    price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency    VARCHAR(3)    NOT NULL DEFAULT 'INR',
    capacity    INT           NOT NULL,
    description VARCHAR(500),
    CONSTRAINT fk_tiers_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- ── event_schedule_slots ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_schedule_slots (
    id             BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_id       BIGINT       NOT NULL,
    session_title  VARCHAR(200) NOT NULL,
    session_date   DATE,
    start_time     TIME,
    end_time       TIME,
    speaker_name   VARCHAR(100),
    location_note  VARCHAR(200),
    CONSTRAINT fk_slots_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    INDEX idx_schedule_event_id (event_id)
);

-- ── venue_bookings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venue_bookings (
    id                 BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    venue_id           BIGINT      NOT NULL,
    event_id           BIGINT      NOT NULL,
    start_time         DATETIME    NOT NULL,
    end_time           DATETIME    NOT NULL,
    status             ENUM('CONFIRMED','CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
    booked_by_user_id  VARCHAR(50) NOT NULL,
    created_at         TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_booking_venue FOREIGN KEY (venue_id) REFERENCES venues(id),
    CONSTRAINT fk_booking_event FOREIGN KEY (event_id) REFERENCES events(id),
    INDEX idx_booking_venue_id (venue_id),
    INDEX idx_booking_event_id (event_id)
);

-- ── vendors ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
    id             BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    company_name   VARCHAR(200) NOT NULL,
    service_type   VARCHAR(50),
    contact_person VARCHAR(100),
    email          VARCHAR(255),
    phone          VARCHAR(20),
    notes          TEXT
);

-- ── event_vendors ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_vendors (
    id          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_id    BIGINT       NOT NULL,
    vendor_id   BIGINT       NOT NULL,
    role_notes  VARCHAR(500),
    status      ENUM('PENDING','CONFIRMED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    assigned_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ev_event  FOREIGN KEY (event_id)  REFERENCES events(id),
    CONSTRAINT fk_ev_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    INDEX idx_ev_event_id  (event_id),
    INDEX idx_ev_vendor_id (vendor_id)
);
