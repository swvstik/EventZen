package com.eventzen.security;

import java.io.IOException;

import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain
    ) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        final String token = authHeader.substring(7);

        try {
            Claims claims = jwtUtil.validateAndExtract(token);

            String userId = claims.get("userId", String.class);
            String role   = claims.get("role",   String.class);

            // Node.js signs with jwt.sign({ userId, email, role }, secret)
            // so email is a plain claim - NOT the JWT subject (sub).
            // getSubject() returns null here; we must read "email" directly.
            String email = claims.get("email", String.class);

            log.info("[JWT] Parsed - userId={} email={} role={}", userId, email, role);

            if (userId != null && email != null && role != null
                    && SecurityContextHolder.getContext().getAuthentication() == null) {

                AuthenticatedUser principal = new AuthenticatedUser(userId, email, role);

                UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(auth);
                log.info("[JWT] Auth set - role={} authorities={}", role, principal.getAuthorities());

            } else {
                log.warn("[JWT] Null fields after parse - userId={} email={} role={}", userId, email, role);
            }

        } catch (JwtException ex) {
            log.warn("[JWT] Validation FAILED: {}", ex.getMessage());
        }

        chain.doFilter(request, response);
    }
}
