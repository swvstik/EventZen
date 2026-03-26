package com.eventzen.service;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class VendorProfileClientService {

    private final RestTemplate restTemplate;
    private final String nodeServiceBaseUrl;
    private final String internalSecret;

    public VendorProfileClientService(
        @Value("${node.service.base-url:http://localhost:8081}") String nodeServiceBaseUrl,
        @Value("${internal.secret}") String internalSecret
    ) {
        this.restTemplate = new RestTemplate();
        this.nodeServiceBaseUrl = nodeServiceBaseUrl;
        this.internalSecret = internalSecret;
    }

    public String resolveVendorDisplayName(String vendorUserId) {
        String normalized = vendorUserId != null ? vendorUserId.trim() : "";
        if (normalized.isEmpty()) {
            return null;
        }

        String url = nodeServiceBaseUrl + "/api/internal/vendors/" + normalized + "/profile";
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Internal-Secret", internalSecret);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            Map body = response.getBody();
            Object dataObj = body != null ? body.get("data") : null;
            if (!(dataObj instanceof Map<?, ?> data)) {
                return null;
            }

            Object displayName = data.get("displayName");
            if (displayName == null) {
                return null;
            }

            String resolved = String.valueOf(displayName).trim();
            return resolved.isEmpty() ? null : resolved;
        } catch (RestClientException ex) {
            log.warn("Vendor profile lookup failed for user {}: {}", normalized, ex.getMessage());
            return null;
        }
    }
}
