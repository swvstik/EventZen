package com.eventzen.config;

import com.eventzen.security.JwtAuthFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.util.Map;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final ObjectMapper  objectMapper;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // -- Return JSON for 401/403 - not Spring's default HTML redirect --
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, e) -> {
                    response.setStatus(401);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write(
                        objectMapper.writeValueAsString(
                            Map.of("success", false, "message", "Authentication required. Please log in.")
                        )
                    );
                })
                .accessDeniedHandler((request, response, e) -> {
                    response.setStatus(403);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write(
                        objectMapper.writeValueAsString(
                            Map.of("success", false, "message", "Access denied. Insufficient permissions.")
                        )
                    );
                })
            )

            .authorizeHttpRequests(auth -> auth

                // -- Health ---------------------------------------------------
                .requestMatchers(HttpMethod.GET, "/health").permitAll()
                .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()

                // -- Events & Schedule (M1) - public reads -------------------
                .requestMatchers(HttpMethod.GET,   "/api/events").permitAll()
                .requestMatchers(HttpMethod.GET,   "/api/events/**").permitAll()
                .requestMatchers(HttpMethod.GET,   "/api/schedule/**").permitAll()

                // -- Internal service routes (secret-header guarded in service) --
                .requestMatchers("/api/internal/**").permitAll()

                // -- Venues (M2) - public reads -------------------------------
                .requestMatchers(HttpMethod.GET, "/api/venues").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/venues/*").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/venues/*/availability").permitAll()

                // -- All writes require authentication ------------------------
                // Fine-grained role + ownership checks are in the service layer
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
