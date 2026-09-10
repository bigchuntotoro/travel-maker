package com.example.travel.dto;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
public class UserDto {
    private Long userId;
    private String email;
    private String password;
    private String nickname;
    private LocalDateTime createdAt;
}