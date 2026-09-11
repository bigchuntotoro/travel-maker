package com.example.travel.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlanItemDto {

    private Long itemId;

    private Long planId;

    /**
     * 여행 일차
     * 1 = Day 1
     * 2 = Day 2
     */
    private Integer dayNumber;

    /**
     * 장소명
     */
    private String placeName;

    /**
     * 위도
     */
    private BigDecimal latitude;

    /**
     * 경도
     */
    private BigDecimal longitude;

    /**
     * 방문 순서
     */
    private Integer visitOrder;

    /**
     * 장소 메모
     */
    private String memo;

    /**
     * 장소 체류시간 (분)
     *
     * 예)
     * 30  = 30분
     * 60  = 1시간
     * 90  = 1시간 30분
     * 120 = 2시간
     */
    private Integer stayMinutes;
}
