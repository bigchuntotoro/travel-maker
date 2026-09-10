import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPlan } from "../api/travelApi";
import KakaoMap from "../components/map/KakaoMap";
import RoutePlanner from "../components/map/RoutePlanner";

const Home = () => {
  const navigate = useNavigate();

  // =========================================================
  // 로그인 유저 정보
  // =========================================================
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // =========================================================
  // 여행 기본 정보
  // =========================================================
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // =========================================================
  // 여행 장소 목록
  // =========================================================
  const [items, setItems] = useState([]);

  // =========================================================
  // 일정 저장 상태
  // =========================================================
  const [isSubmitting, setIsSubmitting] = useState(false);

  // =========================================================
  // 장소 검색 관련 상태
  // =========================================================
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlaceForMap, setSelectedPlaceForMap] = useState(null);

  // =========================================================
  // 실제 도로 경로 관련 상태
  // =========================================================
  const [routePath, setRoutePath] = useState([]);
  const [routeSegments, setRouteSegments] = useState([]);
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  // =========================================================
  // 로그아웃
  // =========================================================
  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  // =========================================================
  // 시작 날짜 변경
  // =========================================================
  const handleStartDateChange = (e) => {
    const newStartDate = e.target.value;

    setStartDate(newStartDate);

    // 종료 날짜가 시작 날짜보다 빠르면
    // 종료 날짜를 시작 날짜와 동일하게 변경
    if (endDate && newStartDate > endDate) {
      setEndDate(newStartDate);
    }
  };

  // =========================================================
  // 장소 추가 공통 처리
  // =========================================================
  const handlePlaceSelect = (placeInfo) => {
    const newItem = {
      dayNumber: 1,
      placeName: placeInfo.placeName,
      latitude: Number(placeInfo.latitude),
      longitude: Number(placeInfo.longitude),
      visitOrder: items.length + 1,
      memo: "",
    };

    setItems((prev) => [...prev, newItem]);
  };

  // =========================================================
  // 키워드 장소 검색
  // =========================================================
  const handleSearch = (e) => {
    e.preventDefault();

    if (!searchKeyword.trim()) {
      alert("검색어를 입력해 주세요.");
      return;
    }

    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      alert("카카오 지도 API가 로드되지 않았습니다.");
      return;
    }

    const ps = new window.kakao.maps.services.Places();

    ps.keywordSearch(searchKeyword, (data, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        setSearchResults(data);
      } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
        alert("검색 결과가 존재하지 않습니다.");
        setSearchResults([]);
      } else {
        alert("장소 검색 중 오류가 발생했습니다.");
        setSearchResults([]);
      }
    });
  };

  // =========================================================
  // 검색 결과 장소 선택
  // =========================================================
  const handleSelectSearchResult = (place) => {
    const lat = parseFloat(place.y);
    const lng = parseFloat(place.x);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      alert("선택한 장소의 좌표를 확인할 수 없습니다.");
      return;
    }

    // 지도 이동용 좌표
    setSelectedPlaceForMap({
      lat,
      lng,
    });

    // 여행 장소 목록에 추가
    handlePlaceSelect({
      placeName: place.place_name,
      latitude: lat,
      longitude: lng,
    });

    // 검색창 초기화
    setSearchKeyword("");
    setSearchResults([]);
  };

  // =========================================================
  // 카카오모빌리티 실제 도로 경로 조회
  //
  // items
  //   1번 = 출발지
  //   마지막 = 목적지
  //   중간 = 경유지
  //
  // Spring Boot
  // POST /api/plans/route
  //
  // Spring Boot에서 Kakao Mobility
  // POST /v1/waypoints/directions
  // 호출
  // =========================================================
  const loadRoadRoute = async (placeItems) => {
    // 장소가 2개 미만이면 경로를 만들 수 없음
    if (!placeItems || placeItems.length < 2) {
      setRoutePath([]);
      setRouteSegments([]);
      return;
    }

    try {
      setIsRouteLoading(true);

      // -------------------------------------------------------
      // 출발지
      // -------------------------------------------------------
      const originItem = placeItems[0];

      const origin = {
        name: originItem.placeName,
        x: Number(originItem.longitude),
        y: Number(originItem.latitude),
      };

      // -------------------------------------------------------
      // 목적지
      // -------------------------------------------------------
      const destinationItem = placeItems[placeItems.length - 1];

      const destination = {
        name: destinationItem.placeName,
        x: Number(destinationItem.longitude),
        y: Number(destinationItem.latitude),
      };

      // -------------------------------------------------------
      // 경유지
      // -------------------------------------------------------
      const waypoints = placeItems.slice(1, -1).map((item) => ({
        name: item.placeName,
        x: Number(item.longitude),
        y: Number(item.latitude),
      }));

      // -------------------------------------------------------
      // 좌표 유효성 검사
      // -------------------------------------------------------
      const allPoints = [origin, ...waypoints, destination];

      const invalidPoint = allPoints.find(
        (point) =>
          Number.isNaN(point.x) ||
          Number.isNaN(point.y) ||
          point.x === 0 ||
          point.y === 0,
      );

      if (invalidPoint) {
        console.error("잘못된 좌표:", invalidPoint);

        setRoutePath([]);
        setRouteSegments([]);
        alert("장소 좌표가 올바르지 않아 경로를 계산할 수 없습니다.");
        return;
      }

      // -------------------------------------------------------
      // Spring Boot /api/plans/route 요청
      // -------------------------------------------------------
      const requestBody = {
        origin,
        destination,
        waypoints,

        // 추천 경로
        priority: "RECOMMEND",

        // 차량 정보
        car_fuel: "GASOLINE",
        car_hipass: false,

        // 대안 경로
        alternatives: false,

        // 상세 도로 정보
        road_details: false,

        // 요약 정보
        summary: false,
      };

      console.log("🚗 실제 도로 경로 요청:", requestBody);

      const response = await fetch("/api/plans/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;

        try {
          const errorData = await response.json();

          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          console.error("오류 응답 JSON 파싱 실패:", e);
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      console.log("🚗 카카오모빌리티 경로 응답:", data);

      // -------------------------------------------------------
      // routes 확인
      // -------------------------------------------------------
      if (
        !data ||
        !data.routes ||
        !Array.isArray(data.routes) ||
        data.routes.length === 0
      ) {
        console.warn("카카오모빌리티 경로가 없습니다:", data);

        setRoutePath([]);
        setRouteSegments([]);

        alert("도로 경로를 찾을 수 없습니다.");
        return;
      }

      const route = data.routes[0];

      // -------------------------------------------------------
      // 구간별 이동 시간 / 거리
      //
      // Kakao Mobility 응답의 sections는
      // 장소 1 → 장소 2
      // 장소 2 → 장소 3
      // ...
      // 순서로 구성됩니다.
      // -------------------------------------------------------
      const segments = [];

      if (Array.isArray(route.sections)) {
        route.sections.forEach((section, index) => {
          const from = placeItems[index];
          const to = placeItems[index + 1];

          segments.push({
            index: index + 1,
            from: from?.placeName || `장소 ${index + 1}`,
            to: to?.placeName || `장소 ${index + 2}`,
            duration: Number(section.duration || 0),
            distance: Number(section.distance || 0),
          });
        });
      }

      setRouteSegments(segments);

      // -------------------------------------------------------
      // sections → roads → vertexes
      //
      // vertexes 형식:
      //
      // [
      //   longitude,
      //   latitude,
      //   longitude,
      //   latitude,
      //   ...
      // ]
      // -------------------------------------------------------
      const path = [];

      if (Array.isArray(route.sections)) {
        route.sections.forEach((section) => {
          if (!Array.isArray(section.roads)) {
            return;
          }

          section.roads.forEach((road) => {
            if (!Array.isArray(road.vertexes)) {
              return;
            }

            const vertexes = road.vertexes;

            for (let i = 0; i < vertexes.length; i += 2) {
              const lng = Number(vertexes[i]);
              const lat = Number(vertexes[i + 1]);

              if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                path.push({
                  lat,
                  lng,
                });
              }
            }
          });
        });
      }

      // -------------------------------------------------------
      // 경로 좌표가 정상적으로 생성된 경우
      // -------------------------------------------------------
      if (path.length > 0) {
        console.log(`🚗 실제 도로 경로 좌표 ${path.length}개 생성`);

        setRoutePath(path);
      } else {
        console.warn(
          "카카오모빌리티 응답에서 도로 좌표를 찾지 못했습니다.",
          data,
        );

        setRoutePath([]);
        setRouteSegments([]);

        alert("도로 경로 좌표를 가져오지 못했습니다.");
      }
    } catch (error) {
      console.error("🚨 실제 도로 경로 조회 실패:", error);

      setRoutePath([]);
      setRouteSegments([]);

      alert(`실제 도로 경로를 가져오지 못했습니다.\n\n${error.message}`);
    } finally {
      setIsRouteLoading(false);
    }
  };

  // =========================================================
  // 장소 목록 변경 시 실제 도로 경로 자동 조회
  // =========================================================
  useEffect(() => {
    loadRoadRoute(items);
  }, [items]);

  // =========================================================
  // 일정 저장
  // =========================================================
  const handleSubmitPlan = async () => {
    // 여행 제목 확인
    if (!title.trim()) {
      alert("여행 제목을 입력해 주세요.");
      return;
    }

    // 여행 기간 확인
    if (!startDate || !endDate) {
      alert("여행 기간을 설정해 주세요.");
      return;
    }

    // 장소 확인
    if (items.length === 0) {
      alert("최소 하나 이상의 장소를 지도에 추가해 주세요.");
      return;
    }

    // 날짜 최종 검증
    if (startDate > endDate) {
      alert("종료 날짜는 시작 날짜보다 이전일 수 없습니다.");
      return;
    }

    // 로그인 사용자 확인
    if (!user.userId) {
      alert("로그인 정보가 없습니다. 다시 로그인해 주세요.");
      navigate("/login");
      return;
    }

    // -------------------------------------------------------
    // 서버 전송 데이터
    // -------------------------------------------------------
    const payload = {
      userId: user.userId,
      title,
      startDate,
      endDate,
      items,
    };

    console.log("📋 여행 일정 저장 요청:", payload);

    try {
      setIsSubmitting(true);

      const res = await createPlan(payload);

      alert(`성공적으로 저장되었습니다! (Plan ID: ${res.planId})`);

      // 입력값 초기화
      setTitle("");
      setStartDate("");
      setEndDate("");
      setItems([]);
      setSearchResults([]);
      setSearchKeyword("");
      setSelectedPlaceForMap(null);
      setRoutePath([]);
      setRouteSegments([]);

      // 일정 목록으로 이동
      navigate("/plans");
    } catch (error) {
      console.error("일정 저장 실패:", error);

      alert("일정 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================
  // 이동 시간 / 거리 표시용 포맷
  // =========================================================
  const formatDuration = (seconds) => {
    const totalMinutes = Math.round(Number(seconds || 0) / 60);

    if (totalMinutes < 60) {
      return `${totalMinutes}분`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) {
      return `${hours}시간`;
    }

    return `${hours}시간 ${minutes}분`;
  };

  const formatDistance = (meters) => {
    const distance = Number(meters || 0);

    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    }

    return `${(distance / 1000).toFixed(1)}km`;
  };

  const totalRouteDuration = routeSegments.reduce(
    (total, segment) => total + Number(segment.duration || 0),
    0,
  );

  const totalRouteDistance = routeSegments.reduce(
    (total, segment) => total + Number(segment.distance || 0),
    0,
  );

  // =========================================================
  // 화면
  // =========================================================
  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "24px",
      }}
    >
      {/* =====================================================
          헤더
      ====================================================== */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h1
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            color: "#111827",
            margin: 0,
          }}
        >
          ✈️ TravelMaker - 여행 일정 플래너
        </h1>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {/* 내 일정 목록 */}
          <button
            onClick={() => navigate("/plans")}
            style={{
              padding: "6px 12px",
              backgroundColor: "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              color: "#374151",
              cursor: "pointer",
            }}
          >
            📋 내 일정 목록
          </button>

          {/* 사용자 */}
          <span
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151",
            }}
          >
            👤 {user.nickname || "여행가"}님
          </span>

          {/* 로그아웃 */}
          <button
            onClick={handleLogout}
            style={{
              padding: "6px 12px",
              backgroundColor: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* =====================================================
          일정 기본 정보
      ====================================================== */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "20px",
          alignItems: "center",
          backgroundColor: "#ffffff",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
        }}
      >
        {/* 여행 제목 */}
        <input
          type="text"
          placeholder="여행 제목 (예: 제주도 2박 3일 힐링 여행)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            flex: 2,
            padding: "10px 14px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        />

        {/* 시작 날짜 */}
        <input
          type="date"
          value={startDate}
          onChange={handleStartDateChange}
          style={{
            flex: 1,
            padding: "10px 14px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        />

        <span
          style={{
            color: "#6b7280",
          }}
        >
          ~
        </span>

        {/* 종료 날짜 */}
        <input
          type="date"
          value={endDate}
          min={startDate}
          onChange={(e) => setEndDate(e.target.value)}
          disabled={!startDate}
          style={{
            flex: 1,
            padding: "10px 14px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            backgroundColor: !startDate ? "#f3f4f6" : "#ffffff",
            cursor: !startDate ? "not-allowed" : "pointer",
          }}
        />

        {/* 일정 저장 */}
        <button
          onClick={handleSubmitPlan}
          disabled={isSubmitting}
          style={{
            padding: "10px 20px",
            backgroundColor: isSubmitting ? "#93c5fd" : "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: isSubmitting ? "not-allowed" : "pointer",
          }}
        >
          {isSubmitting ? "저장 중..." : "일정 저장"}
        </button>
      </div>

      {/* =====================================================
          실제 도로 경로 계산 상태
      ====================================================== */}
      {isRouteLoading && items.length >= 2 && (
        <div
          style={{
            marginBottom: "12px",
            padding: "10px 14px",
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "8px",
            color: "#1d4ed8",
            fontSize: "13px",
            fontWeight: "600",
          }}
        >
          🚗 실제 도로 경로를 계산하고 있습니다...
        </div>
      )}

      {!isRouteLoading && items.length >= 2 && routePath.length > 0 && (
        <div
          style={{
            marginBottom: "12px",
            padding: "10px 14px",
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            color: "#15803d",
            fontSize: "13px",
            fontWeight: "600",
          }}
        >
          🚗 실제 도로 경로가 표시되었습니다.
        </div>
      )}

      {/* =====================================================
          구간별 이동 시간
      ====================================================== */}
      {!isRouteLoading && routeSegments.length > 0 && (
        <div
          style={{
            marginBottom: "12px",
            padding: "14px 16px",
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: "#111827",
              }}
            >
              🚗 구간별 이동시간
            </div>

            <div
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "#2563eb",
              }}
            >
              총 {formatDuration(totalRouteDuration)}
              {" · "}
              {formatDistance(totalRouteDistance)}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {routeSegments.map((segment) => (
              <div
                key={segment.index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 10px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "7px",
                  fontSize: "12px",
                }}
              >
                <div
                  style={{
                    minWidth: "26px",
                    height: "26px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    fontWeight: "bold",
                  }}
                >
                  {segment.index}
                </div>

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontWeight: "600",
                      color: "#374151",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {segment.from}
                    <span
                      style={{
                        margin: "0 6px",
                        color: "#9ca3af",
                      }}
                    >
                      →
                    </span>
                    {segment.to}
                  </div>

                  <div
                    style={{
                      marginTop: "3px",
                      color: "#9ca3af",
                      fontSize: "11px",
                    }}
                  >
                    {formatDistance(segment.distance)}
                  </div>
                </div>

                <div
                  style={{
                    minWidth: "70px",
                    textAlign: "right",
                    fontWeight: "bold",
                    color: "#111827",
                  }}
                >
                  {formatDuration(segment.duration)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================
          지도 + 검색 + 경로 플래너
      ====================================================== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "20px",
          height: "650px",
        }}
      >
        {/* ===================================================
            지도 영역
        ==================================================== */}
        <div
          style={{
            position: "relative",
            height: "100%",
          }}
        >
          {/* =================================================
              검색창
          ================================================== */}
          <div
            style={{
              position: "absolute",
              top: "12px",
              left: "12px",
              zIndex: 10,
              width: "320px",
              backgroundColor: "white",
              padding: "12px",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            {/* 검색 Form */}
            <form
              onSubmit={handleSearch}
              style={{
                display: "flex",
                gap: "6px",
              }}
            >
              <input
                type="text"
                placeholder="장소명 검색 (예: 해운대)"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "13px",
                  outline: "none",
                }}
              />

              <button
                type="submit"
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                검색
              </button>
            </form>

            {/* =================================================
                검색 결과
            ================================================== */}
            {searchResults.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "10px 0 0 0",
                  maxHeight: "220px",
                  overflowY: "auto",
                  borderTop: "1px solid #f3f4f6",
                }}
              >
                {searchResults.map((place) => (
                  <li
                    key={place.id}
                    onClick={() => handleSelectSearchResult(place)}
                    style={{
                      padding: "8px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f3f4f6",
                      fontSize: "12px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f9fafb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        color: "#111827",
                      }}
                    >
                      {place.place_name}
                    </div>

                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: "11px",
                        marginTop: "3px",
                      }}
                    >
                      {place.road_address_name || place.address_name}
                    </div>

                    {place.category_name && (
                      <div
                        style={{
                          color: "#9ca3af",
                          fontSize: "10px",
                          marginTop: "2px",
                        }}
                      >
                        {place.category_name}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* =================================================
              카카오 지도
              
              routePath를 KakaoMap으로 전달
              → KakaoMap.jsx에서 Polyline으로 표시
          ================================================== */}
          <KakaoMap
            items={items}
            onPlaceSelect={handlePlaceSelect}
            selectedPlaceForMap={selectedPlaceForMap}
            routePath={routePath}
          />
        </div>

        {/* ===================================================
            경로 플래너
        ==================================================== */}
        <RoutePlanner items={items} setItems={setItems} />
      </div>
    </div>
  );
};

export default Home;
