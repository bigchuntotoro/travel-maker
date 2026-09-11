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


    // =========================================================
    // 여행 일정 저장
    // =========================================================
    @Transactional
    public Long createTravelPlan(CreatePlanRequest request) {

        // -----------------------------------------------------
        // 1. 여행 플랜 마스터 저장
        // -----------------------------------------------------
        travelMapper.insertPlan(request);

        // -----------------------------------------------------
        // 2. 생성된 plan_id
        // -----------------------------------------------------
        Long generatedPlanId = request.getPlanId();

        // -----------------------------------------------------
        // 3. 여행 장소 저장
        // -----------------------------------------------------
        if (request.getItems() != null
                && !request.getItems().isEmpty()) {

            for (PlanItemDto item : request.getItems()) {

                // plan_id
                item.setPlanId(generatedPlanId);

                // 체류시간 기본값
                if (item.getStayMinutes() == null
                        || item.getStayMinutes() <= 0) {

                    item.setStayMinutes(60);
                }
            }

            travelMapper.insertPlanItems(
                    request.getItems()
            );
        }

        return generatedPlanId;
    }


    // =========================================================
    // 유저별 전체 여행 일정 조회
    // =========================================================
    @Transactional(readOnly = true)
    public List<PlanResponseDto> getPlansByUserId(
            Long userId
    ) {

        List<PlanResponseDto> plans =
                travelMapper.selectPlansByUserId(userId);

        for (PlanResponseDto plan : plans) {

            List<PlanItemDto> items =
                    travelMapper.selectPlanItemsByPlanId(
                            plan.getPlanId()
                    );

            plan.setItems(items);
        }

        return plans;
    }


    // =========================================================
    // 여행 일정 상세 조회
    // =========================================================
    @Transactional(readOnly = true)
    public PlanResponseDto getPlanDetail(
            Long planId
    ) {

        PlanResponseDto plan =
                travelMapper.selectPlanById(planId);

        if (plan == null) {

            throw new IllegalArgumentException(
                    "해당 일정을 찾을 수 없습니다. ID: "
                            + planId
            );
        }

        List<PlanItemDto> items =
                travelMapper.selectPlanItemsByPlanId(
                        planId
                );

        plan.setItems(items);

        return plan;
    }


    // =========================================================
    // 여행 일정 수정
    // =========================================================
    @Transactional
    public void updatePlan(
            Long planId,
            CreatePlanRequest request
    ) {

        // -----------------------------------------------------
        // 1. 기존 플랜 존재 여부 확인
        // -----------------------------------------------------
        PlanResponseDto existingPlan =
                travelMapper.selectPlanById(planId);

        if (existingPlan == null) {

            throw new IllegalArgumentException(
                    "수정하려는 일정이 존재하지 않습니다. ID: "
                            + planId
            );
        }


        // -----------------------------------------------------
        // 2. 여행 플랜 기본 정보 수정
        // -----------------------------------------------------
        travelMapper.updatePlan(
                planId,
                request
        );


        // -----------------------------------------------------
        // 3. 기존 장소 전체 삭제
        // -----------------------------------------------------
        travelMapper.deletePlanItemsByPlanId(
                planId
        );


        // -----------------------------------------------------
        // 4. 장소 재등록
        // -----------------------------------------------------
        if (request.getItems() != null
                && !request.getItems().isEmpty()) {

            for (PlanItemDto item : request.getItems()) {

                // plan_id 강제 지정
                item.setPlanId(planId);

                // stayMinutes 기본값
                if (item.getStayMinutes() == null
                        || item.getStayMinutes() <= 0) {

                    item.setStayMinutes(60);
                }
            }

            travelMapper.insertPlanItems(
                    request.getItems()
            );
        }
    }


    // =========================================================
    // 여행 일정 삭제
    // =========================================================
    @Transactional
    public void deletePlan(
            Long planId
    ) {

        // -----------------------------------------------------
        // 1. 자식 데이터 삭제
        // -----------------------------------------------------
        travelMapper.deletePlanItemsByPlanId(
                planId
        );


        // -----------------------------------------------------
        // 2. 부모 데이터 삭제
        // -----------------------------------------------------
        int deletedRows =
                travelMapper.deletePlan(planId);

        if (deletedRows == 0) {

            throw new IllegalArgumentException(
                    "삭제하려는 일정이 존재하지 않습니다. ID: "
                            + planId
            );
        }
    }
}
