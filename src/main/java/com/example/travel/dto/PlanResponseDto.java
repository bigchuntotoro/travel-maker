package com.example.travel.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlanResponseDto {
    private Long planId;
    private Long userId;
    private String title;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd", timezone = "Asia/Seoul")
    private LocalDate startDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd", timezone = "Asia/Seoul")
    private LocalDate endDate;

    // 💡 MyBatis가 day_route_priority(TEXT/JSON) 컬럼을 담는 필드. 프론트로는 내려주지 않음.
    @JsonIgnore
    private String dayRoutePriorityJson;

    // 💡 프론트로 내려줄 일자별 경로 우선순위. 예: {1: "RECOMMEND", 2: "FREE"}
    // TravelService에서 dayRoutePriorityJson을 파싱해서 채워줍니다.
    private Map<Integer, String> dayRoutePriority;

    private List<PlanItemDto> items;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd HH:mm:ss", timezone = "Asia/Seoul")
    private LocalDateTime createdAt;
}