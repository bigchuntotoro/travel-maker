package com.example.travel.config;

import java.util.Arrays;
import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * 비밀번호 암호화
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * CORS 설정
     *
     * 로컬 개발:
     *   http://localhost:3000
     *
     * Tailscale:
     *   http://100.88.187.37:8097
     *
     * Tailscale Funnel:
     *   https://hpprobook4740s-1.tail479dbd.ts.net
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration configuration = new CorsConfiguration();

        configuration.setAllowedOrigins(Arrays.asList(
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://100.88.187.37:8097",
                "https://hpprobook4740s-1.tail479dbd.ts.net"
        ));

        configuration.setAllowedMethods(Arrays.asList(
                "GET",
                "POST",
                "PUT",
                "DELETE",
                "PATCH",
                "OPTIONS"
        ));

        configuration.setAllowedHeaders(List.of("*"));

        configuration.setAllowCredentials(true);

        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", configuration);

        return source;
    }

    /**
     * Spring Security
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
                // REST API이므로 CSRF 사용하지 않음
                .csrf(AbstractHttpConfigurer::disable)

                // 위에서 정의한 CORS 설정 사용
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // 기본 로그인 화면 사용하지 않음
                .formLogin(AbstractHttpConfigurer::disable)

                // HTTP Basic 인증 사용하지 않음
                .httpBasic(AbstractHttpConfigurer::disable)

                // REST API 및 프론트엔드 전체 허용
                .authorizeHttpRequests(auth -> auth

                        // CORS preflight
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // 로그인 / 회원가입 / 사용자 API
                        .requestMatchers("/api/**").permitAll()

                        // OAuth 관련
                        .requestMatchers("/oauth2/**").permitAll()
                        .requestMatchers("/login/**").permitAll()

                        // WebSocket
                        .requestMatchers("/ws/**").permitAll()

                        // 정적 리소스
                        .requestMatchers(
                                "/",
                                "/index.html",
                                "/favicon.ico",
                                "/assets/**",
                                "/static/**"
                        ).permitAll()

                        // 나머지도 현재 TravelMaker 구조에서는 허용
                        .anyRequest().permitAll()
                );

        return http.build();
    }
}