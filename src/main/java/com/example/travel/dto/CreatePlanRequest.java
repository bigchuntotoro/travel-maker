package com.example.travel.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

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

    // 💡 일자별 경로 우선순위. 예: {1: "RECOMMEND", 2: "FREE"}
    // key = dayNumber, value = "RECOMMEND"(유료 포함 추천) | "FREE"(무료 우선)
    private Map<Integer, String> dayRoutePriority;

    /**
     * MyBatis 바인딩 전용 getter.
     * travel_plans.day_route_priority(TEXT) 컬럼에는 JSON 문자열로 저장하므로
     * 여기서 Map -> JSON String 변환을 담당합니다. (MyBatis XML에서 #{dayRoutePriorityJson}로 사용)
     */
    public String getDayRoutePriorityJson() {
        try {
            return new ObjectMapper().writeValueAsString(
                    dayRoutePriority != null ? dayRoutePriority : Map.of()
            );
        } catch (Exception e) {
            return "{}";
        }
    }
}