package com.eventzen.service;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.eventzen.model.Event;
import com.eventzen.model.EventStatus;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class NotificationClientService {

    private final RestTemplate restTemplate;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final String nodeServiceBaseUrl;
    private final String internalSecret;
    private final boolean kafkaEnabled;
    private final String eventLifecycleTopic;

    public NotificationClientService(
        KafkaTemplate<String, String> kafkaTemplate,
        ObjectMapper objectMapper,
        @Value("${node.service.base-url:http://localhost:8081}") String nodeServiceBaseUrl,
        @Value("${internal.secret}") String internalSecret,
        @Value("${app.kafka.enabled:true}") boolean kafkaEnabled,
        @Value("${app.kafka.topics.event-lifecycle:eventzen.event.lifecycle}") String eventLifecycleTopic
    ) {
        this.restTemplate = new RestTemplate();
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.nodeServiceBaseUrl = nodeServiceBaseUrl;
        this.internalSecret = internalSecret;
        this.kafkaEnabled = kafkaEnabled;
        this.eventLifecycleTopic = eventLifecycleTopic;
    }

    public void notifyEventPendingApproval(Event event) {
        String url = nodeServiceBaseUrl + "/api/internal/notifications/events/" + event.getId() + "/pending-approval";
        Map<String, Object> payload = Map.of(
            "eventType", "EVENT_PENDING_APPROVAL",
            "eventId", event.getId(),
            "eventTitle", event.getTitle(),
            "vendorUserId", event.getVendorUserId()
        );

        dispatch(url, payload, "pending-approval", String.valueOf(event.getId()));
    }

    public void notifyEventStatusDecision(Event event, EventStatus status) {
        String url = nodeServiceBaseUrl + "/api/internal/notifications/events/" + event.getId() + "/status";
        Map<String, Object> payload = Map.of(
            "eventType", "EVENT_STATUS_DECISION",
            "eventId", event.getId(),
            "eventTitle", event.getTitle(),
            "vendorUserId", event.getVendorUserId(),
            "status", status != null ? status.name() : ""
        );

        dispatch(url, payload, "status-change", String.valueOf(event.getId()));
    }

    private void dispatch(String fallbackUrl, Map<String, Object> payload, String context, String key) {
        if (kafkaEnabled && publishToKafka(payload, context, key)) {
            return;
        }
        postInternal(fallbackUrl, payload, context);
    }

    private boolean publishToKafka(Map<String, Object> payload, String context, String key) {
        try {
            String body = objectMapper.writeValueAsString(payload);
            kafkaTemplate.send(eventLifecycleTopic, key, body);
            return true;
        } catch (JsonProcessingException ex) {
            log.warn("Kafka payload serialization failed [{}]: {}", context, ex.getMessage());
            return false;
        } catch (RuntimeException ex) {
            log.warn("Kafka dispatch failed [{}]: {}", context, ex.getMessage());
            return false;
        }
    }

    private void postInternal(String url, Map<String, Object> payload, String context) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Internal-Secret", internalSecret);
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

        try {
            restTemplate.exchange(url, HttpMethod.POST, request, Void.class);
        } catch (RestClientException ex) {
            log.warn("Internal notification dispatch failed [{}]: {}", context, ex.getMessage());
        }
    }
}
