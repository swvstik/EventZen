package com.eventzen.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
public class HealthController {

    @Value("${app.kafka.enabled:true}")
    private boolean kafkaEnabled;

    @Value("${spring.kafka.bootstrap-servers:localhost:9094}")
    private String kafkaBootstrapServers;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
            "status",    "ok",
            "service",   "eventzen-spring",
            "kafka", Map.of(
                "enabled", kafkaEnabled,
                "bootstrapServers", kafkaBootstrapServers
            ),
            "timestamp", Instant.now().toString()
        ));
    }
}
