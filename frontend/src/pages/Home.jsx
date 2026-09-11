import React, { useEffect, useMemo, useState } from "react";
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
  //
  // stayMinutes : 장소 체류시간
  // =========================================================
  const [items, setItems] = useState([]);

  // =========================================================
  // 일정 저장 상태
  // =========================================================
  const [isSubmitting, setIsSubmitting] = useState(false);

  // =========================================================
  // 장소 검색
  // =========================================================
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlaceForMap, setSelectedPlaceForMap] = useState(null);

  // =========================================================
  // 실제 도로 경로
  // =========================================================
  const [routePath, setRoutePath] = useState([]);
  const [routeSegments, setRouteSegments] = useState([]);
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  // =========================================================
  // 여행 시작 시간
  // =========================================================
  const [dayStartTime] = useState("09:00");

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

      // ⭐ 기본 체류시간 60분
      stayMinutes: 60,
    };

    setItems((prev) => [...prev, newItem]);
  };

  // =========================================================
  // 체류시간 변경
  // =========================================================
  const handleStayMinutesChange = (index, value) => {
    const minutes = Math.max(0, Number(value) || 0);

    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              stayMinutes: minutes,
            }
          : item,
      ),
    );
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

    setSelectedPlaceForMap({
      lat,
      lng,
    });

    handlePlaceSelect({
      placeName: place.place_name,
      latitude: lat,
      longitude: lng,
    });

    setSearchKeyword("");
    setSearchResults([]);
  };

  // =========================================================
  // 실제 도로 경로 조회
  // =========================================================
  const loadRoadRoute = async (placeItems) => {
    if (!placeItems || placeItems.length < 2) {
      setRoutePath([]);
      setRouteSegments([]);
      return;
    }

    try {
      setIsRouteLoading(true);

      const originItem = placeItems[0];

      const origin = {
        name: originItem.placeName,
        x: Number(originItem.longitude),
        y: Number(originItem.latitude),
      };

      const destinationItem = placeItems[placeItems.length - 1];

      const destination = {
        name: destinationItem.placeName,
        x: Number(destinationItem.longitude),
        y: Number(destinationItem.latitude),
      };

      const waypoints = placeItems.slice(1, -1).map((item) => ({
        name: item.placeName,
        x: Number(item.longitude),
        y: Number(item.latitude),
      }));

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

      const requestBody = {
        origin,
        destination,
        waypoints,

        priority: "RECOMMEND",

        car_fuel: "GASOLINE",
        car_hipass: false,

        alternatives: false,
        road_details: false,
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

      // =====================================================
      // 구간별 이동시간 / 거리
      // =====================================================
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

      // =====================================================
      // 도로 좌표
      // =====================================================
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
  // 장소 목록 변경 → 실제 도로 경로 자동 조회
  // =========================================================
  useEffect(() => {
    loadRoadRoute(items);
  }, [items]);

  // =========================================================
  // 시간 "09:30" → 분
  // =========================================================
  const timeToMinutes = (time) => {
    const [hour, minute] = time.split(":").map(Number);

    return hour * 60 + minute;
  };

  // =========================================================
  // 분 → "09:30"
  // =========================================================
  const minutesToTime = (minutes) => {
    const normalized = minutes % (24 * 60);

    const hour = Math.floor(normalized / 60);
    const minute = normalized % 60;

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0",
    )}`;
  };

  // =========================================================
  // 체류시간 표시
  // =========================================================
  const formatStayDuration = (minutes) => {
    const value = Number(minutes || 0);

    if (value < 60) {
      return `${value}분`;
    }

    const hours = Math.floor(value / 60);
    const remain = value % 60;

    if (remain === 0) {
      return `${hours}시간`;
    }

    return `${hours}시간 ${remain}분`;
  };

  // =========================================================
  // 이동시간 표시
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

  // =========================================================
  // 거리 표시
  // =========================================================
  const formatDistance = (meters) => {
    const distance = Number(meters || 0);

    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    }

    return `${(distance / 1000).toFixed(1)}km`;
  };

  // =========================================================
  // 전체 이동시간
  // =========================================================
  const totalRouteDuration = routeSegments.reduce(
    (total, segment) => total + Number(segment.duration || 0),
    0,
  );

  // =========================================================
  // 전체 이동거리
  // =========================================================
  const totalRouteDistance = routeSegments.reduce(
    (total, segment) => total + Number(segment.distance || 0),
    0,
  );

  // =========================================================
  // 전체 체류시간
  // =========================================================
  const totalStayMinutes = items.reduce(
    (total, item) => total + Number(item.stayMinutes || 60),
    0,
  );

  // =========================================================
  // 자동 일정표 계산
  //
  // 장소 1
  // 09:00 도착
  // 09:00 ~ 10:00 체류
  // 10:00 출발
  //
  // 이동 18분
  //
  // 장소 2
  // 10:18 도착
  // 10:18 ~ 11:18 체류
  // 11:18 출발
  // =========================================================
  const scheduleItems = useMemo(() => {
    if (!items.length) {
      return [];
    }

    let currentMinutes = timeToMinutes(dayStartTime);

    return items.map((item, index) => {
      // 이전 장소에서 현재 장소까지 이동
      const segment = routeSegments[index - 1];

      const travelMinutes = segment
        ? Math.max(0, Math.round(Number(segment.duration || 0) / 60))
        : 0;

      // 첫 장소는 09:00 도착
      // 이후 장소는 이전 장소 출발 + 이동시간
      if (index > 0) {
        currentMinutes += travelMinutes;
      }

      const arrivalMinutes = currentMinutes;

      const stayMinutes = Math.max(0, Number(item.stayMinutes || 60));

      const departureMinutes = arrivalMinutes + stayMinutes;

      const nextSegment = routeSegments[index];

      const nextTravelMinutes = nextSegment
        ? Math.max(0, Math.round(Number(nextSegment.duration || 0) / 60))
        : 0;

      const nextArrivalMinutes = departureMinutes + nextTravelMinutes;

      currentMinutes = departureMinutes;

      return {
        ...item,

        scheduleIndex: index + 1,

        arrivalTime: minutesToTime(arrivalMinutes),

        departureTime: minutesToTime(departureMinutes),

        stayMinutes,

        travelFromPreviousMinutes: travelMinutes,

        nextTravelMinutes,

        nextDistance: nextSegment ? Number(nextSegment.distance || 0) : 0,

        nextArrivalTime:
          index < items.length - 1 ? minutesToTime(nextArrivalMinutes) : null,
      };
    });
  }, [items, routeSegments, dayStartTime]);

  // =========================================================
  // 날짜별 일정 그룹
  // =========================================================
  const scheduleByDay = useMemo(() => {
    const grouped = {};

    scheduleItems.forEach((item) => {
      const day = Number(item.dayNumber || 1);

      if (!grouped[day]) {
        grouped[day] = [];
      }

      grouped[day].push(item);
    });

    return grouped;
  }, [scheduleItems]);

  // =========================================================
  // 일정 저장
  // =========================================================
  const handleSubmitPlan = async () => {
    if (!title.trim()) {
      alert("여행 제목을 입력해 주세요.");
      return;
    }

    if (!startDate || !endDate) {
      alert("여행 기간을 설정해 주세요.");
      return;
    }

    if (items.length === 0) {
      alert("최소 하나 이상의 장소를 지도에 추가해 주세요.");
      return;
    }

    if (startDate > endDate) {
      alert("종료 날짜는 시작 날짜보다 이전일 수 없습니다.");
      return;
    }

    if (!user.userId) {
      alert("로그인 정보가 없습니다. 다시 로그인해 주세요.");
      navigate("/login");
      return;
    }

    // stayMinutes가 반드시 포함되도록 저장
    const normalizedItems = items.map((item, index) => ({
      ...item,
      visitOrder: index + 1,
      stayMinutes: Number(item.stayMinutes || 60),
    }));

    const payload = {
      userId: user.userId,
      title,
      startDate,
      endDate,
      items: normalizedItems,
    };

    console.log("📋 여행 일정 저장 요청:", payload);

    try {
      setIsSubmitting(true);

      const res = await createPlan(payload);

      alert(`성공적으로 저장되었습니다! (Plan ID: ${res.planId})`);

      setTitle("");
      setStartDate("");
      setEndDate("");
      setItems([]);
      setSearchResults([]);
      setSearchKeyword("");
      setSelectedPlaceForMap(null);
      setRoutePath([]);
      setRouteSegments([]);

      navigate("/plans");
    } catch (error) {
      console.error("일정 저장 실패:", error);

      alert("일정 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

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

          <span
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151",
            }}
          >
            👤 {user.nickname || "여행가"}님
          </span>

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

        <span style={{ color: "#6b7280" }}>~</span>

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
          실제 도로 경로 상태
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
          이동 / 체류시간 요약
      ====================================================== */}
      {items.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              padding: "14px",
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#6b7280",
              }}
            >
              📍 방문 장소
            </div>

            <div
              style={{
                marginTop: "4px",
                fontSize: "20px",
                fontWeight: "bold",
                color: "#111827",
              }}
            >
              {items.length}곳
            </div>
          </div>

          <div
            style={{
              padding: "14px",
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#6b7280",
              }}
            >
              🚗 총 이동시간
            </div>

            <div
              style={{
                marginTop: "4px",
                fontSize: "20px",
                fontWeight: "bold",
                color: "#2563eb",
              }}
            >
              {formatDuration(totalRouteDuration)}
            </div>
          </div>

          <div
            style={{
              padding: "14px",
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#6b7280",
              }}
            >
              ⏱ 총 체류시간
            </div>

            <div
              style={{
                marginTop: "4px",
                fontSize: "20px",
                fontWeight: "bold",
                color: "#059669",
              }}
            >
              {formatStayDuration(totalStayMinutes)}
            </div>
          </div>

          <div
            style={{
              padding: "14px",
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#6b7280",
              }}
            >
              🛣 총 이동거리
            </div>

            <div
              style={{
                marginTop: "4px",
                fontSize: "20px",
                fontWeight: "bold",
                color: "#7c3aed",
              }}
            >
              {formatDistance(totalRouteDistance)}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          구간별 이동시간
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
          ⭐ 자동 여행 일정표
      ====================================================== */}
      {scheduleItems.length > 0 && (
        <div
          style={{
            marginBottom: "20px",
            padding: "18px",
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            boxShadow: "0 3px 10px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "17px",
                  fontWeight: "bold",
                  color: "#111827",
                }}
              >
                🗓️ 자동 여행 일정표
              </div>

              <div
                style={{
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                실제 도로 이동시간 + 장소별 체류시간을 기준으로 계산됩니다.
              </div>
            </div>

            <div
              style={{
                padding: "7px 12px",
                backgroundColor: "#eff6ff",
                borderRadius: "20px",
                color: "#2563eb",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            >
              🕘 시작 {dayStartTime}
            </div>
          </div>

          {Object.entries(scheduleByDay).map(([dayNumber, dayItems]) => (
            <div
              key={dayNumber}
              style={{
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  padding: "10px 12px",
                  marginBottom: "10px",
                  backgroundColor: "#f3f4f6",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "#374151",
                }}
              >
                📅 Day {dayNumber}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0",
                }}
              >
                {dayItems.map((item, index) => {
                  const globalIndex = scheduleItems.findIndex(
                    (scheduleItem) => scheduleItem === item,
                  );

                  const isLast = index === dayItems.length - 1;

                  return (
                    <React.Fragment key={`${dayNumber}-${item.visitOrder}`}>
                      {/* 장소 */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "70px 36px 1fr 100px",
                          gap: "10px",
                          alignItems: "center",
                          padding: "12px",
                          backgroundColor: "#f9fafb",
                          borderRadius: "10px",
                          border: "1px solid #f3f4f6",
                        }}
                      >
                        {/* 시간 */}
                        <div
                          style={{
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "17px",
                              fontWeight: "bold",
                              color: "#2563eb",
                            }}
                          >
                            {item.arrivalTime}
                          </div>

                          <div
                            style={{
                              fontSize: "10px",
                              color: "#9ca3af",
                            }}
                          >
                            도착
                          </div>
                        </div>

                        {/* 번호 */}
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "#2563eb",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "bold",
                            fontSize: "13px",
                          }}
                        >
                          {item.visitOrder}
                        </div>

                        {/* 장소 */}
                        <div
                          style={{
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: "bold",
                              color: "#111827",
                            }}
                          >
                            {item.placeName}
                          </div>

                          <div
                            style={{
                              marginTop: "5px",
                              fontSize: "11px",
                              color: "#6b7280",
                            }}
                          >
                            체류
                            <span
                              style={{
                                marginLeft: "5px",
                                fontWeight: "bold",
                                color: "#059669",
                              }}
                            >
                              {formatStayDuration(item.stayMinutes)}
                            </span>
                            <span
                              style={{
                                margin: "0 8px",
                                color: "#d1d5db",
                              }}
                            >
                              |
                            </span>
                            출발
                            <span
                              style={{
                                marginLeft: "5px",
                                fontWeight: "bold",
                                color: "#111827",
                              }}
                            >
                              {item.departureTime}
                            </span>
                          </div>
                        </div>

                        {/* 체류시간 입력 */}
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "4px",
                              fontSize: "10px",
                              color: "#6b7280",
                            }}
                          >
                            체류시간
                          </label>

                          <select
                            value={item.stayMinutes ?? 60}
                            onChange={(e) =>
                              handleStayMinutesChange(
                                globalIndex,
                                e.target.value,
                              )
                            }
                            style={{
                              width: "100%",
                              padding: "6px 4px",
                              border: "1px solid #d1d5db",
                              borderRadius: "6px",
                              fontSize: "11px",
                              backgroundColor: "#ffffff",
                            }}
                          >
                            <option value="30">30분</option>
                            <option value="60">1시간</option>
                            <option value="90">1시간 30분</option>
                            <option value="120">2시간</option>
                            <option value="150">2시간 30분</option>
                            <option value="180">3시간</option>
                            <option value="240">4시간</option>
                          </select>
                        </div>
                      </div>

                      {/* 다음 장소까지 이동 */}
                      {!isLast && item.nextTravelMinutes > 0 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "8px 0 8px 84px",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              width: "2px",
                              height: "32px",
                              backgroundColor: "#93c5fd",
                            }}
                          />

                          <div
                            style={{
                              padding: "7px 10px",
                              backgroundColor: "#eff6ff",
                              borderRadius: "7px",
                              fontSize: "11px",
                              color: "#2563eb",
                            }}
                          >
                            🚗 <strong>{item.nextTravelMinutes}분</strong>
                            {" · "}
                            {item.nextDistance > 0
                              ? formatDistance(item.nextDistance)
                              : ""}
                            <span
                              style={{
                                marginLeft: "8px",
                                color: "#6b7280",
                              }}
                            >
                              →
                            </span>
                            <strong
                              style={{
                                marginLeft: "5px",
                              }}
                            >
                              {scheduleItems[globalIndex + 1]?.arrivalTime} 도착
                            </strong>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ))}
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
            지도
        ==================================================== */}
        <div
          style={{
            position: "relative",
            height: "100%",
          }}
        >
          {/* 검색창 */}
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

            {/* 검색 결과 */}
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
