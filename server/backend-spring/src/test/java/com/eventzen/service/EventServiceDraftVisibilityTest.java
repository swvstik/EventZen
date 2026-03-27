package com.eventzen.service;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import org.junit.jupiter.api.Test;

import com.eventzen.security.AuthenticatedUser;

class EventServiceDraftVisibilityTest {

    private final EventService eventService = new EventService(
        null,
        null,
        null,
        null,
        null,
        null,
        null
    );

    @Test
    void resolveDraftOwnerForVisibilityReturnsVendorIdForVendor() throws Exception {
        AuthenticatedUser vendor = new AuthenticatedUser("vendor-123", "vendor@example.com", "VENDOR");
        String ownerId = (String) invokeResolveDraftOwner(vendor);
        assertEquals("vendor-123", ownerId);
    }

    @Test
    void resolveDraftOwnerForVisibilityReturnsAdminIdForAdmin() throws Exception {
        AuthenticatedUser admin = new AuthenticatedUser("admin-11", "admin@example.com", "ADMIN");
        String ownerId = (String) invokeResolveDraftOwner(admin);
        assertEquals("admin-11", ownerId);
    }

    @Test
    void resolveDraftOwnerForVisibilityReturnsNullForCustomer() throws Exception {
        AuthenticatedUser customer = new AuthenticatedUser("user-1", "user@example.com", "CUSTOMER");
        String ownerId = (String) invokeResolveDraftOwner(customer);
        assertNull(ownerId);
    }

    private Object invokeResolveDraftOwner(AuthenticatedUser actor) throws Exception {
        Method method = EventService.class.getDeclaredMethod("resolveDraftOwnerForVisibility", AuthenticatedUser.class);
        method.setAccessible(true);
        return method.invoke(eventService, actor);
    }
}
