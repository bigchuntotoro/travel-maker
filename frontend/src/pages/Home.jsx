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

const DEFAULT_START_TIME = "09:00";
const STAY_OPTIONS = [30, 60, 90, 120, 150, 180, 240];

const S = {
  flexRow: { display: "flex", alignItems: "center" },
  flexBetween: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  btnBase: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 13px",
    borderRadius: 8,
    cursor: "pointer",
  },
  card: { border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" },
};

const createUiId = () =>
  `ui-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const normalizeItems = (items = []) =>
  [...items]
    .map((item, idx) => ({
      ...item,
      _uiId: item._uiId || createUiId(),
      dayNumber: Number(item.dayNumber || 1),
      visitOrder: Number(item.visitOrder ?? idx + 1),
      stayMinutes: Number(item.stayMinutes ?? 60),
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
    }))
    .sort((a, b) => a.dayNumber - b.dayNumber || a.visitOrder - b.visitOrder);

const normalizeVisitOrders = (items = []) => {
  const dayMap = new Map();
  items.forEach((item) => {
    const d = Number(item.dayNumber || 1);
    if (!dayMap.has(d)) dayMap.set(d, []);
    dayMap.get(d).push(item);
  });

  const result = [];
  [...dayMap.keys()]
    .sort((a, b) => a - b)
    .forEach((d) => {
      dayMap.get(d).forEach((item, idx) => {
        result.push({ ...item, dayNumber: d, visitOrder: idx + 1 });
      });
    });
  return result;
};

const groupItemsByDay = (items = []) => {
  const grouped = {};
  items.forEach((item) => {
    const d = Number(item.dayNumber || 1);
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(item);
  });
  Object.keys(grouped).forEach((d) =>
    grouped[d].sort((a, b) => (a.visitOrder || 0) - (b.visitOrder || 0)),
  );
  return grouped;
};

const formatDuration = (mins, isSec = false) => {
  const m = isSec ? Math.round((Number(mins) || 0) / 60) : Number(mins) || 0;
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60),
    remain = m % 60;
  return remain === 0 ? `${h}시간` : `${h}시간 ${remain}분`;
};

const formatDistance = (m) => {
  const d = Number(m) || 0;
  return d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
};

const timeToMins = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
};

const minsToTime = (m) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// 정렬 가능한 개별 일정 아이템 컴포넌트
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
  } = useSortable({ id: item._uiId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: isDragging ? "#eff6ff" : "#ffffff",
    border: isDragging ? "1px solid #2563eb" : "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "9px 10px",
    marginBottom: 8,
    boxShadow: isDragging
      ? "0 8px 20px rgba(37,99,235,0.15)"
      : "0 1px 3px rgba(0,0,0,0.05)",
  };

  return (
    <div ref={setNodeRef} style={style} onClick={() => onSelect?.(item)}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
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
        >
          <GripVertical size={16} />
        </button>
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
        <div style={{ flex: 1, minWidth: 0 }}>
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
            <span>{item.address || "주소 정보 없음"}</span>
          </div>
          <div style={{ ...S.flexRow, gap: 7, fontSize: 11 }}>
            {arrivalTime && (
              <span style={{ color: "#2563eb", fontWeight: 700 }}>
                {arrivalTime}
              </span>
            )}
            {departureTime && (
              <>
                <span style={{ color: "#9ca3af" }}>→</span>
                <span style={{ color: "#374151" }}>{departureTime}</span>
              </>
            )}
            <span style={{ color: "#6b7280" }}>
              체류 {formatDuration(item.stayMinutes)}
            </span>
          </div>
          {routeSection && (
            <div
              style={{
                ...S.flexRow,
                gap: 6,
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
                <span style={{ color: "#6b7280" }}>
                  · {formatDistance(routeSection.distance)}
                </span>
              )}
            </div>
          )}
          <div
            style={{ ...S.flexRow, gap: 6, marginTop: 8 }}
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
              }}
            >
              {STAY_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  체류 {formatDuration(m)}
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
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Day별 드롭 존 컨테이너
const DayDropContainer = ({
  dayNumber,
  children,
  itemIds,
  onDaySelect,
  isSelected,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayNumber}` });
  const bg = isOver ? "#eff6ff" : isSelected ? "#f8fbff" : "#f9fafb";
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
        background: bg,
        transition: "all 0.15s ease",
        cursor: "pointer",
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
            color: "#9ca3af",
            fontSize: 12,
            border: "1px dashed #d1d5db",
            borderRadius: 8,
            background: "#fff",
          }}
        >
          이곳으로 장소를 드래그하거나 지도에서 선택해 추가하세요
        </div>
      )}
    </div>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [items, setItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [routePathsByDay, setRoutePathsByDay] = useState({});
  const [routeSections, setRouteSections] = useState([]);
  const routeRequestIdRef = useRef(0);

  const [selectedDayForMap, setSelectedDayForMap] = useState(1);
  const [selectedPlaceForMap, setSelectedPlaceForMap] = useState(null);
  const [activeDragId, setActiveDragId] = useState(null);

  const [weatherInfo, setWeatherInfo] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleStartDateChange = (e) => {
    const newStartDate = e.target.value;
    setStartDate(newStartDate);
    if (endDate && newStartDate > endDate) {
      setEndDate(newStartDate);
    }
  };

  // Day 계산
  const dayNumbers = useMemo(() => {
    if (!startDate || !endDate) return [1];
    const diff = Math.floor(
      (new Date(endDate) - new Date(startDate)) / 86400000,
    );
    const count = Math.max(diff + 1, 1);
    const maxItemDay = Math.max(...items.map((i) => i.dayNumber || 1), 1);
    return Array.from({ length: Math.max(count, maxItemDay) }, (_, i) => i + 1);
  }, [startDate, endDate, items]);

  useEffect(() => {
    if (!dayNumbers.includes(selectedDayForMap)) {
      setSelectedDayForMap(dayNumbers[0] || 1);
    }
  }, [dayNumbers, selectedDayForMap]);

  const normalizedCurrentItems = useMemo(() => normalizeItems(items), [items]);
  const itemsByDay = useMemo(
    () => groupItemsByDay(normalizedCurrentItems),
    [normalizedCurrentItems],
  );
  const selectedDayItems = itemsByDay[selectedDayForMap] || [];
  const selectedRoutePath = routePathsByDay[selectedDayForMap] || [];

  // 도로 경로 추출 함수
  const extractRoutePath = (sections = []) => {
    const path = [];
    sections.forEach((sec) => {
      sec?.roads?.forEach((road) => {
        const vertexes = road?.vertexes || [];
        for (let i = 0; i < vertexes.length - 1; i += 2) {
          const lng = Number(vertexes[i]),
            lat = Number(vertexes[i + 1]);
          if (Number.isFinite(lat) && Number.isFinite(lng))
            path.push({ lat, lng });
        }
      });
    });
    return path;
  };

  // Day별 실제 도로 경로 조회
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
        if (requestId !== routeRequestIdRef.current) return;
        const dayItems = grouped[dayNumber] || [];

        if (dayItems.length <= 1) {
          newPaths[dayNumber] = [];
          continue;
        }

        const origin = {
          name: dayItems[0].placeName,
          x: Number(dayItems[0].longitude),
          y: Number(dayItems[0].latitude),
        };
        const destination = {
          name: dayItems[dayItems.length - 1].placeName,
          x: Number(dayItems[dayItems.length - 1].longitude),
          y: Number(dayItems[dayItems.length - 1].latitude),
        };
        const waypoints = dayItems.slice(1, -1).map((i) => ({
          name: i.placeName,
          x: Number(i.longitude),
          y: Number(i.latitude),
        }));

        const res = await axiosInstance.post("/api/plans/route", {
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

        const route = res?.data?.routes?.[0];
        if (!route) {
          newPaths[dayNumber] = [];
          continue;
        }

        const sections = route.sections || [];
        newPaths[dayNumber] = extractRoutePath(sections);

        sections.forEach((sec, idx) => {
          const fItem = dayItems[idx],
            tItem = dayItems[idx + 1];
          if (!fItem || !tItem) return;
          newSections.push({
            dayNumber,
            fromUiId: fItem._uiId,
            toUiId: tItem._uiId,
            from: fItem,
            to: tItem,
            duration: Number(sec.duration || 0),
            distance: Number(sec.distance || 0),
          });
        });
      }

      if (requestId !== routeRequestIdRef.current) return;
      setRouteSections(newSections);
      setRoutePathsByDay(newPaths);
    } catch (err) {
      if (requestId !== routeRequestIdRef.current) return;
      setRouteSections([]);
      setRoutePathsByDay({});
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => loadRoadRoutesByDay(normalizedCurrentItems),
      350,
    );
    return () => clearTimeout(timer);
  }, [normalizedCurrentItems, loadRoadRoutesByDay]);

  // 날씨 정보 조회 시뮬레이션
  const fetchWeatherForSelectedDay = useCallback(async (dayItems) => {
    if (!dayItems || dayItems.length === 0) {
      setWeatherInfo(null);
      return;
    }
    const targetPlace = dayItems[0];
    if (!targetPlace.latitude || !targetPlace.longitude) return;

    try {
      setWeatherLoading(true);
      setWeatherInfo({
        temperature: "22°C",
        description: "맑음",
        locationName: targetPlace.placeName || "해당 지역",
      });
    } catch (err) {
      setWeatherInfo(null);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeatherForSelectedDay(selectedDayItems);
  }, [selectedDayForMap, selectedDayItems, fetchWeatherForSelectedDay]);

  const handleDaySelect = (dNum) => {
    const day = Number(dNum);
    setSelectedDayForMap(day);
    const first = itemsByDay[day]?.[0];
    if (first) {
      setSelectedPlaceForMap({ lat: first.latitude, lng: first.longitude });
    }
  };

  // 지도 컴포넌트(KakaoMap)에서 장소 클릭 또는 검색 결과 선택 시 호출되는 콜백
  const handlePlaceSelectFromMap = (placeInfo) => {
    const lat = Number(placeInfo.latitude ?? placeInfo.lat);
    const lng = Number(placeInfo.longitude ?? placeInfo.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    // 주소 정보가 없고 좌표만 전달된 경우(지도 빈 곳 클릭 등), 카카오 Geocoder를 이용해 주소 변환 수행
    if (!placeInfo.address && window.kakao?.maps?.services) {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2Address(lng, lat, (result, status) => {
        let address = "";
        if (status === window.kakao.maps.services.Status.OK) {
          address =
            result[0].road_address?.address_name ||
            result[0].address?.address_name ||
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

  const addPlaceItem = (placeInfo) => {
    const newItem = {
      _uiId: createUiId(),
      dayNumber: selectedDayForMap,
      placeName: placeInfo.placeName || placeInfo.title || "선택된 장소",
      address: placeInfo.address || "",
      latitude: placeInfo.latitude,
      longitude: placeInfo.longitude,
      visitOrder: selectedDayItems.length + 1,
      stayMinutes: 60,
    };

    setItems((prev) => normalizeVisitOrders([...prev, newItem]));
    setSelectedPlaceForMap({
      lat: placeInfo.latitude,
      lng: placeInfo.longitude,
      placeName: newItem.placeName,
    });
  };

  // 드래그 앤 드롭 종료 처리
  const handleDragEnd = (e) => {
    const { active, over } = e;
    setActiveDragId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    setItems((prev) => {
      const itemsCopy = [...prev];
      const aIdx = itemsCopy.findIndex((i) => String(i._uiId) === activeId);
      if (aIdx === -1) return prev;
      const aItem = itemsCopy[aIdx];

      if (overId.startsWith("day-")) {
        const tDay = Number(overId.replace("day-", ""));
        if (Number(aItem.dayNumber) === tDay) return prev;
        return normalizeVisitOrders([
          ...itemsCopy.filter((i) => String(i._uiId) !== activeId),
          { ...aItem, dayNumber: tDay },
        ]);
      }

      const oIdx = itemsCopy.findIndex((i) => String(i._uiId) === overId);
      if (oIdx === -1) return prev;
      const tDay = Number(itemsCopy[oIdx].dayNumber || 1);
      const withoutActive = itemsCopy.filter(
        (i) => String(i._uiId) !== activeId,
      );
      const newTIdx = withoutActive.findIndex(
        (i) => String(i._uiId) === overId,
      );
      withoutActive.splice(newTIdx, 0, { ...aItem, dayNumber: tDay });
      return normalizeVisitOrders(withoutActive);
    });
  };

  // 일정표 시간 계산
  const scheduleByDay = useMemo(() => {
    const result = {};
    dayNumbers.forEach((dNum) => {
      const dayItems = itemsByDay[dNum] || [];
      let curMins = timeToMins(DEFAULT_START_TIME);
      result[dNum] = dayItems.map((item) => {
        let arrMins = curMins;
        const depMins = arrMins + Number(item.stayMinutes || 60);
        const section = routeSections.find(
          (s) => Number(s.dayNumber) === dNum && s.fromUiId === item._uiId,
        );
        curMins =
          depMins +
          (section ? Math.round(Number(section.duration || 0) / 60) : 0);
        return {
          item,
          arrivalTime: minsToTime(arrMins),
          departureTime: minsToTime(depMins),
          routeSection: section,
        };
      });
    });
    return result;
  }, [dayNumbers, itemsByDay, routeSections]);

  // 일정 저장 요청
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
      title,
      startDate,
      endDate,
      items: normalizeVisitOrders(items),
    };

    try {
      setIsSubmitting(true);
      const res = await createPlan(payload);
      alert(`성공적으로 저장되었습니다! (Plan ID: ${res.planId})`);
      navigate("/plans");
    } catch (err) {
      alert("일정 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeDragItem = activeDragId
    ? normalizedCurrentItems.find(
        (i) => String(i._uiId) === String(activeDragId),
      )
    : null;

  return (
    <div
      style={{ maxWidth: 1500, margin: "0 auto", padding: "25px 20px 50px" }}
    >
      {/* Header */}
      <header
        style={{
          ...S.flexBetween,
          marginBottom: 20,
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: 15,
        }}
      >
        <div style={{ ...S.flexRow, gap: 12 }}>
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
        <div style={{ ...S.flexRow, gap: 10 }}>
          <button
            onClick={() => navigate("/plans")}
            style={{
              ...S.btnBase,
              border: "1px solid #d1d5db",
              background: "#fff",
            }}
          >
            📋 내 일정 목록
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
            👤 {user.nickname || "여행가"}님
          </span>
          <button
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

      {/* Basic Info & Submit */}
      <div
        style={{
          ...S.card,
          padding: 16,
          marginBottom: 20,
          display: "flex",
          gap: 15,
          alignItems: "center",
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
            borderRadius: 8,
            fontSize: 14,
          }}
        />
        <div style={{ ...S.flexRow, gap: 8, flex: 1.5 }}>
          <CalendarDays size={16} color="#6b7280" />
          <input
            type="date"
            value={startDate}
            onChange={handleStartDateChange}
            style={{
              padding: "9px 10px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
            }}
          />
          <span>~</span>
          <input
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
          onClick={handleSubmitPlan}
          disabled={isSubmitting}
          style={{
            ...S.btnBase,
            border: "none",
            background: isSubmitting ? "#93c5fd" : "#2563eb",
            color: "#fff",
            fontWeight: 700,
            padding: "11px 22px",
          }}
        >
          <Plus size={16} />
          {isSubmitting ? "저장 중..." : "일정 저장"}
        </button>
      </div>

      {/* Main Content Layout (Map + Schedule) */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveDragId(String(e.active.id))}
        onDragEnd={handleDragEnd}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.85fr) minmax(320px, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* Map Area */}
          <div
            style={{
              position: "sticky",
              top: 15,
              height: 680,
              ...S.card,
              overflow: "hidden",
            }}
          >
            {/* Day Selector on Map */}
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 350,
                display: "flex",
                gap: 5,
                padding: 5,
                borderRadius: 9,
                background: "rgba(255,255,255,0.96)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              {dayNumbers.map((dNum) => (
                <button
                  key={dNum}
                  onClick={() => handleDaySelect(dNum)}
                  style={{
                    border: "none",
                    borderRadius: 7,
                    padding: "7px 10px",
                    background:
                      selectedDayForMap === dNum ? "#2563eb" : "#f3f4f6",
                    color: selectedDayForMap === dNum ? "#fff" : "#374151",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  DAY {dNum}
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

          {/* Schedule List Area */}
          <div>
            {/* Weather Widget */}
            <div
              style={{
                marginBottom: 16,
                padding: "12px 16px",
                background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
                border: "1px solid #bfdbfe",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ ...S.flexRow, gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
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
                <div>
                  <div
                    style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}
                  >
                    DAY {selectedDayForMap} 날씨 정보
                  </div>
                  <div style={{ fontSize: 12, color: "#4b5563" }}>
                    {weatherLoading
                      ? "날씨 정보를 불러오는 중..."
                      : weatherInfo
                        ? `${weatherInfo.locationName} 기준 · 기온: ${weatherInfo.temperature} (${weatherInfo.description})`
                        : "등록된 장소가 없어 날씨 정보를 확인할 수 없습니다."}
                  </div>
                </div>
              </div>
            </div>

            {/* Day Sections */}
            {dayNumbers.map((dNum) => {
              const dayItems = itemsByDay[dNum] || [];
              const schedule = scheduleByDay[dNum] || [];
              return (
                <div key={dNum} style={{ marginBottom: 14 }}>
                  <div
                    onClick={() => handleDaySelect(dNum)}
                    style={{
                      ...S.flexBetween,
                      padding: "11px 13px",
                      borderRadius: "10px 10px 0 0",
                      background:
                        selectedDayForMap === dNum ? "#eff6ff" : "#f3f4f6",
                      border:
                        selectedDayForMap === dNum
                          ? "1px solid #bfdbfe"
                          : "1px solid #e5e7eb",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color:
                          selectedDayForMap === dNum ? "#2563eb" : "#111827",
                      }}
                    >
                      DAY {dNum} ({dayItems.length}개 장소)
                    </div>
                  </div>
                  <DayDropContainer
                    dayNumber={dNum}
                    itemIds={dayItems.map((i) => i._uiId)}
                    onDaySelect={handleDaySelect}
                    isSelected={selectedDayForMap === dNum}
                  >
                    {schedule.map((sItem, idx) => (
                      <SortablePlanItem
                        key={sItem.item._uiId}
                        item={sItem.item}
                        index={idx}
                        onRemove={(id) =>
                          setItems((prev) => prev.filter((i) => i._uiId !== id))
                        }
                        onStayChange={(id, m) =>
                          setItems((prev) =>
                            prev.map((i) =>
                              i._uiId === id ? { ...i, stayMinutes: m } : i,
                            ),
                          )
                        }
                        onSelect={(i) => {
                          setSelectedDayForMap(Number(i.dayNumber || 1));
                          setSelectedPlaceForMap({
                            lat: i.latitude,
                            lng: i.longitude,
                          });
                        }}
                        routeSection={sItem.routeSection}
                        arrivalTime={sItem.arrivalTime}
                        departureTime={sItem.departureTime}
                      />
                    ))}
                  </DayDropContainer>
                </div>
              );
            })}
          </div>
        </div>
        <DragOverlay>
          {activeDragItem ? (
            <div
              style={{
                width: 330,
                background: "#fff",
                border: "2px solid #2563eb",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <GripVertical size={16} color="#2563eb" />
              <strong>{activeDragItem.placeName}</strong>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default Home;
