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
    private Integer dayNumber;
    private String placeName;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private Integer visitOrder;
    private String memo;
}