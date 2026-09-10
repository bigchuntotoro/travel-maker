package com.example.travel.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class CreatePlanRequest {
    private Long planId; // MyBatis가 useGeneratedKeys로 PK를 채워넣을 필드
    private Long userId;
    private String title;
    private LocalDate startDate;
    private LocalDate endDate;
    private List<PlanItemDto> items;
}