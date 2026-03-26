package com.eventzen.service;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class AttendeeClientService {

    private final RestTemplate restTemplate;
    private final String nodeServiceBaseUrl;
    private final String internalSecret;

    public AttendeeClientService(
        @Value("${node.service.base-url:http://localhost:8081}") String nodeServiceBaseUrl,
        @Value("${internal.secret}") String internalSecret
    ) {
        this.nodeServiceBaseUrl = nodeServiceBaseUrl;
        this.internalSecret = internalSecret;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);

        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * Reads attendee counts per tier from Node and returns the total registered count.
     * If Node is temporarily unavailable, this safely degrades to 0 instead of failing
     * the entire event detail request.
     */
    public int getRegisteredCount(Long eventId) {
        String url = nodeServiceBaseUrl + "/api/attendees/event/" + eventId + "/count";

        try {
            ResponseEntity<NodeEnvelope<List<TierCount>>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<NodeEnvelope<List<TierCount>>>() {}
            );

            List<TierCount> counts = Optional.ofNullable(response.getBody())
                .map(NodeEnvelope::getData)
                .orElse(List.of());

            return counts.stream()
                .mapToInt(item -> {
                    Integer value = item.getCount();
                    return value != null ? value : 0;
                })
                .sum();
        } catch (RestClientException ex) {
            log.warn("Attendee count lookup failed for event {} from {}: {}", eventId, nodeServiceBaseUrl, ex.getMessage());
            return 0;
        }
    }

    public boolean cancelRegistrationsForEvent(Long eventId) {
        String url = nodeServiceBaseUrl + "/api/internal/events/" + eventId + "/cancel-registrations";

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Internal-Secret", internalSecret);
        HttpEntity<Void> request = new HttpEntity<>(headers);

        for (int attempt = 1; attempt <= 2; attempt++) {
            try {
                restTemplate.exchange(url, HttpMethod.POST, request, Void.class);
                return true;
            } catch (RestClientException ex) {
                if (attempt == 2) {
                    log.error("Event cancellation sync failed for event {} after retries: {}", eventId, ex.getMessage());
                    return false;
                }
                sleepBackoff(attempt);
            }
        }

        return false;
    }

    private void sleepBackoff(int attempt) {
        try {
            TimeUnit.MILLISECONDS.sleep(250L * attempt);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    @Getter
    @Setter
    private static class NodeEnvelope<T> {
        private boolean success;
        private T data;
    }

    @Getter
    @Setter
    private static class TierCount {
        private String tierId;
        private Integer count;
    }
}
