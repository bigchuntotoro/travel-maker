import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { createPlan } from "../api/travelApi";
import KakaoMap from "../components/map/KakaoMap";

import {
  CalendarDays,
  Car,
  Clock3,
  GripVertical,
  MapPin,
  Trash2,
  CloudSun,
  Plus,
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

/* =========================================================
   기본 설정
========================================================= */

const DEFAULT_START_TIME = "09:00";

const STAY_OPTIONS = [30, 60, 90, 120, 150, 180, 240];

/* =========================================================
   공통 스타일
========================================================= */

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
    whiteSpace: "nowrap",
  },

  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fff",
  },
};

/* =========================================================
   유틸
========================================================= */

const createUiId = () =>
  `ui-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * 좌표 안전 변환
 */
const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

/**
 * 일정 정규화
 */
const normalizeItems = (items = []) =>
  [...items]
    .map((item, idx) => ({
      ...item,

      _uiId: item._uiId || createUiId(),

      dayNumber: Number(item.dayNumber || 1),

      visitOrder: Number(item.visitOrder ?? idx + 1),

      stayMinutes: Number(item.stayMinutes ?? 60),

      latitude: toNumber(item.latitude),

      longitude: toNumber(item.longitude),
    }))

    .sort((a, b) => a.dayNumber - b.dayNumber || a.visitOrder - b.visitOrder);

/**
 * DAY별 방문 순서 재정렬
 */
const normalizeVisitOrders = (items = []) => {
  const dayMap = new Map();

  items.forEach((item) => {
    const day = Number(item.dayNumber || 1);

    if (!dayMap.has(day)) {
      dayMap.set(day, []);
    }

    dayMap.get(day).push(item);
  });

  const result = [];

  [...dayMap.keys()]
    .sort((a, b) => a - b)
    .forEach((day) => {
      dayMap.get(day).forEach((item, index) => {
        result.push({
          ...item,
          dayNumber: day,
          visitOrder: index + 1,
        });
      });
    });

  return result;
};

/**
 * DAY별 그룹
 */
const groupItemsByDay = (items = []) => {
  const grouped = {};

  items.forEach((item) => {
    const day = Number(item.dayNumber || 1);

    if (!grouped[day]) {
      grouped[day] = [];
    }

    grouped[day].push(item);
  });

  Object.keys(grouped).forEach((day) => {
    grouped[day].sort((a, b) => (a.visitOrder || 0) - (b.visitOrder || 0));
  });

  return grouped;
};

/**
 * 시간 표시
 */
const formatDuration = (mins, isSec = false) => {
  const minutes = isSec
    ? Math.round((Number(mins) || 0) / 60)
    : Number(mins) || 0;

  if (minutes < 60) {
    return `${minutes}분`;
  }

  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;

  return remain === 0 ? `${hours}시간` : `${hours}시간 ${remain}분`;
};

/**
 * 거리 표시
 */
const formatDistance = (meter) => {
  const distance = Number(meter) || 0;

  if (distance < 1000) {
    return `${Math.round(distance)}m`;
  }

  return `${(distance / 1000).toFixed(1)}km`;
};

/**
 * HH:mm → 분
 */
const timeToMins = (time) => {
  if (!time) {
    return 0;
  }

  const [hour, minute] = String(time).split(":").map(Number);

  return hour * 60 + minute;
};

/**
 * 분 → HH:mm
 */
const minsToTime = (minutes) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;

/* =========================================================
   정렬 가능한 일정 카드
========================================================= */

const SortablePlanItem = ({
  item,
  index,
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

    touchAction: "manipulation",
  };

  return (
    <div ref={setNodeRef} style={style} onClick={() => onSelect?.(item)}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          minWidth: 0,
        }}
      >
        {/* Drag 버튼 */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="일정 이동"
          style={{
            width: 28,
            height: 28,
            minWidth: 28,
            borderRadius: "50%",
            border: "none",
            background: "#eff6ff",
            color: "#2563eb",
            cursor: "grab",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            touchAction: "none",
          }}
        >
          <GripVertical size={16} />
        </button>

        {/* 순번 */}
        <div
          style={{
            width: 28,
            height: 28,
            minWidth: 28,
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
              display: "flex",
              alignItems: "flex-start",
              gap: 5,
              color: "#6b7280",
              fontSize: 12,
              marginBottom: 5,
              lineHeight: 1.4,
              minWidth: 0,
            }}
          >
            <MapPin
              size={13}
              style={{
                flexShrink: 0,
                marginTop: 1,
              }}
            />

            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {item.address || "주소 정보 없음"}
            </span>
          </div>

          {/* 시간 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 6,
              fontSize: 11,
              lineHeight: 1.5,
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
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 5,
                marginTop: 5,
                color: "#059669",
                fontSize: 11,
                fontWeight: 600,
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

          {/* 체류시간 / 삭제 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Clock3 size={13} color="#6b7280" />

            <select
              value={Number(item.stayMinutes || 60)}
              onChange={(e) => onStayChange(item._uiId, Number(e.target.value))}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 6,
                padding: "4px 6px",
                fontSize: 11,
                background: "#fff",
                maxWidth: "calc(100% - 45px)",
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
              aria-label="장소 삭제"
              style={{
                marginLeft: "auto",
                border: "none",
                background: "transparent",
                color: "#ef4444",
                cursor: "pointer",
                padding: 5,
                flexShrink: 0,
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   DAY Drop Container
========================================================= */

const DayDropContainer = ({
  dayNumber,
  children,
  itemIds,
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
        minWidth: 0,
      }}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>

      {itemIds.length === 0 && (
        <div
          style={{
            minHeight: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            color: "#9ca3af",
            fontSize: 12,
            border: "1px dashed #d1d5db",
            borderRadius: 8,
            background: "#fff",
            padding: 12,
          }}
        >
          이곳으로 장소를 드래그하거나
          <br />
          지도에서 선택해 추가하세요
        </div>
      )}
    </div>
  );
};

/* =========================================================
   Home
========================================================= */

const Home = () => {
  const navigate = useNavigate();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  /* -------------------------------------------------------
     기본 상태
  ------------------------------------------------------- */

  const [title, setTitle] = useState("");

  const [startDate, setStartDate] = useState("");

  const [endDate, setEndDate] = useState("");

  const [items, setItems] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  /* -------------------------------------------------------
     지도 / 경로
  ------------------------------------------------------- */

  const [routePathsByDay, setRoutePathsByDay] = useState({});

  const [routeSections, setRouteSections] = useState([]);

  const routeRequestIdRef = useRef(0);

  const [selectedDayForMap, setSelectedDayForMap] = useState(1);

  const [selectedPlaceForMap, setSelectedPlaceForMap] = useState(null);

  /* -------------------------------------------------------
     DnD
  ------------------------------------------------------- */

  const [activeDragId, setActiveDragId] = useState(null);

  /* -------------------------------------------------------
     날씨
  ------------------------------------------------------- */

  const [weatherInfo, setWeatherInfo] = useState(null);

  const [weatherLoading, setWeatherLoading] = useState(false);

  /* -------------------------------------------------------
     DnD 센서
  ------------------------------------------------------- */

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

  /* =======================================================
     로그아웃
  ======================================================= */

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  /* =======================================================
     날짜
  ======================================================= */

  const handleStartDateChange = (e) => {
    const newStartDate = e.target.value;

    setStartDate(newStartDate);

    if (endDate && newStartDate > endDate) {
      setEndDate(newStartDate);
    }
  };

  /* =======================================================
     DAY 계산
  ======================================================= */

  const dayNumbers = useMemo(() => {
    if (!startDate || !endDate) {
      return [1];
    }

    const start = new Date(`${startDate}T00:00:00`);

    const end = new Date(`${endDate}T00:00:00`);

    const diff = Math.floor((end - start) / 86400000);

    const count = Math.max(diff + 1, 1);

    const maxItemDay = Math.max(
      ...items.map((item) => Number(item.dayNumber || 1)),
      1,
    );

    return Array.from(
      {
        length: Math.max(count, maxItemDay),
      },
      (_, index) => index + 1,
    );
  }, [startDate, endDate, items]);

  /* =======================================================
     선택 DAY 보정
  ======================================================= */

  useEffect(() => {
    if (!dayNumbers.includes(selectedDayForMap)) {
      setSelectedDayForMap(dayNumbers[0] || 1);
    }
  }, [dayNumbers, selectedDayForMap]);

  /* =======================================================
     일정 정규화
  ======================================================= */

  const normalizedCurrentItems = useMemo(() => normalizeItems(items), [items]);

  const itemsByDay = useMemo(
    () => groupItemsByDay(normalizedCurrentItems),
    [normalizedCurrentItems],
  );

  const selectedDayItems = itemsByDay[selectedDayForMap] || [];

  const selectedRoutePath = routePathsByDay[selectedDayForMap] || [];

  /* =======================================================
     도로 경로 추출
  ======================================================= */

  const extractRoutePath = (sections = []) => {
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
  };

  /* =======================================================
     DAY별 도로 경로 조회
  ======================================================= */

  const loadRoadRoutesByDay = useCallback(async (currentItems) => {
    const requestId = ++routeRequestIdRef.current;

    const grouped = groupItemsByDay(currentItems);

    try {
      const days = Object.keys(grouped)
        .map(Number)
        .sort((a, b) => a - b);

      const newSections = [];
      const newPaths = {};

      for (const dayNumber of days) {
        if (requestId !== routeRequestIdRef.current) {
          return;
        }

        const dayItems = grouped[dayNumber] || [];

        if (dayItems.length <= 1) {
          newPaths[dayNumber] = [];

          continue;
        }

        const first = dayItems[0];

        const last = dayItems[dayItems.length - 1];

        if (
          !Number.isFinite(Number(first.latitude)) ||
          !Number.isFinite(Number(first.longitude)) ||
          !Number.isFinite(Number(last.latitude)) ||
          !Number.isFinite(Number(last.longitude))
        ) {
          newPaths[dayNumber] = [];

          continue;
        }

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

        const waypoints = dayItems
          .slice(1, -1)
          .filter(
            (item) =>
              Number.isFinite(Number(item.latitude)) &&
              Number.isFinite(Number(item.longitude)),
          )
          .map((item) => ({
            name: item.placeName || "경유지",

            x: Number(item.longitude),

            y: Number(item.latitude),
          }));

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
          });
        });
      }

      if (requestId !== routeRequestIdRef.current) {
        return;
      }

      setRouteSections(newSections);

      setRoutePathsByDay(newPaths);
    } catch (error) {
      console.error("도로 경로 조회 실패:", error);

      if (requestId !== routeRequestIdRef.current) {
        return;
      }

      setRouteSections([]);
      setRoutePathsByDay({});
    }
  }, []);

  /* =======================================================
     일정 변경 후 경로 재조회
  ======================================================= */

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRoadRoutesByDay(normalizedCurrentItems);
    }, 350);

    return () => clearTimeout(timer);
  }, [normalizedCurrentItems, loadRoadRoutesByDay]);

  /* =======================================================
     날씨
  ======================================================= */

  const fetchWeatherForSelectedDay = useCallback(async (dayItems) => {
    if (!dayItems || dayItems.length === 0) {
      setWeatherInfo(null);
      return;
    }

    const targetPlace = dayItems[0];

    if (
      !Number.isFinite(Number(targetPlace.latitude)) ||
      !Number.isFinite(Number(targetPlace.longitude))
    ) {
      setWeatherInfo(null);
      return;
    }

    try {
      setWeatherLoading(true);

      /*
       * 현재는 테스트용 날씨 정보입니다.
       * 추후 OpenWeather / 기상청 API 연결 가능
       */
      setWeatherInfo({
        temperature: "22°C",
        description: "맑음",
        locationName: targetPlace.placeName || "해당 지역",
      });
    } catch (error) {
      console.error(error);

      setWeatherInfo(null);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeatherForSelectedDay(selectedDayItems);
  }, [selectedDayForMap, selectedDayItems, fetchWeatherForSelectedDay]);

  /* =======================================================
     DAY 선택
  ======================================================= */

  const handleDaySelect = (dayNumber) => {
    const day = Number(dayNumber);

    setSelectedDayForMap(day);

    const first = itemsByDay[day]?.[0];

    if (first) {
      setSelectedPlaceForMap({
        lat: Number(first.latitude),

        lng: Number(first.longitude),

        placeName: first.placeName,
      });
    }
  };

  /* =======================================================
     지도에서 장소 선택
  ======================================================= */

  const handlePlaceSelectFromMap = (placeInfo) => {
    if (!placeInfo) {
      return;
    }

    const lat = Number(placeInfo.latitude ?? placeInfo.lat);

    const lng = Number(placeInfo.longitude ?? placeInfo.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    /*
     * 주소가 없는 경우
     * Kakao Geocoder 사용
     */
    if (!placeInfo.address && window.kakao?.maps?.services) {
      const geocoder = new window.kakao.maps.services.Geocoder();

      geocoder.coord2Address(lng, lat, (result, status) => {
        let address = "";

        if (status === window.kakao.maps.services.Status.OK) {
          address =
            result[0]?.road_address?.address_name ||
            result[0]?.address?.address_name ||
            "";
        }

        addPlaceItem({
          ...placeInfo,
          latitude: lat,
          longitude: lng,
          address,
        });
      });
    } else {
      addPlaceItem({
        ...placeInfo,
        latitude: lat,
        longitude: lng,
      });
    }
  };

  /* =======================================================
     장소 추가
  ======================================================= */

  const addPlaceItem = (placeInfo) => {
    const newItem = {
      _uiId: createUiId(),

      dayNumber: selectedDayForMap,

      placeName: placeInfo.placeName || placeInfo.title || "선택된 장소",

      address: placeInfo.address || "",

      latitude: Number(placeInfo.latitude),

      longitude: Number(placeInfo.longitude),

      visitOrder: selectedDayItems.length + 1,

      stayMinutes: 60,
    };

    setItems((prev) => normalizeVisitOrders([...prev, newItem]));

    setSelectedPlaceForMap({
      lat: Number(placeInfo.latitude),

      lng: Number(placeInfo.longitude),

      placeName: newItem.placeName,
    });
  };

  /* =======================================================
     장소 삭제
  ======================================================= */

  const handleRemoveItem = (uiId) => {
    setItems((prev) =>
      normalizeVisitOrders(prev.filter((item) => item._uiId !== uiId)),
    );

    if (selectedPlaceForMap && selectedPlaceForMap.uiId === uiId) {
      setSelectedPlaceForMap(null);
    }
  };

  /* =======================================================
     체류시간 변경
  ======================================================= */

  const handleStayChange = (uiId, minutes) => {
    setItems((prev) =>
      prev.map((item) =>
        item._uiId === uiId
          ? {
              ...item,
              stayMinutes: minutes,
            }
          : item,
      ),
    );
  };

  /* =======================================================
     Drag Start
  ======================================================= */

  const handleDragStart = (event) => {
    setActiveDragId(String(event.active.id));
  };

  /* =======================================================
     Drag Cancel
  ======================================================= */

  const handleDragCancel = () => {
    setActiveDragId(null);
  };

  /* =======================================================
     Drag End
  ======================================================= */

  const handleDragEnd = (event) => {
    const { active, over } = event;

    setActiveDragId(null);

    if (!over) {
      return;
    }

    const activeId = String(active.id);

    const overId = String(over.id);

    setItems((prev) => {
      const current = [...prev];

      const activeIndex = current.findIndex(
        (item) => String(item._uiId) === activeId,
      );

      if (activeIndex === -1) {
        return prev;
      }

      const activeItem = current[activeIndex];

      /* ---------------------------------------------------
         DAY 빈 영역으로 이동
      --------------------------------------------------- */

      if (overId.startsWith("day-")) {
        const targetDay = Number(overId.replace("day-", ""));

        const remaining = current.filter(
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

      /* ---------------------------------------------------
         다른 일정 위로 이동
      --------------------------------------------------- */

      const overIndex = current.findIndex(
        (item) => String(item._uiId) === overId,
      );

      if (overIndex === -1) {
        return prev;
      }

      const targetItem = current[overIndex];

      const targetDay = Number(targetItem.dayNumber || 1);

      const remaining = current.filter(
        (item) => String(item._uiId) !== activeId,
      );

      const targetIndex = remaining.findIndex(
        (item) => String(item._uiId) === overId,
      );

      if (targetIndex === -1) {
        return prev;
      }

      remaining.splice(targetIndex, 0, {
        ...activeItem,
        dayNumber: targetDay,
      });

      return normalizeVisitOrders(remaining);
    });
  };

  /* =======================================================
     일정 시간 계산
  ======================================================= */

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
          (sectionItem) =>
            Number(sectionItem.dayNumber) === dayNumber &&
            sectionItem.fromUiId === item._uiId,
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

  /* =======================================================
     일정 저장
  ======================================================= */

  const handleSubmitPlan = async () => {
    if (!title.trim()) {
      alert("여행 제목을 입력해 주세요.");
      return;
    }

    if (!startDate || !endDate) {
      alert("여행 기간을 설정해 주세요.");
      return;
    }

    if (startDate > endDate) {
      alert("여행 종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }

    if (items.length === 0) {
      alert("최소 하나 이상의 장소를 추가해 주세요.");
      return;
    }

    if (!user.userId) {
      alert("로그인 정보가 없습니다.");

      navigate("/login");
      return;
    }

    const payload = {
      userId: user.userId,

      title: title.trim(),

      startDate,

      endDate,

      items: normalizeVisitOrders(items),
    };

    try {
      setIsSubmitting(true);

      const response = await createPlan(payload);

      alert(`성공적으로 저장되었습니다! (Plan ID: ${response.planId})`);

      navigate("/plans");
    } catch (error) {
      console.error("일정 저장 실패:", error);

      alert("일정 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* =======================================================
     Drag Overlay
  ======================================================= */

  const activeDragItem = activeDragId
    ? normalizedCurrentItems.find(
        (item) => String(item._uiId) === String(activeDragId),
      )
    : null;

  /* =======================================================
     Render
  ======================================================= */

  return (
    <>
      {/* ===================================================
          반응형 CSS
      =================================================== */}

      <style>
        {`
          * {
            box-sizing: border-box;
          }

          .travel-home {
            width: 100%;
            max-width: 1500px;
            margin: 0 auto;
            padding: 25px 20px 50px;
          }

          .travel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            margin-bottom: 20px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 15px;
          }

          .travel-header-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
          }

          .travel-basic-info {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
            padding: 16px;
          }

          .travel-title-input {
            flex: 2;
            min-width: 200px;
          }

          .travel-date-area {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1.5;
          }

          .travel-date-input {
            min-width: 0;
            width: 100%;
          }

          .travel-main-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 1.85fr)
              minmax(320px, 1fr);
            gap: 20px;
            align-items: start;
          }

          .travel-map-wrapper {
            position: sticky;
            top: 15px;
            height: 680px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #fff;
            overflow: hidden;
          }

          .travel-map-day-selector {
            position: absolute;
            top: 12px;
            right: 12px;
            z-index: 350;

            display: flex;
            gap: 5px;

            max-width: calc(100% - 24px);

            padding: 5px;
            border-radius: 9px;

            background:
              rgba(255,255,255,0.96);

            box-shadow:
              0 2px 8px
              rgba(0,0,0,0.15);

            overflow-x: auto;
            scrollbar-width: thin;
          }

          .travel-map-day-selector button {
            flex-shrink: 0;
          }

          .travel-weather {
            margin-bottom: 16px;
            padding: 12px 16px;

            background:
              linear-gradient(
                135deg,
                #eff6ff 0%,
                #dbeafe 100%
              );

            border: 1px solid #bfdbfe;
            border-radius: 12px;

            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .travel-weather-content {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .travel-weather-text {
            min-width: 0;
          }

          .travel-day-section {
            margin-bottom: 14px;
          }

          .travel-day-header {
            display: flex;
            align-items: center;
            justify-content: space-between;

            padding: 11px 13px;

            border-radius:
              10px 10px 0 0;

            cursor: pointer;
          }

          .travel-mobile-break {
            display: none;
          }

          @media (max-width: 1000px) {
            .travel-main-grid {
              grid-template-columns:
                minmax(0, 1.45fr)
                minmax(280px, 1fr);
              gap: 15px;
            }

            .travel-map-wrapper {
              height: 600px;
            }

            .travel-basic-info {
              flex-wrap: wrap;
            }

            .travel-title-input {
              flex: 1 1 100%;
            }

            .travel-date-area {
              flex: 1 1 auto;
            }
          }

          @media (max-width: 768px) {
            .travel-home {
              padding:
                12px
                10px
                30px;
            }

            .travel-header {
              align-items: flex-start;
              flex-direction: column;
              padding-bottom: 12px;
              gap: 12px;
            }

            .travel-header h1 {
              font-size: 20px !important;
              line-height: 1.3;
            }

            .travel-header-actions {
              width: 100%;
              gap: 6px;
            }

            .travel-header-actions button {
              flex: 1;
            }

            .travel-header-actions span {
              width: 100%;
              font-size: 13px !important;
            }

            .travel-basic-info {
              flex-direction: column;
              align-items: stretch;
              gap: 10px;
              padding: 12px;
            }

            .travel-title-input {
              width: 100%;
              flex: none;
            }

            .travel-date-area {
              width: 100%;
              flex: none;
              display: grid;
              grid-template-columns:
                20px
                minmax(0, 1fr)
                15px
                minmax(0, 1fr);
              gap: 6px;
            }

            .travel-date-input {
              width: 100%;
              min-width: 0;
            }

            .travel-basic-info > button {
              width: 100%;
            }

            .travel-main-grid {
              grid-template-columns: 1fr;
              gap: 14px;
            }

            .travel-map-wrapper {
              position: relative;
              top: auto;
              width: 100%;
              height: 400px;
              min-height: 400px;
            }

            .travel-map-day-selector {
              left: 10px;
              right: 10px;
              top: 10px;
              max-width: none;
              justify-content: flex-start;
            }

            .travel-weather {
              margin-bottom: 12px;
              padding: 10px 12px;
            }

            .travel-weather-content {
              align-items: flex-start;
            }

            .travel-weather-text {
              overflow: hidden;
            }

            .travel-weather-text > div:last-child {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .travel-day-header {
              padding: 10px 11px;
            }

            .travel-day-section {
              margin-bottom: 10px;
            }

            .travel-mobile-break {
              display: block;
            }
          }

          @media (max-width: 480px) {
            .travel-home {
              padding:
                8px
                7px
                25px;
            }

            .travel-header h1 {
              font-size: 18px !important;
            }

            .travel-header-actions {
              display: grid;
              grid-template-columns:
                1fr
                1fr;
            }

            .travel-header-actions span {
              grid-column:
                1 / -1;
            }

            .travel-map-wrapper {
              height: 360px;
              min-height: 360px;
              border-radius: 10px;
            }

            .travel-map-day-selector {
              top: 7px;
              left: 7px;
              right: 7px;
            }

            .travel-map-day-selector button {
              padding:
                6px
                9px;
              font-size: 11px;
            }

            .travel-weather {
              padding: 9px 10px;
            }

            .travel-weather-text > div:first-child {
              font-size: 12px !important;
            }

            .travel-weather-text > div:last-child {
              font-size: 11px !important;
            }

            .travel-day-header {
              font-size: 13px;
            }
          }
        `}
      </style>

      <div className="travel-home">
        {/* =================================================
            Header
        ================================================= */}

        <header className="travel-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <h1
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: "#111827",
                margin: 0,
              }}
            >
              ✈️ 새 여행 일정 만들기
            </h1>
          </div>

          <div className="travel-header-actions">
            <button
              type="button"
              onClick={() => navigate("/plans")}
              style={{
                ...S.btnBase,
                border: "1px solid #d1d5db",
                background: "#fff",
              }}
            >
              📋 내 일정 목록
            </button>

            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#374151",
              }}
            >
              👤 {user.nickname || "여행가"}님
            </span>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                ...S.btnBase,
                border: "1px solid #d1d5db",
                background: "#f3f4f6",
              }}
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* =================================================
            기본 정보
        ================================================= */}

        <div
          className="travel-basic-info"
          style={{
            ...S.card,
          }}
        >
          <input
            className="travel-title-input"
            type="text"
            placeholder="여행 제목 (예: 제주도 2박 3일 힐링 여행)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              padding: "10px 14px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 14,
              outline: "none",
            }}
          />

          <div className="travel-date-area">
            <CalendarDays size={16} color="#6b7280" />

            <input
              className="travel-date-input"
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              style={{
                padding: "9px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
              }}
            />

            <span
              style={{
                textAlign: "center",
              }}
            >
              ~
            </span>

            <input
              className="travel-date-input"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={!startDate}
              style={{
                padding: "9px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleSubmitPlan}
            disabled={isSubmitting}
            style={{
              ...S.btnBase,

              border: "none",

              background: isSubmitting ? "#93c5fd" : "#2563eb",

              color: "#fff",

              fontWeight: 700,

              padding: "11px 22px",

              minHeight: 42,
            }}
          >
            <Plus size={16} />

            {isSubmitting ? "저장 중..." : "일정 저장"}
          </button>
        </div>

        {/* =================================================
            DnD
        ================================================= */}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <div className="travel-main-grid">
            {/* =============================================
                지도
            ============================================= */}

            <div className="travel-map-wrapper">
              {/* DAY 선택 */}
              <div className="travel-map-day-selector">
                {dayNumbers.map((dayNumber) => (
                  <button
                    key={dayNumber}
                    type="button"
                    onClick={() => handleDaySelect(dayNumber)}
                    style={{
                      border: "none",
                      borderRadius: 7,
                      padding: "7px 10px",

                      background:
                        selectedDayForMap === dayNumber ? "#2563eb" : "#f3f4f6",

                      color:
                        selectedDayForMap === dayNumber ? "#fff" : "#374151",

                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    DAY {dayNumber}
                  </button>
                ))}
              </div>

              <KakaoMap
                items={selectedDayItems}
                selectedPlaceForMap={selectedPlaceForMap}
                onPlaceSelect={handlePlaceSelectFromMap}
                routePath={selectedRoutePath}
              />
            </div>

            {/* =============================================
                일정
            ============================================= */}

            <div>
              {/* 날씨 */}
              <div className="travel-weather">
                <div className="travel-weather-content">
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      minWidth: 36,
                      borderRadius: "50%",
                      background: "#2563eb",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CloudSun size={20} />
                  </div>

                  <div className="travel-weather-text">
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e40af",
                      }}
                    >
                      DAY {selectedDayForMap} 날씨 정보
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: "#4b5563",
                        marginTop: 2,
                      }}
                    >
                      {weatherLoading
                        ? "날씨 정보를 불러오는 중..."
                        : weatherInfo
                          ? `${weatherInfo.locationName} 기준 · 기온: ${weatherInfo.temperature} (${weatherInfo.description})`
                          : "등록된 장소가 없어 날씨 정보를 확인할 수 없습니다."}
                    </div>
                  </div>
                </div>
              </div>

              {/* DAY 목록 */}
              {dayNumbers.map((dayNumber) => {
                const dayItems = itemsByDay[dayNumber] || [];

                const schedule = scheduleByDay[dayNumber] || [];

                return (
                  <div key={dayNumber} className="travel-day-section">
                    {/* DAY Header */}
                    <div
                      className="travel-day-header"
                      onClick={() => handleDaySelect(dayNumber)}
                      style={{
                        background:
                          selectedDayForMap === dayNumber
                            ? "#eff6ff"
                            : "#f3f4f6",

                        border:
                          selectedDayForMap === dayNumber
                            ? "1px solid #bfdbfe"
                            : "1px solid #e5e7eb",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color:
                            selectedDayForMap === dayNumber
                              ? "#2563eb"
                              : "#111827",
                        }}
                      >
                        DAY {dayNumber} ({dayItems.length}개 장소)
                      </div>
                    </div>

                    {/* Drop 영역 */}
                    <DayDropContainer
                      dayNumber={dayNumber}
                      itemIds={dayItems.map((item) => item._uiId)}
                      onDaySelect={handleDaySelect}
                      isSelected={selectedDayForMap === dayNumber}
                    >
                      {schedule.map((scheduleItem, index) => (
                        <SortablePlanItem
                          key={scheduleItem.item._uiId}
                          item={scheduleItem.item}
                          index={index}
                          onRemove={handleRemoveItem}
                          onStayChange={handleStayChange}
                          onSelect={(item) => {
                            setSelectedDayForMap(Number(item.dayNumber || 1));

                            setSelectedPlaceForMap({
                              lat: Number(item.latitude),

                              lng: Number(item.longitude),

                              placeName: item.placeName,
                            });
                          }}
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

          {/* =================================================
              Drag Overlay
          ================================================= */}

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
    </>
  );
};

export default Home;
