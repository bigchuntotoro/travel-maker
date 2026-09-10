package com.example.travel.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponseDto {

    private Long userId;     // 사용자 PK (MyBatis/JPA PK 필드명에 맞게 조정 가능)
    private String email;    // 이메일
    private String nickname; // 닉네임

    // Entity(User)를 DTO로 변환하는 생성자가 필요한 경우 (JPA 사용 시)
    /*
    public UserResponseDto(User entity) {
        this.userId = entity.getId();
        this.email = entity.getEmail();
        this.nickname = entity.getNickname();
    }
    */
}