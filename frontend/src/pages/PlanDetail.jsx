// ============================================================
// PlanDetail.jsx
// TravelMaker - 여행 일정 상세 / 편집
//
// 주요 기능
// 1. 여행 일정 상세 조회
// 2. 여행 일정 편집
// 3. DAY별 장소 관리
// 4. 장소 드래그앤드롭
// 5. DAY 간 장소 이동
// 6. 카카오 지도 연동
// 7. 카카오 도로 경로 연동
// 8. DAY별 날씨 정보
// 9. 체류시간 설정
// 10. 도착/출발 예정시간 계산
// 11. 반응형 PC / 모바일 UI
// ============================================================

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  CalendarDays,
  Car,
  Clock3,
  CloudSun,
  GripVertical,
  MapPin,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import axiosInstance from "../api/axiosInstance";
import KakaoMap from "../components/map/KakaoMap";

// ============================================================
// 기본 설정
// ============================================================

const DEFAULT_START_TIME = "09:00";

const STAY_OPTIONS = [30, 60, 90, 120, 150, 180, 240];

// ============================================================
// 공통 스타일
// ============================================================

const S = {
  flexRow: {
    display: "flex",
    alignItems: "center",
  },

  flexBetween: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  btnBase: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "9px 13px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fff",
  },
};

// ============================================================
// Utility
// ============================================================

const createUiId = () =>
  `ui-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// ============================================================
// 일정 데이터 정규화
// ============================================================

const normalizeItems = (items = []) =>
  [...items]
    .map((item, idx) => ({
      ...item,

      _uiId: item._uiId || createUiId(),

      dayNumber: Number(item.dayNumber || 1),

      visitOrder: Number(item.visitOrder ?? idx + 1),

      stayMinutes: Number(item.stayMinutes ?? 60),

      latitude: toNumber(item.latitude ?? item.lat),

      longitude: toNumber(item.longitude ?? item.lng),
    }))
    .sort((a, b) => a.dayNumber - b.dayNumber || a.visitOrder - b.visitOrder);

// ============================================================
// DAY별 visitOrder 재생성
// ============================================================

const normalizeVisitOrders = (items = []) => {
  const dayMap = new Map();

  items.forEach((item) => {
    const dayNumber = Number(item.dayNumber || 1);

    if (!dayMap.has(dayNumber)) {
      dayMap.set(dayNumber, []);
    }

    dayMap.get(dayNumber).push(item);
  });

  const result = [];

  [...dayMap.keys()]
    .sort((a, b) => a - b)
    .forEach((dayNumber) => {
      dayMap.get(dayNumber).forEach((item, index) => {
        result.push({
          ...item,
          dayNumber,
          visitOrder: index + 1,
        });
      });
    });

  return result;
};

// ============================================================
// DAY별 그룹
// ============================================================

const groupItemsByDay = (items = []) => {
  const grouped = {};

  items.forEach((item) => {
    const dayNumber = Number(item.dayNumber || 1);

    if (!grouped[dayNumber]) {
      grouped[dayNumber] = [];
    }

    grouped[dayNumber].push(item);
  });

  Object.keys(grouped).forEach((dayNumber) => {
    grouped[dayNumber].sort(
      (a, b) => Number(a.visitOrder || 0) - Number(b.visitOrder || 0),
    );
  });

  return grouped;
};

// ============================================================
// 시간 포맷
// ============================================================

const formatDuration = (value, isSeconds = false) => {
  const raw = Number(value) || 0;

  const minutes = isSeconds ? Math.round(raw / 60) : raw;

  if (minutes < 60) {
    return `${minutes}분`;
  }

  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;

  if (remain === 0) {
    return `${hours}시간`;
  }

  return `${hours}시간 ${remain}분`;
};

// ============================================================
// 거리 포맷
// ============================================================

const formatDistance = (value) => {
  const distance = Number(value) || 0;

  if (distance < 1000) {
    return `${Math.round(distance)}m`;
  }

  return `${(distance / 1000).toFixed(1)}km`;
};

// ============================================================
// 시간 → 분
// ============================================================

const timeToMins = (time) => {
  if (!time) {
    return 0;
  }

  const [hour, minute] = String(time).split(":").map(Number);

  return hour * 60 + minute;
};

// ============================================================
// 분 → 시간
// ============================================================

const minsToTime = (minutes) => {
  const total = Math.max(0, Number(minutes) || 0);

  const hour = Math.floor(total / 60) % 24;

  const minute = total % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

// ============================================================
// 날짜 차이
// ============================================================

const calculateDayCount = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return 1;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }

  const diff = Math.floor((end - start) / 86400000);

  return Math.max(diff + 1, 1);
};

// ============================================================
// SortablePlanItem
// ============================================================

const SortablePlanItem = ({
  item,
  index,
  isEditing,
  onRemove,
  onStayChange,
  onSelect,
  routeSection,
  arrivalTime,
  departureTime,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item._uiId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),

    transition,

    opacity: isDragging ? 0.4 : 1,

    background: isDragging ? "#eff6ff" : "#ffffff",

    border: isDragging ? "1px solid #2563eb" : "1px solid #e5e7eb",

    borderRadius: 10,

    padding: "10px",

    marginBottom: 8,

    boxShadow: isDragging
      ? "0 8px 20px rgba(37,99,235,0.15)"
      : "0 1px 3px rgba(0,0,0,0.05)",

    cursor: "pointer",
  };

  return (
    <div ref={setNodeRef} style={style} onClick={() => onSelect?.(item)}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 9,
        }}
      >
        {/* 드래그 버튼 */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "none",
            background: "#eff6ff",
            color: "#2563eb",
            cursor: "grab",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          aria-label="장소 이동"
        >
          <GripVertical size={16} />
        </button>

        {/* 번호 */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "#2563eb",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          {index + 1}
        </div>

        {/* 내용 */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* 장소명 */}
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#111827",
              marginBottom: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.placeName || "장소"}
          </div>

          {/* 주소 */}
          <div
            style={{
              ...S.flexRow,
              gap: 5,
              color: "#6b7280",
              fontSize: 12,
              marginBottom: 5,
            }}
          >
            <MapPin size={13} />

            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.address || "주소 정보 없음"}
            </span>
          </div>

          {/* 시간 */}
          <div
            style={{
              ...S.flexRow,
              gap: 7,
              fontSize: 11,
              flexWrap: "wrap",
            }}
          >
            {arrivalTime && (
              <span
                style={{
                  color: "#2563eb",
                  fontWeight: 700,
                }}
              >
                {arrivalTime}
              </span>
            )}

            {departureTime && (
              <>
                <span
                  style={{
                    color: "#9ca3af",
                  }}
                >
                  →
                </span>

                <span
                  style={{
                    color: "#374151",
                  }}
                >
                  {departureTime}
                </span>
              </>
            )}

            <span
              style={{
                color: "#6b7280",
              }}
            >
              체류 {formatDuration(item.stayMinutes)}
            </span>
          </div>

          {/* 이동 경로 */}
          {routeSection && (
            <div
              style={{
                ...S.flexRow,
                gap: 6,
                marginTop: 5,
                color: "#059669",
                fontSize: 11,
                fontWeight: 600,
                flexWrap: "wrap",
              }}
            >
              <Car size={12} />

              <span>
                다음 장소까지 {formatDuration(routeSection.duration, true)}
              </span>

              {routeSection.distance > 0 && (
                <span
                  style={{
                    color: "#6b7280",
                  }}
                >
                  · {formatDistance(routeSection.distance)}
                </span>
              )}
            </div>
          )}

          {/* 편집 */}
          {isEditing && (
            <div
              style={{
                ...S.flexRow,
                gap: 6,
                marginTop: 8,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Clock3 size={13} color="#6b7280" />

              <select
                value={Number(item.stayMinutes || 60)}
                onChange={(e) =>
                  onStayChange(item._uiId, Number(e.target.value))
                }
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  padding: "5px 7px",
                  fontSize: 11,
                  background: "#fff",
                }}
              >
                {STAY_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    체류 {formatDuration(minutes)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => onRemove(item._uiId)}
                style={{
                  marginLeft: "auto",
                  border: "none",
                  background: "transparent",
                  color: "#ef4444",
                  cursor: "pointer",
                  padding: 4,
                }}
                aria-label="장소 삭제"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// DAY Drop Container
// ============================================================

const DayDropContainer = ({
  dayNumber,
  children,
  itemIds,
  isEditing,
  onDaySelect,
  isSelected,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayNumber}`,
  });

  const background = isOver ? "#eff6ff" : isSelected ? "#f8fbff" : "#f9fafb";

  const border = isOver
    ? "2px dashed #2563eb"
    : isSelected
      ? "2px solid #2563eb"
      : "1px solid #e5e7eb";

  return (
    <div
      ref={setNodeRef}
      onClick={() => onDaySelect?.(dayNumber)}
      style={{
        border,
        borderRadius: 12,
        padding: 10,
        background,
        transition: "all 0.15s ease",
        cursor: "pointer",
      }}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>

      {isEditing && itemIds.length === 0 && (
        <div
          style={{
            minHeight: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9ca3af",
            fontSize: 12,
            border: "1px dashed #d1d5db",
            borderRadius: 8,
            background: "#fff",
          }}
        >
          이곳으로 장소를 이동하세요
        </div>
      )}
    </div>
  );
};

