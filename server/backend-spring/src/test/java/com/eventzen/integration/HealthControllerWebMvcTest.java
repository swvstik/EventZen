package com.eventzen.integration;

import java.lang.reflect.Field;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import com.eventzen.controller.HealthController;

class HealthControllerWebMvcTest {

    @Test
    @SuppressWarnings("unchecked")
    void healthEndpointReturnsExpectedShape() throws Exception {
        HealthController controller = new HealthController();

        setField(controller, "kafkaEnabled", true);
        setField(controller, "kafkaBootstrapServers", "localhost:9094");

        ResponseEntity<Map<String, Object>> response = controller.health();

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals("ok", response.getBody().get("status"));
        assertEquals("eventzen-spring", response.getBody().get("service"));

        Map<String, Object> kafka = (Map<String, Object>) response.getBody().get("kafka");
        assertNotNull(kafka);
        assertEquals(true, kafka.get("enabled"));
        assertEquals("localhost:9094", kafka.get("bootstrapServers"));
        assertTrue(String.valueOf(response.getBody().get("timestamp")).length() > 5);
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
