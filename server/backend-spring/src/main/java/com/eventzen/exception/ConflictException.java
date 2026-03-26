package com.eventzen.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when a venue booking overlaps an existing confirmed booking.
 * Maps to HTTP 409 Conflict.
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }

    public HttpStatus getStatus() {
        return HttpStatus.CONFLICT;
    }
}