// ============================================================
// PlanDetail
// ============================================================

const PlanDetail = () => {
  const { planId } = useParams();
  const navigate = useNavigate();

  // ----------------------------------------------------------
  // 기본 상태
  // ----------------------------------------------------------

  const [plan, setPlan] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  // ----------------------------------------------------------
  // 편집 상태
  // ----------------------------------------------------------

  const [isEditing, setIsEditing] = useState(false);

  const [editTitle, setEditTitle] = useState("");

  const [editStartDate, setEditStartDate] = useState("");

  const [editEndDate, setEditEndDate] = useState("");

  const [editItems, setEditItems] = useState([]);

  const [isSaving, setIsSaving] = useState(false);

  // ----------------------------------------------------------
  // 지도 / 경로
  // ----------------------------------------------------------

  const [routePathsByDay, setRoutePathsByDay] = useState({});

  const [routeSections, setRouteSections] = useState([]);

  const routeRequestIdRef = useRef(0);

  const [selectedDayForMap, setSelectedDayForMap] = useState(1);

  const [selectedPlaceForMap, setSelectedPlaceForMap] = useState(null);

  // ----------------------------------------------------------
  // Drag
  // ----------------------------------------------------------

  const [activeDragId, setActiveDragId] = useState(null);

  // ----------------------------------------------------------
  // 날씨
  // ----------------------------------------------------------

  const [weatherInfo, setWeatherInfo] = useState(null);

  const [weatherLoading, setWeatherLoading] = useState(false);

  // ----------------------------------------------------------
  // DnD Sensors
  // ----------------------------------------------------------

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),

    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ==========================================================
  // 편집 상태 초기화
  // ==========================================================

  const initEditState = useCallback((data) => {
    const items = normalizeItems(data?.items || []);

    setEditTitle(data?.title || "");

    setEditStartDate(data?.startDate || "");

    setEditEndDate(data?.endDate || "");

    setEditItems(items);

    const firstDay = items.length > 0 ? Number(items[0].dayNumber || 1) : 1;

    setSelectedDayForMap(firstDay);

    setSelectedPlaceForMap(null);
  }, []);

  // ==========================================================
  // Kakao Route Path 추출
  // ==========================================================

  const extractRoutePath = useCallback((sections = []) => {
    const path = [];

    sections.forEach((section) => {
      const roads = section?.roads || [];

      roads.forEach((road) => {
        const vertexes = road?.vertexes || [];

        for (let i = 0; i < vertexes.length - 1; i += 2) {
          const lng = Number(vertexes[i]);

          const lat = Number(vertexes[i + 1]);

          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            path.push({
              lat,
              lng,
            });
          }
        }
      });
    });

    return path;
  }, []);

  // ==========================================================
  // DAY별 도로 경로 조회
  // ==========================================================

  const loadRoadRoutesByDay = useCallback(
    async (items) => {
      const requestId = ++routeRequestIdRef.current;

      const grouped = groupItemsByDay(items);

      try {
        const dayNumbers = Object.keys(grouped)
          .map(Number)
          .sort((a, b) => a - b);

        const newSections = [];
        const newPaths = {};

        for (const dayNumber of dayNumbers) {
          if (requestId !== routeRequestIdRef.current) {
            return;
          }

          const dayItems = grouped[dayNumber] || [];

          // 장소가 0~1개면 경로 불필요
          if (dayItems.length <= 1) {
            newPaths[dayNumber] = [];

            continue;
          }

          const first = dayItems[0];

          const last = dayItems[dayItems.length - 1];

          const origin = {
            name: first.placeName || "출발지",

            x: Number(first.longitude),

            y: Number(first.latitude),
          };

          const destination = {
            name: last.placeName || "도착지",

            x: Number(last.longitude),

            y: Number(last.latitude),
          };

          const waypoints = dayItems.slice(1, -1).map((item) => ({
            name: item.placeName || "경유지",

            x: Number(item.longitude),

            y: Number(item.latitude),
          }));

          // 좌표 검증
          if (
            !Number.isFinite(origin.x) ||
            !Number.isFinite(origin.y) ||
            !Number.isFinite(destination.x) ||
            !Number.isFinite(destination.y)
          ) {
            newPaths[dayNumber] = [];

            continue;
          }

          const response = await axiosInstance.post("/api/plans/route", {
            origin,
            destination,
            waypoints,

            priority: "RECOMMEND",

            car_fuel: "GASOLINE",

            car_hipass: false,

            alternatives: false,

            road_details: false,

            summary: false,
          });

          const route = response?.data?.routes?.[0];

          if (!route) {
            newPaths[dayNumber] = [];

            continue;
          }

          const sections = route.sections || [];

          newPaths[dayNumber] = extractRoutePath(sections);

          sections.forEach((section, index) => {
            const fromItem = dayItems[index];

            const toItem = dayItems[index + 1];

            if (!fromItem || !toItem) {
              return;
            }

            newSections.push({
              dayNumber,

              fromUiId: fromItem._uiId,

              toUiId: toItem._uiId,

              from: fromItem,

              to: toItem,

              duration: Number(section.duration || 0),

              distance: Number(section.distance || 0),

              isCurrentLocation: false,
            });
          });
        }

        if (requestId !== routeRequestIdRef.current) {
          return;
        }

        setRouteSections(newSections);

        setRoutePathsByDay(newPaths);
      } catch (routeError) {
        console.error("도로 경로 조회 실패:", routeError);

        if (requestId !== routeRequestIdRef.current) {
          return;
        }

        setRouteSections([]);
        setRoutePathsByDay({});
      }
    },
    [extractRoutePath],
  );

  // ==========================================================
  // 일정 상세 조회
  // ==========================================================

  const fetchPlanDetail = useCallback(async () => {
    if (!planId) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await axiosInstance.get(`/api/plans/${planId}`);

      const data = response?.data;

      setPlan(data);

      initEditState(data);

      await loadRoadRoutesByDay(normalizeItems(data?.items || []));
    } catch (err) {
      console.error("일정 조회 실패:", err);

      setError("여행 일정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [planId, initEditState, loadRoadRoutesByDay]);

  // ==========================================================
  // 최초 조회
  // ==========================================================

  useEffect(() => {
    fetchPlanDetail();
  }, [fetchPlanDetail]);

  // ==========================================================
  // 현재 아이템
  // ==========================================================

  const currentItems = useMemo(
    () => (isEditing ? editItems : normalizeItems(plan?.items || [])),
    [isEditing, editItems, plan?.items],
  );

  // ==========================================================
  // DAY 그룹
  // ==========================================================

  const itemsByDay = useMemo(
    () => groupItemsByDay(currentItems),
    [currentItems],
  );

  // ==========================================================
  // DAY 개수
  // ==========================================================

  const dayNumbers = useMemo(() => {
    const startDate = isEditing ? editStartDate : plan?.startDate;

    const endDate = isEditing ? editEndDate : plan?.endDate;

    const dateCount = calculateDayCount(startDate, endDate);

    const itemDayNumbers = Object.keys(itemsByDay)
      .map(Number)
      .filter(Number.isFinite);

    const maxItemDay = itemDayNumbers.length ? Math.max(...itemDayNumbers) : 1;

    const count = Math.max(dateCount, maxItemDay, 1);

    return Array.from({ length: count }, (_, index) => index + 1);
  }, [
    itemsByDay,
    isEditing,
    editStartDate,
    editEndDate,
    plan?.startDate,
    plan?.endDate,
  ]);

  // ==========================================================
  // 선택 DAY 보정
  // ==========================================================

  useEffect(() => {
    if (!dayNumbers.includes(selectedDayForMap)) {
      setSelectedDayForMap(dayNumbers[0] || 1);

      setSelectedPlaceForMap(null);
    }
  }, [dayNumbers, selectedDayForMap]);

  // ==========================================================
  // 선택 DAY 데이터
  // ==========================================================

  const selectedDayItems = itemsByDay[selectedDayForMap] || [];

  const selectedRoutePath = routePathsByDay[selectedDayForMap] || [];

  // ==========================================================
  // 날씨 조회
  //
  // 현재는 Mock 구조.
  // 실제 날씨 API를 만들면 아래 axios 부분만 교체.
  // ==========================================================

  const fetchWeatherForSelectedDay = useCallback(async (dayItems) => {
    if (!dayItems || dayItems.length === 0) {
      setWeatherInfo(null);
      return;
    }

    const targetPlace = dayItems[0];

    const latitude = Number(targetPlace.latitude);

    const longitude = Number(targetPlace.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setWeatherInfo(null);
      return;
    }

    try {
      setWeatherLoading(true);

      // ====================================================
      // 실제 백엔드 날씨 API를 사용할 경우
      //
      // const response =
      //   await axiosInstance.get(
      //     `/api/weather?lat=${latitude}&lng=${longitude}`
      //   );
      //
      // setWeatherInfo(response.data);
      // ====================================================

      // ----------------------------------------------------
      // 현재 임시 Mock
      // ----------------------------------------------------

      await new Promise((resolve) => setTimeout(resolve, 200));

      setWeatherInfo({
        temperature: "22°C",
        description: "맑음",
        locationName: targetPlace.placeName || "해당 지역",
      });
    } catch (err) {
      console.error("날씨 정보를 불러오지 못했습니다.", err);

      setWeatherInfo(null);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  // ==========================================================
  // DAY 변경 → 날씨 변경
  // ==========================================================

  useEffect(() => {
    fetchWeatherForSelectedDay(selectedDayItems);
  }, [selectedDayForMap, selectedDayItems, fetchWeatherForSelectedDay]);

  // ==========================================================
  // DAY 선택
  //
  // 첫 장소로 지도 이동시키지 않음.
  // KakaoMap이 해당 DAY 전체 장소를 기준으로 표시하도록 함.
  // ==========================================================

  const handleDaySelect = useCallback((dayNumber) => {
    const day = Number(dayNumber);

    setSelectedDayForMap(day);

    setSelectedPlaceForMap(null);
  }, []);

  // ==========================================================
  // 지도 장소 선택 / 추가
  // ==========================================================

  const handlePlaceSelectFromMap = useCallback(
    (place) => {
      if (!place) {
        return;
      }

      const latitude = Number(place.latitude ?? place.lat);

      const longitude = Number(place.longitude ?? place.lng);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      // ----------------------------------------------------
      // 조회 모드
      // ----------------------------------------------------

      if (!isEditing) {
        setSelectedPlaceForMap({
          lat: latitude,
          lng: longitude,
          placeName: place.placeName || place.name || "",
          uiId: place.uiId || null,
        });

        return;
      }

      // ----------------------------------------------------
      // 지도 클릭
      // ----------------------------------------------------

      if (place.source === "map-click") {
        setSelectedPlaceForMap({
          lat: latitude,
          lng: longitude,
          placeName: place.placeName || place.name || "",
        });

        return;
      }

      // ----------------------------------------------------
      // 장소 추가
      // ----------------------------------------------------

      const targetDay = Number(selectedDayForMap || 1);

      // 같은 DAY에서 동일 좌표 중복 방지
      const duplicated = editItems.some((item) => {
        const sameDay = Number(item.dayNumber || 1) === targetDay;

        const sameLat = Math.abs(Number(item.latitude) - latitude) < 0.000001;

        const sameLng = Math.abs(Number(item.longitude) - longitude) < 0.000001;

        return sameDay && sameLat && sameLng;
      });

      if (duplicated) {
        setSelectedPlaceForMap({
          lat: latitude,
          lng: longitude,
          placeName: place.placeName || place.name || "",
        });

        return;
      }

      const uiId = createUiId();

      const newItem = {
        _uiId: uiId,

        placeName: place.placeName || place.name || "선택된 장소",

        address: place.address || "",

        latitude,

        longitude,

        dayNumber: targetDay,

        visitOrder:
          editItems.filter((item) => Number(item.dayNumber || 1) === targetDay)
            .length + 1,

        stayMinutes: 60,
      };

      setEditItems((prev) => normalizeVisitOrders([...prev, newItem]));

      // 중요:
      // uiId를 같이 저장하여
      // 장소 선택/삭제 상태를 정확히 연결
      setSelectedPlaceForMap({
        lat: latitude,
        lng: longitude,
        placeName: newItem.placeName,
        uiId,
      });
    },
    [isEditing, selectedDayForMap, editItems],
  );

  // ==========================================================
  // 장소 선택
  // ==========================================================

  const handleItemSelect = useCallback((item) => {
    const dayNumber = Number(item.dayNumber || 1);

    setSelectedDayForMap(dayNumber);

    setSelectedPlaceForMap({
      lat: Number(item.latitude),

      lng: Number(item.longitude),

      placeName: item.placeName || "",

      uiId: item._uiId,
    });
  }, []);

  // ==========================================================
  // 장소 삭제
  // ==========================================================

  const handleRemoveItem = useCallback((uiId) => {
    setEditItems((prev) => {
      const next = normalizeVisitOrders(
        prev.filter((item) => item._uiId !== uiId),
      );

      return next;
    });

    setSelectedPlaceForMap((current) =>
      current?.uiId === uiId ? null : current,
    );
  }, []);

  // ==========================================================
  // 체류시간 변경
  // ==========================================================

  const handleStayChange = useCallback((uiId, minutes) => {
    setEditItems((prev) =>
      prev.map((item) =>
        item._uiId === uiId
          ? {
              ...item,
              stayMinutes: minutes,
            }
          : item,
      ),
    );
  }, []);

  // ==========================================================
  // Drag End
  // ==========================================================

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;

    setActiveDragId(null);

    if (!over) {
      return;
    }

    const activeId = String(active.id);

    const overId = String(over.id);

    setEditItems((prev) => {
      const items = [...prev];

      const activeIndex = items.findIndex(
        (item) => String(item._uiId) === activeId,
      );

      if (activeIndex === -1) {
        return prev;
      }

      const activeItem = items[activeIndex];

      // ----------------------------------------------------
      // DAY 영역에 직접 드롭
      // ----------------------------------------------------

      if (overId.startsWith("day-")) {
        const targetDay = Number(overId.replace("day-", ""));

        if (Number(activeItem.dayNumber) === targetDay) {
          return prev;
        }

        const remaining = items.filter(
          (item) => String(item._uiId) !== activeId,
        );

        return normalizeVisitOrders([
          ...remaining,
          {
            ...activeItem,
            dayNumber: targetDay,
          },
        ]);
      }

      // ----------------------------------------------------
      // 다른 장소 위에 드롭
      // ----------------------------------------------------

      const overIndex = items.findIndex(
        (item) => String(item._uiId) === overId,
      );

      if (overIndex === -1) {
        return prev;
      }

      const targetDay = Number(items[overIndex].dayNumber || 1);

      const withoutActive = items.filter(
        (item) => String(item._uiId) !== activeId,
      );

      const targetIndex = withoutActive.findIndex(
        (item) => String(item._uiId) === overId,
      );

      if (targetIndex === -1) {
        return prev;
      }

      withoutActive.splice(targetIndex, 0, {
        ...activeItem,
        dayNumber: targetDay,
      });

      return normalizeVisitOrders(withoutActive);
    });
  }, []);

  // ==========================================================
  // Drag Cancel
  // ==========================================================

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

  // ==========================================================
  // 편집 중 경로 자동 갱신
  // ==========================================================

  useEffect(() => {
    if (!isEditing || editItems.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      loadRoadRoutesByDay(editItems);
    }, 400);

    return () => clearTimeout(timer);
  }, [editItems, isEditing, loadRoadRoutesByDay]);

  // ==========================================================
  // 일정 시간 계산
  // ==========================================================

  const scheduleByDay = useMemo(() => {
    const result = {};

    dayNumbers.forEach((dayNumber) => {
      const dayItems = itemsByDay[dayNumber] || [];

      let currentMinutes = timeToMins(DEFAULT_START_TIME);

      result[dayNumber] = dayItems.map((item) => {
        const arrivalMinutes = currentMinutes;

        const departureMinutes =
          arrivalMinutes + Number(item.stayMinutes || 60);

        const section = routeSections.find(
          (route) =>
            Number(route.dayNumber) === dayNumber &&
            route.fromUiId === item._uiId,
        );

        const drivingMinutes = section
          ? Math.round(Number(section.duration || 0) / 60)
          : 0;

        currentMinutes = departureMinutes + drivingMinutes;

        return {
          item,

          arrivalTime: minsToTime(arrivalMinutes),

          departureTime: minsToTime(departureMinutes),

          routeSection: section,
        };
      });
    });

    return result;
  }, [dayNumbers, itemsByDay, routeSections]);

  // ==========================================================
  // 저장
  // ==========================================================

  const handleSave = useCallback(async () => {
    if (isSaving) {
      return;
    }

    if (!editTitle.trim()) {
      alert("여행 제목을 입력해주세요.");

      return;
    }

    if (!editStartDate || !editEndDate) {
      alert("여행 날짜를 확인해주세요.");

      return;
    }

    if (editStartDate > editEndDate) {
      alert("종료일은 시작일보다 빠를 수 없습니다.");

      return;
    }

    try {
      setIsSaving(true);

      const normalized = normalizeVisitOrders(editItems);

      // _uiId는 화면 전용이므로 서버에 보내지 않음
      const cleanItems = normalized.map((item) => {
        const { _uiId, ...cleanItem } = item;

        return cleanItem;
      });

      await axiosInstance.put(`/api/plans/${planId}`, {
        title: editTitle.trim(),

        startDate: editStartDate,

        endDate: editEndDate,

        items: cleanItems,
      });

      alert("저장되었습니다.");

      setIsEditing(false);

      await fetchPlanDetail();
    } catch (err) {
      console.error("일정 저장 실패:", err);

      alert("일정 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    editTitle,
    editStartDate,
    editEndDate,
    editItems,
    planId,
    fetchPlanDetail,
  ]);

  // ==========================================================
  // 편집 취소
  // ==========================================================

  const handleCancelEdit = useCallback(() => {
    initEditState(plan);

    setIsEditing(false);

    setSelectedPlaceForMap(null);
  }, [initEditState, plan]);

  // ==========================================================
  // 일정 삭제
  // ==========================================================

  const handleDelete = useCallback(async () => {
    const confirmed = window.confirm("이 여행 일정을 삭제하시겠습니까?");

    if (!confirmed) {
      return;
    }

    try {
      await axiosInstance.delete(`/api/plans/${planId}`);

      alert("삭제되었습니다.");

      navigate("/plans");
    } catch (err) {
      console.error("일정 삭제 실패:", err);

      alert("일정 삭제에 실패했습니다.");
    }
  }, [planId, navigate]);

  // ==========================================================
  // Loading
  // ==========================================================

  if (loading) {
    return (
      <div
        style={{
          padding: 50,
          textAlign: "center",
          color: "#6b7280",
        }}
      >
        여행 일정을 불러오는 중...
      </div>
    );
  }

  // ==========================================================
  // Error
  // ==========================================================

  if (error) {
    return (
      <div
        style={{
          padding: 50,
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: "#ef4444",
            marginBottom: 20,
          }}
        >
          {error}
        </div>

        <button
          onClick={() => navigate("/plans")}
          style={{
            padding: "10px 16px",

            border: "1px solid #d1d5db",

            borderRadius: 8,

            background: "#fff",

            cursor: "pointer",
          }}
        >
          목록으로
        </button>
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  // ==========================================================
  // Drag Overlay Item
  // ==========================================================

  const activeDragItem = activeDragId
    ? currentItems.find((item) => String(item._uiId) === String(activeDragId))
    : null;

  // ==========================================================
  // Render
  // ==========================================================

  return (
    <div className="travel-detail">
      <style>
        {`
          /* =====================================================
             전체
             ===================================================== */

          .travel-detail {
            width: 100%;
            max-width: 1500px;
            margin: 0 auto;
            padding: 25px 20px 50px;
            box-sizing: border-box;
          }

          /* =====================================================
             Header
             ===================================================== */

          .travel-detail-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            margin-bottom: 20px;
          }

          .travel-detail-header-left {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .travel-back-button {
            width: 38px;
            height: 38px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            flex-shrink: 0;
          }

          .travel-detail-title-area {
            min-width: 0;
          }

          .travel-detail-title {
            margin: 0;
            font-size: 25px;
            font-weight: 800;
            color: #111827;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .travel-detail-title-input {
            width: min(500px, 100%);
            box-sizing: border-box;
            font-size: 24px;
            font-weight: 800;
            border: 1px solid #d1d5db;
            border-radius: 7px;
            padding: 5px 8px;
            outline: none;
          }

          .travel-detail-date {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 5px;
            color: #6b7280;
            font-size: 13px;
          }

          .travel-detail-date input {
            max-width: 145px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 5px 7px;
            box-sizing: border-box;
          }

          .travel-detail-actions {
            display: flex;
            gap: 8px;
            flex-shrink: 0;
          }

          /* =====================================================
             Main Grid
             ===================================================== */

          .travel-detail-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 1.85fr)
              minmax(320px, 1fr);
            gap: 20px;
            align-items: start;
          }

          /* =====================================================
             Map Wrapper
             ===================================================== */

          .travel-map-wrapper {
            position: sticky;
            top: 15px;
            height: 650px;
            min-height: 450px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #fff;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          /*
           * 중요:
           * DAY 버튼을 지도 위 absolute로 올리지 않고
           * 지도 바깥의 toolbar로 분리
           */

          .travel-map-toolbar {
            width: 100%;
            min-height: 54px;
            padding: 8px 10px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            background: #fff;
            border-bottom: 1px solid #e5e7eb;
            flex-shrink: 0;
            z-index: 10;
          }

          .travel-map-toolbar-title {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #374151;
            font-size: 13px;
            font-weight: 800;
            white-space: nowrap;
            flex-shrink: 0;
          }

          .travel-map-day-selector {
            display: flex;
            align-items: center;
            gap: 5px;
            max-width: calc(100% - 90px);
            overflow-x: auto;
            overflow-y: hidden;
            padding: 2px;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }

          .travel-map-day-selector::-webkit-scrollbar {
            display: none;
          }

          .travel-map-day-button {
            border: none;
            border-radius: 7px;
            padding: 7px 10px;
            background: #f3f4f6;
            color: #374151;
            font-weight: 700;
            font-size: 12px;
            cursor: pointer;
            white-space: nowrap;
            flex-shrink: 0;
          }

          .travel-map-day-button.selected {
            background: #2563eb;
            color: #fff;
          }

          .travel-map-content {
            position: relative;
            flex: 1;
            min-height: 0;
            width: 100%;
            overflow: hidden;
          }

          /* =====================================================
             Weather
             ===================================================== */

          .travel-weather {
            margin-bottom: 16px;
            padding: 12px 16px;
            box-sizing: border-box;
            background:
              linear-gradient(
                135deg,
                #eff6ff 0%,
                #dbeafe 100%
              );
            border: 1px solid #bfdbfe;
            border-radius: 12px;
          }

          .travel-weather-inner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }

          .travel-weather-left {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .travel-weather-icon {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #2563eb;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .travel-weather-title {
            font-size: 13px;
            font-weight: 800;
            color: #1e40af;
          }

          .travel-weather-text {
            margin-top: 2px;
            font-size: 12px;
            color: #4b5563;
            line-height: 1.45;
          }

          /* =====================================================
             Day Header
             ===================================================== */

          .travel-day-section {
            margin-bottom: 14px;
          }

          .travel-day-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 11px 13px;
            border-radius: 10px 10px 0 0;
            cursor: pointer;
          }

          .travel-day-header.selected {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
          }

          .travel-day-header:not(.selected) {
            background: #f3f4f6;
            border: 1px solid #e5e7eb;
          }

          .travel-day-title {
            font-size: 15px;
            font-weight: 800;
          }

          .travel-day-header.selected .travel-day-title {
            color: #2563eb;
          }

          .travel-day-header:not(.selected) .travel-day-title {
            color: #111827;
          }

          /* =====================================================
             Mobile
             ===================================================== */

          @media (max-width: 900px) {

            .travel-detail {
              padding: 18px 14px 40px;
            }

            .travel-detail-grid {
              grid-template-columns: 1fr;
            }

            .travel-map-wrapper {
              position: relative;
              top: auto;
              width: 100%;
              height: 500px;
              min-height: 430px;
            }

            .travel-detail-header {
              align-items: flex-start;
            }
          }

          @media (max-width: 768px) {

            .travel-detail {
              padding:
                12px
                10px
                35px;
            }

            .travel-detail-header {
              flex-direction: column;
              align-items: stretch;
              gap: 12px;
            }

            .travel-detail-header-left {
              width: 100%;
            }

            .travel-detail-title {
              font-size: 21px;
            }

            .travel-detail-title-input {
              width: 100%;
              font-size: 20px;
            }

            .travel-detail-date {
              flex-wrap: wrap;
              font-size: 12px;
            }

            .travel-detail-date input {
              max-width: 135px;
            }

            .travel-detail-actions {
              width: 100%;
            }

            .travel-detail-actions button {
              flex: 1;
            }

            .travel-map-wrapper {
              height: 440px;
              min-height: 440px;
              border-radius: 10px;
            }

            .travel-map-toolbar {
              min-height: 49px;
              padding: 7px 8px;
              gap: 6px;
            }

            .travel-map-toolbar-title {
              font-size: 12px;
            }

            .travel-map-day-selector {
              max-width:
                calc(100% - 75px);
              gap: 4px;
            }

            .travel-map-day-button {
              padding:
                6px 9px;
              font-size: 11px;
            }

            .travel-weather {
              padding:
                10px 12px;
            }

            .travel-weather-title {
              font-size: 12px;
            }

            .travel-weather-text {
              font-size: 11px;
            }
          }

          @media (max-width: 480px) {

            .travel-detail {
              padding:
                10px
                8px
                30px;
            }

            .travel-detail-title {
              font-size: 19px;
            }

            .travel-detail-date {
              gap: 5px;
            }

            .travel-detail-date input {
              width: 125px;
              max-width: 125px;
            }

            .travel-map-wrapper {
              height: 390px;
              min-height: 390px;
              border-radius: 9px;
            }

            .travel-map-toolbar {
              min-height: 45px;
              padding:
                6px 7px;
            }

            .travel-map-toolbar-title {
              font-size: 11px;
            }

            .travel-map-day-selector {
              max-width:
                calc(100% - 65px);
            }

            .travel-map-day-button {
              padding:
                5px 8px;
              font-size: 10px;
            }

            .travel-day-header {
              padding:
                10px 11px;
            }

            .travel-day-title {
              font-size: 13px;
            }
          }
        `}
      </style>

      {/* ======================================================
          Header
          ====================================================== */}

      <div className="travel-detail-header">
        <div className="travel-detail-header-left">
          {/* 뒤로가기 */}
          <button
            type="button"
            className="travel-back-button"
            onClick={() => navigate("/plans")}
            aria-label="목록으로"
          >
            <ArrowLeft size={18} />
          </button>

          {/* 제목 / 날짜 */}
          <div className="travel-detail-title-area">
            {isEditing ? (
              <input
                className="travel-detail-title-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="여행 제목"
              />
            ) : (
              <h1 className="travel-detail-title">{plan.title}</h1>
            )}

            <div className="travel-detail-date">
              <CalendarDays size={14} />

              {isEditing ? (
                <>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => {
                      const value = e.target.value;

                      setEditStartDate(value);

                      if (editEndDate && value > editEndDate) {
                        setEditEndDate(value);
                      }
                    }}
                  />

                  <span>~</span>

                  <input
                    type="date"
                    value={editEndDate}
                    min={editStartDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                  />
                </>
              ) : (
                <>
                  <span>{plan.startDate}</span>

                  <span>~</span>

                  <span>{plan.endDate}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="travel-detail-actions">
          {isEditing ? (
            <>
              {/* 취소 */}
              <button
                type="button"
                onClick={handleCancelEdit}
                style={{
                  ...S.btnBase,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                }}
              >
                <X size={15} />
                취소
              </button>

              {/* 저장 */}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  ...S.btnBase,
                  border: "none",
                  background: isSaving ? "#93c5fd" : "#2563eb",
                  color: "#fff",
                  cursor: isSaving ? "default" : "pointer",
                }}
              >
                <Save size={15} />

                {isSaving ? "저장 중..." : "저장"}
              </button>
            </>
          ) : (
            <>
              {/* 편집 */}
              <button
                type="button"
                onClick={() => {
                  setIsEditing(true);

                  setSelectedPlaceForMap(null);
                }}
                style={{
                  ...S.btnBase,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                }}
              >
                <Pencil size={15} />
                편집
              </button>

              {/* 삭제 */}
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  ...S.btnBase,
                  border: "1px solid #fecaca",
                  background: "#fffafa",
                  color: "#dc2626",
                }}
              >
                <Trash2 size={15} />
                삭제
              </button>
            </>
          )}
        </div>
      </div>

      {/* ======================================================
          DnD Context
          ====================================================== */}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(event) => setActiveDragId(String(event.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* ====================================================
            Main Grid
            ==================================================== */}

        <div className="travel-detail-grid">
          {/* ==================================================
              MAP
              ================================================== */}

          <div className="travel-map-wrapper">
            {/* ------------------------------------------------
                지도 전용 DAY Toolbar

                기존처럼 지도 위에 absolute로 표시하지 않음
                ------------------------------------------------ */}

            <div className="travel-map-toolbar">
              <div className="travel-map-toolbar-title">
                <MapPin size={15} />

                <span>여행 지도</span>
              </div>

              <div className="travel-map-day-selector">
                {dayNumbers.map((dayNumber) => (
                  <button
                    key={dayNumber}
                    type="button"
                    className={`
                        travel-map-day-button
                        ${selectedDayForMap === dayNumber ? "selected" : ""}
                      `}
                    onClick={() => handleDaySelect(dayNumber)}
                  >
                    DAY {dayNumber}
                  </button>
                ))}
              </div>
            </div>

            {/* 실제 지도 */}

            <div className="travel-map-content">
              <KakaoMap
                items={selectedDayItems}
                selectedPlaceForMap={selectedPlaceForMap}
                onPlaceSelect={handlePlaceSelectFromMap}
                routePath={selectedRoutePath}
              />
            </div>
          </div>

          {/* ==================================================
              Schedule
              ================================================== */}

          <div>
            {/* =================================================
                날씨
                ================================================= */}

            <div className="travel-weather">
              <div className="travel-weather-inner">
                <div className="travel-weather-left">
                  <div className="travel-weather-icon">
                    <CloudSun size={20} />
                  </div>

                  <div
                    style={{
                      minWidth: 0,
                    }}
                  >
                    <div className="travel-weather-title">
                      DAY {selectedDayForMap} 날씨 정보
                    </div>

                    <div className="travel-weather-text">
                      {weatherLoading ? (
                        "날씨 정보를 불러오는 중..."
                      ) : weatherInfo ? (
                        <>
                          {weatherInfo.locationName} 기준 · 기온:{" "}
                          {weatherInfo.temperature} ({weatherInfo.description})
                        </>
                      ) : (
                        "등록된 장소가 없어 날씨 정보를 확인할 수 없습니다."
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* =================================================
                DAY별 일정
                ================================================= */}

            {dayNumbers.map((dayNumber) => {
              const dayItems = itemsByDay[dayNumber] || [];

              const schedule = scheduleByDay[dayNumber] || [];

              const selected = selectedDayForMap === dayNumber;

              return (
                <div key={dayNumber} className="travel-day-section">
                  {/* DAY Header */}

                  <div
                    className={`
                        travel-day-header
                        ${selected ? "selected" : ""}
                      `}
                    onClick={() => handleDaySelect(dayNumber)}
                  >
                    <div className="travel-day-title">
                      DAY {dayNumber} ({dayItems.length}개 장소)
                    </div>
                  </div>

                  {/* DAY Drop Area */}

                  <DayDropContainer
                    dayNumber={dayNumber}
                    itemIds={dayItems.map((item) => item._uiId)}
                    isEditing={isEditing}
                    onDaySelect={handleDaySelect}
                    isSelected={selected}
                  >
                    {schedule.map((scheduleItem, index) => (
                      <SortablePlanItem
                        key={scheduleItem.item._uiId}
                        item={scheduleItem.item}
                        index={index}
                        isEditing={isEditing}
                        onRemove={handleRemoveItem}
                        onStayChange={handleStayChange}
                        onSelect={handleItemSelect}
                        routeSection={scheduleItem.routeSection}
                        arrivalTime={scheduleItem.arrivalTime}
                        departureTime={scheduleItem.departureTime}
                      />
                    ))}
                  </DayDropContainer>
                </div>
              );
            })}
          </div>
        </div>

        {/* ====================================================
            Drag Overlay
            ==================================================== */}

        <DragOverlay>
          {activeDragItem ? (
            <div
              style={{
                width: "min(330px, 80vw)",
                background: "#fff",
                border: "2px solid #2563eb",
                borderRadius: 10,
                padding: "12px 14px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <GripVertical size={16} color="#2563eb" />

                <strong>{activeDragItem.placeName}</strong>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default PlanDetail;
