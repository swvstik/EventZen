package com.eventzen.exception;

import org.springframework.http.HttpStatus;

public class EventZenException extends RuntimeException {
    private final HttpStatus status;

    public EventZenException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() { return status; }

    // -- Factory methods (mirrors Node.js AppError pattern) ------------------

    public static EventZenException notFound(String msg) {
        return new EventZenException(msg, HttpStatus.NOT_FOUND);
    }

    public static EventZenException forbidden(String msg) {
        return new EventZenException(msg, HttpStatus.FORBIDDEN);
    }

    public static EventZenException badRequest(String msg) {
        return new EventZenException(msg, HttpStatus.BAD_REQUEST);
    }

    public static EventZenException unauthorized(String msg) {
        return new EventZenException(msg, HttpStatus.UNAUTHORIZED);
    }
}
