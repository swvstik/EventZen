package com.eventzen.security;

import java.util.List;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;

import lombok.Getter;

/**
 * Thin wrapper around Spring's User that carries the Node.js userId and role.
 */
@Getter
public class AuthenticatedUser extends User {

    private final String userId;
    private final String role;

    public AuthenticatedUser(String userId, String email, String role) {
        super(email,
              "",   // password not stored here - auth is delegated to Node.js
              List.of(new SimpleGrantedAuthority("ROLE_" + role)));
        this.userId = userId;
        this.role   = role;
    }
}
