package com.example.travel.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // 1. CSRF 비활성화 (REST API용)
                .csrf(AbstractHttpConfigurer::disable)
                // 2. CORS 기본 설정 적용
                .cors(cors -> {})
                // 3. Form 로그인 기본 창 비활성화 (302 리다이렉트 방지)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                // 4. 모든 API 및 static 자원에 대해 접근 허용
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/**", "/**").permitAll()
                        .anyRequest().authenticated()
                );

        return http.build();
    }
}