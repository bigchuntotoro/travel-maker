package com.example.travel.controller;

import com.example.travel.dto.CreatePlanRequest;
import com.example.travel.dto.PlanResponseDto;
import com.example.travel.service.TravelService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/plans")
@RequiredArgsConstructor
public class TravelController {

    private final TravelService travelService;

    /**
     * =========================================================
     * Kakao Mobility REST API Key
     * =========================================================
     *
     * application.yml
     *
     * kakao:
     *   rest-api-key: 발급받은_REST_API_KEY
     *
     */
    @Value("${kakao.rest-api-key}")
    private String kakaoRestApiKey;


    // =========================================================
    // 카카오모빌리티 자동차 길찾기
    // =========================================================

    /**
     * 실제 도로를 따라가는 자동차 경로 조회
     *
     * POST /api/plans/route
     *
     * React
     *   ↓
     * Spring Boot
     *   ↓
     * Kakao Mobility
     *
     * REST API Key는 Spring Boot에서만 사용합니다.
     *
     * 다중 경유지:
     * /v1/waypoints/directions
     */
    @PostMapping("/route")
    public ResponseEntity<?> getRoadRoute(
            @RequestBody Map<String, Object> requestBody
    ) {

        // =====================================================
        // 중요
        // 다중 경유지 자동차 길찾기 API
        // =====================================================
        String url =
                "https://apis-navi.kakaomobility.com/v1/waypoints/directions";

        RestTemplate restTemplate = new RestTemplate();

        HttpHeaders headers = new HttpHeaders();

        headers.setContentType(
                MediaType.APPLICATION_JSON
        );

        headers.setAccept(
                List.of(MediaType.APPLICATION_JSON)
        );

        // Kakao Mobility 인증
        headers.set(
                "Authorization",
                "KakaoAK " + kakaoRestApiKey
        );

        HttpEntity<Map<String, Object>> entity =
                new HttpEntity<>(
                        requestBody,
                        headers
                );

        try {

            // =================================================
            // 요청 로그
            // =================================================
            System.out.println();
            System.out.println("==========================================");
            System.out.println("🚗 Kakao Mobility 경로 요청");
            System.out.println("==========================================");
            System.out.println("URL : " + url);
            System.out.println("REQUEST : " + requestBody);
            System.out.println("==========================================");

            // =================================================
            // Kakao Mobility 호출
            // =================================================
            ResponseEntity<Map> response =
                    restTemplate.exchange(
                            url,
                            HttpMethod.POST,
                            entity,
                            Map.class
                    );

            // =================================================
            // 응답 로그
            // =================================================
            System.out.println();
            System.out.println("==========================================");
            System.out.println("🚗 Kakao Mobility 경로 응답");
            System.out.println("==========================================");
            System.out.println(
                    "STATUS : " + response.getStatusCode()
            );
            System.out.println(
                    "BODY : " + response.getBody()
            );
            System.out.println("==========================================");
            System.out.println();

            return ResponseEntity
                    .status(response.getStatusCode())
                    .body(response.getBody());

        } catch (Exception e) {

            // =================================================
            // 오류 로그
            // =================================================
            System.err.println();
            System.err.println("==========================================");
            System.err.println("❌ Kakao Mobility 경로 요청 실패");
            System.err.println("==========================================");
            System.err.println(
                    "URL : " + url
            );
            System.err.println(
                    "REQUEST : " + requestBody
            );
            System.err.println(
                    "ERROR : " + e.getMessage()
            );
            System.err.println("==========================================");

            e.printStackTrace();

            Map<String, Object> errorMap =
                    new HashMap<>();

            errorMap.put(
                    "error",
                    "카카오모빌리티 도로 경로 생성 실패"
            );

            errorMap.put(
                    "message",
                    e.getMessage()
            );

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(errorMap);
        }
    }


    // =========================================================
    // 여행 일정 등록
    // =========================================================

    /**
     * POST /api/plans
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> createPlan(
            @RequestBody CreatePlanRequest request
    ) {

        Long planId =
                travelService.createTravelPlan(request);

        Map<String, Object> response =
                new HashMap<>();

        response.put(
                "message",
                "일정이 성공적으로 등록되었습니다."
        );

        response.put(
                "planId",
                planId
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }


    // =========================================================
    // 여행 일정 목록
    // =========================================================

    /**
     * GET /api/plans?userId=1
     */
    @GetMapping
    public ResponseEntity<List<PlanResponseDto>> getPlansByUserId(
            @RequestParam("userId") Long userId
    ) {

        List<PlanResponseDto> plans =
                travelService.getPlansByUserId(userId);

        return ResponseEntity.ok(plans);
    }


    // =========================================================
    // 여행 일정 상세
    // =========================================================

    /**
     * GET /api/plans/{planId}
     */
    @GetMapping("/{planId}")
    public ResponseEntity<PlanResponseDto> getPlan(
            @PathVariable("planId") Long planId
    ) {

        PlanResponseDto planDetail =
                travelService.getPlanDetail(planId);

        return ResponseEntity.ok(planDetail);
    }


    // =========================================================
    // 여행 일정 수정
    // =========================================================

    /**
     * PUT /api/plans/{planId}
     */
    @PutMapping("/{planId}")
    public ResponseEntity<Map<String, String>> updatePlan(
            @PathVariable("planId") Long planId,
            @RequestBody CreatePlanRequest request
    ) {

        travelService.updatePlan(
                planId,
                request
        );

        Map<String, String> response =
                new HashMap<>();

        response.put(
                "message",
                "일정이 성공적으로 수정되었습니다."
        );

        return ResponseEntity.ok(response);
    }


    // =========================================================
    // 여행 일정 삭제
    // =========================================================

    /**
     * DELETE /api/plans/{planId}
     */
    @DeleteMapping("/{planId}")
    public ResponseEntity<Map<String, String>> deletePlan(
            @PathVariable("planId") Long planId
    ) {

        travelService.deletePlan(planId);

        Map<String, String> response =
                new HashMap<>();

        response.put(
                "message",
                "일정이 성공적으로 삭제되었습니다."
        );

        return ResponseEntity.ok(response);
    }
}