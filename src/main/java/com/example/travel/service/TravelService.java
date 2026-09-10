package com.example.travel.service;

import com.example.travel.dto.CreatePlanRequest;
import com.example.travel.dto.PlanItemDto;
import com.example.travel.dto.PlanResponseDto;
import com.example.travel.mapper.TravelMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TravelService {

    private final TravelMapper travelMapper;

    /**
     * 여행 일정 저장 (트랜잭션 보장)
     */
    @Transactional
    public Long createTravelPlan(CreatePlanRequest request) {
        // 1. travel_plans 마스터 테이블에 저장
        travelMapper.insertPlan(request);

        // 2. 생성된 plan_id 받아오기
        Long generatedPlanId = request.getPlanId();

        // 3. 하위 경로 Item이 있는 경우 PK 세팅 후 배치 저장
        if (request.getItems() != null && !request.getItems().isEmpty()) {
            for (PlanItemDto item : request.getItems()) {
                item.setPlanId(generatedPlanId);
            }
            travelMapper.insertPlanItems(request.getItems());
        }

        return generatedPlanId;
    }

    /**
     * 유저별 전체 여행 일정 목록 조회 (🔥 PlanList.jsx 405 에러 해결 로직)
     */
    @Transactional(readOnly = true)
    public List<PlanResponseDto> getPlansByUserId(Long userId) {
        List<PlanResponseDto> plans = travelMapper.selectPlansByUserId(userId);

        // 필요 시 각 일정별 아이템(장소) 개수 세팅 또는 연관 아이템 함께 로드
        for (PlanResponseDto plan : plans) {
            List<PlanItemDto> items = travelMapper.selectPlanItemsByPlanId(plan.getPlanId());
            plan.setItems(items);
        }

        return plans;
    }

    /**
     * 여행 일정 상세 조회
     */
    @Transactional(readOnly = true)
    public PlanResponseDto getPlanDetail(Long planId) {
        PlanResponseDto plan = travelMapper.selectPlanById(planId);
        if (plan == null) {
            throw new IllegalArgumentException("해당 일정을 찾을 수 없습니다. ID: " + planId);
        }

        List<PlanItemDto> items = travelMapper.selectPlanItemsByPlanId(planId);
        plan.setItems(items);
        return plan;
    }

    /**
     * 여행 일정 수정 (🔥 PlanDetail.jsx 수정 로직)
     */
    @Transactional
    public void updatePlan(Long planId, CreatePlanRequest request) {
        // 1. 기존 플랜 존재 여부 확인
        PlanResponseDto existingPlan = travelMapper.selectPlanById(planId);
        if (existingPlan == null) {
            throw new IllegalArgumentException("수정하려는 일정이 존재하지 않습니다. ID: " + planId);
        }

        // 2. 마스터 테이블(plan) 기본 정보 업데이트
        travelMapper.updatePlan(planId, request);

        // 3. 기존 자식 경로(plan_item) 데이터 일괄 삭제
        travelMapper.deletePlanItemsByPlanId(planId);

        // 4. 새로 입력된 경로(plan_item) 데이터 재등록
        if (request.getItems() != null && !request.getItems().isEmpty()) {
            for (PlanItemDto item : request.getItems()) {
                item.setPlanId(planId);
            }
            travelMapper.insertPlanItems(request.getItems());
        }
    }

    /**
     * 여행 일정 삭제 (🔥 FK 제약 조건 안전 삭제)
     */
    @Transactional
    public void deletePlan(Long planId) {
        // 1. 자식 테이블(plan_item) 데이터 먼저 삭제 (ON DELETE CASCADE 설정이 안되어 있을 경우 대비)
        travelMapper.deletePlanItemsByPlanId(planId);

        // 2. 부모 테이블(plan) 데이터 삭제
        int deletedRows = travelMapper.deletePlan(planId);
        if (deletedRows == 0) {
            throw new IllegalArgumentException("삭제하려는 일정이 존재하지 않습니다. ID: " + planId);
        }
    }
}