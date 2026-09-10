package com.example.travel.mapper;

import com.example.travel.dto.CreatePlanRequest;
import com.example.travel.dto.PlanItemDto;
import com.example.travel.dto.PlanResponseDto;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TravelMapper {
    // 1. 여행 플랜 마스터 저장
    void insertPlan(CreatePlanRequest request);

    // 2. 일자별 상세 경로 일괄(Batch) 저장
    void insertPlanItems(@Param("items") List<PlanItemDto> items);

    // 3. 단일 여행 플랜 기본 정보 조회
    PlanResponseDto selectPlanById(@Param("planId") Long planId);

    // 4. 일자별 상세 경로 조회
    List<PlanItemDto> selectPlanItemsByPlanId(@Param("planId") Long planId);

    // 5. 🔥 [추가] 특정 유저의 전체 여행 플랜 목록 조회 (PlanList.jsx 용)
    List<PlanResponseDto> selectPlansByUserId(@Param("userId") Long userId);

    // 6. 🔥 [추가] 여행 플랜 기본 정보 수정 (PlanDetail.jsx 수정용)
    int updatePlan(@Param("planId") Long planId, @Param("request") CreatePlanRequest request);

    // 7. 🔥 [추가] 특정 플랜의 장소 목록(Items) 전체 삭제 (수정 시 재등록용)
    int deletePlanItemsByPlanId(@Param("planId") Long planId);

    // 8. 여행 플랜 마스터 삭제
    int deletePlan(@Param("planId") Long planId);
}