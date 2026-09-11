// ============================================================
// PlanDetail.jsx 전체 수정 코드 (날씨 정보 기능 추가)
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
  GripVertical,
  MapPin,
  Pencil,
  Save,
  Trash2,
  X,
  CloudSun, // 날씨 아이콘 추가
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
          {isEditing && (
            <div
              style={{ ...S.flexRow, gap: 6, marginTop: 8 }}
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
          )}
        </div>
      </div>
    </div>
  );
};

const DayDropContainer = ({
  dayNumber,
  children,
  itemIds,
  isEditing,
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

const PlanDetail = () => {
  const { planId } = useParams();
  const navigate = useNavigate();

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editItems, setEditItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const [routePathsByDay, setRoutePathsByDay] = useState({});
  const [routeSections, setRouteSections] = useState([]);
  const routeRequestIdRef = useRef(0);

  const [selectedDayForMap, setSelectedDayForMap] = useState(1);
  const [selectedPlaceForMap, setSelectedPlaceForMap] = useState(null);
  const [activeDragId, setActiveDragId] = useState(null);

  // 날씨 정보 상태 추가
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const initEditState = useCallback((data) => {
    const items = normalizeItems(data?.items || []);
    setEditTitle(data?.title || "");
    setEditStartDate(data?.startDate || "");
    setEditEndDate(data?.endDate || "");
    setEditItems(items);
    setSelectedDayForMap(
      items.length > 0 ? Number(items[0].dayNumber || 1) : 1,
    );
  }, []);

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

  const loadRoadRoutesByDay = useCallback(async (items) => {
    const requestId = ++routeRequestIdRef.current;
    const grouped = groupItemsByDay(items);

    try {
      const dayNumbers = Object.keys(grouped)
        .map(Number)
        .sort((a, b) => a - b);
      const newSections = [],
        newPaths = {};

      for (const dayNumber of dayNumbers) {
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
          const fIdx = idx,
            tIdx = fIdx + 1;
          const fItem = dayItems[fIdx],
            tItem = dayItems[tIdx];
          if (!fItem || !tItem) return;
          newSections.push({
            dayNumber,
            fromUiId: fItem._uiId,
            toUiId: tItem._uiId,
            from: fItem,
            to: tItem,
            duration: Number(sec.duration || 0),
            distance: Number(sec.distance || 0),
            isCurrentLocation: false,
          });
        });
      }

      if (requestId !== routeRequestIdRef.current) return;
      setRouteSections(newSections);
      setRoutePathsByDay(newPaths);
    } catch {
      if (requestId !== routeRequestIdRef.current) return;
      setRouteSections([]);
      setRoutePathsByDay({});
    }
  }, []);

  const fetchPlanDetail = useCallback(async () => {
    if (!planId) return;
    try {
      setLoading(true);
      setError("");
      const res = await axiosInstance.get(`/api/plans/${planId}`);
      setPlan(res.data);
      initEditState(res.data);
      await loadRoadRoutesByDay(normalizeItems(res.data?.items || []));
    } catch {
      setError("여행 일정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [planId, initEditState, loadRoadRoutesByDay]);

  useEffect(() => {
    fetchPlanDetail();
  }, [fetchPlanDetail]);

  const currentItems = isEditing
    ? editItems
    : normalizeItems(plan?.items || []);
  const itemsByDay = useMemo(
    () => groupItemsByDay(currentItems),
    [currentItems],
  );

  const dayNumbers = useMemo(() => {
    const count = Math.max(
      Math.floor(
        (new Date(isEditing ? editEndDate : plan?.endDate) -
          new Date(isEditing ? editStartDate : plan?.startDate)) /
          86400000,
      ) + 1,
      1,
    );
    return Array.from(
      {
        length: Math.max(count || 1, ...Object.keys(itemsByDay).map(Number), 1),
      },
      (_, i) => i + 1,
    );
  }, [
    itemsByDay,
    isEditing,
    editStartDate,
    editEndDate,
    plan?.startDate,
    plan?.endDate,
  ]);

  useEffect(() => {
    if (!dayNumbers.includes(selectedDayForMap))
      setSelectedDayForMap(dayNumbers[0] || 1);
  }, [dayNumbers, selectedDayForMap]);

  const selectedDayItems = itemsByDay[selectedDayForMap] || [];
  const selectedRoutePath = routePathsByDay[selectedDayForMap] || [];

  // 선택된 Day의 대표 장소(첫 번째 장소)를 기준으로 날씨 정보 조회 함수
  const fetchWeatherForSelectedDay = useCallback(async (dayItems) => {
    if (!dayItems || dayItems.length === 0) {
      setWeatherInfo(null);
      return;
    }
    const targetPlace = dayItems[0];
    if (!targetPlace.latitude || !targetPlace.longitude) return;

    try {
      setWeatherLoading(true);
      // 백엔드 날씨 API가 있다면 연동 (/api/weather 등)
      // 예시: const res = await axiosInstance.get(`/api/weather?lat=${targetPlace.latitude}&lng=${targetPlace.longitude}`);
      // setWeatherInfo(res.data);

      // 백엔드 구현 전 임시 테스트용 Mock 데이터 연동 구조 (실제 API 호출 코드로 대체 가능)
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

  // 선택된 Day가 변경될 때마다 날씨 정보 갱신
  useEffect(() => {
    fetchWeatherForSelectedDay(selectedDayItems);
  }, [selectedDayForMap, selectedDayItems, fetchWeatherForSelectedDay]);

  const handleDaySelect = (dNum) => {
    const day = Number(dNum);
    setSelectedDayForMap(day);
    const first = itemsByDay[day]?.[0];
    if (first)
      setSelectedPlaceForMap({ lat: first.latitude, lng: first.longitude });
  };

  const handlePlaceSelectFromMap = useCallback(
    (place) => {
      if (!isEditing) {
        if (place?.latitude && place?.longitude) {
          setSelectedPlaceForMap({
            lat: Number(place.latitude),
            lng: Number(place.longitude),
            placeName: place.placeName,
          });
        }
        return;
      }

      if (place?.source === "map-click") {
        const lat = Number(place.latitude);
        const lng = Number(place.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setSelectedPlaceForMap({ lat, lng, placeName: place.placeName });
        }
        return;
      }

      const lat = Number(place.latitude);
      const lng = Number(place.longitude);
      const targetDay = Number(selectedDayForMap || 1);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const newItem = {
        _uiId: createUiId(),
        placeName: place.placeName || "선택된 장소",
        address: place.address || "",
        latitude: lat,
        longitude: lng,
        dayNumber: targetDay,
        visitOrder:
          editItems.filter((i) => Number(i.dayNumber || 1) === targetDay)
            .length + 1,
        stayMinutes: 60,
      };

      setEditItems((prev) => normalizeVisitOrders([...prev, newItem]));
      setSelectedPlaceForMap({ lat, lng, placeName: newItem.placeName });
    },
    [isEditing, selectedDayForMap, editItems],
  );

  const handleDragEnd = (e) => {
    const { active, over } = e;
    setActiveDragId(null);
    if (!over) return;

    const activeId = String(active.id),
      overId = String(over.id);
    setEditItems((prev) => {
      const items = [...prev];
      const aIdx = items.findIndex((i) => String(i._uiId) === activeId);
      if (aIdx === -1) return prev;
      const aItem = items[aIdx];

      if (overId.startsWith("day-")) {
        const tDay = Number(overId.replace("day-", ""));
        if (Number(aItem.dayNumber) === tDay) return prev;
        return normalizeVisitOrders([
          ...items.filter((i) => String(i._uiId) !== activeId),
          { ...aItem, dayNumber: tDay },
        ]);
      }

      const oIdx = items.findIndex((i) => String(i._uiId) === overId);
      if (oIdx === -1) return prev;
      const tDay = Number(items[oIdx].dayNumber || 1);
      const withoutActive = items.filter((i) => String(i._uiId) !== activeId);
      const newTIdx = withoutActive.findIndex(
        (i) => String(i._uiId) === overId,
      );
      withoutActive.splice(newTIdx, 0, { ...aItem, dayNumber: tDay });
      return normalizeVisitOrders(withoutActive);
    });
  };

  useEffect(() => {
    if (!isEditing || editItems.length === 0) return;
    const timer = setTimeout(() => loadRoadRoutesByDay(editItems), 350);
    return () => clearTimeout(timer);
  }, [editItems, isEditing, loadRoadRoutesByDay]);

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

  if (loading)
    return (
      <div style={{ padding: 50, textAlign: "center", color: "#6b7280" }}>
        여행 일정을 불러오는 중...
      </div>
    );
  if (error)
    return (
      <div style={{ padding: 50, textAlign: "center" }}>
        <div style={{ color: "#ef4444", marginBottom: 20 }}>{error}</div>
        <button
          onClick={() => navigate("/plans")}
          style={{
            padding: "10px 16px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            background: "#fff",
          }}
        >
          목록으로
        </button>
      </div>
    );
  if (!plan) return null;

  const activeDragItem = activeDragId
    ? currentItems.find((i) => String(i._uiId) === String(activeDragId))
    : null;

  return (
    <div
      style={{ maxWidth: 1500, margin: "0 auto", padding: "25px 20px 50px" }}
    >
      {/* Header */}
      <div style={{ ...S.flexBetween, gap: 15, marginBottom: 20 }}>
        <div style={{ ...S.flexRow, gap: 10 }}>
          <button
            onClick={() => navigate("/plans")}
            style={{
              width: 38,
              height: 38,
              ...S.card,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            {isEditing ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  border: "1px solid #d1d5db",
                  borderRadius: 7,
                  padding: "5px 8px",
                }}
              />
            ) : (
              <h1
                style={{
                  margin: 0,
                  fontSize: 25,
                  fontWeight: 800,
                  color: "#111827",
                }}
              >
                {plan.title}
              </h1>
            )}
            <div
              style={{
                ...S.flexRow,
                gap: 8,
                marginTop: 5,
                color: "#6b7280",
                fontSize: 13,
              }}
            >
              <CalendarDays size={14} />
              {isEditing ? (
                <>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setEditStartDate(newStart);
                      if (editEndDate && newStart > editEndDate) {
                        setEditEndDate(newStart);
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
        <div style={{ display: "flex", gap: 8 }}>
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  initEditState(plan);
                  setIsEditing(false);
                }}
                style={{
                  ...S.btnBase,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                }}
              >
                <X size={15} />
                취소
              </button>
              <button
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    await axiosInstance.put(`/api/plans/${planId}`, {
                      title: editTitle,
                      startDate: editStartDate,
                      endDate: editEndDate,
                      items: normalizeVisitOrders(editItems),
                    });
                    alert("저장되었습니다.");
                    setIsEditing(false);
                    fetchPlanDetail();
                  } catch {
                    alert("저장 실패");
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
                style={{
                  ...S.btnBase,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                }}
              >
                <Save size={15} />
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  ...S.btnBase,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                }}
              >
                <Pencil size={15} />
                편집
              </button>
              <button
                onClick={async () => {
                  if (window.confirm("삭제하시겠습니까?")) {
                    await axiosInstance.delete(`/api/plans/${planId}`);
                    navigate("/plans");
                  }
                }}
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

      {/* Main Layout */}
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
          {/* Map */}
          <div
            style={{
              position: "sticky",
              top: 15,
              height: 650,
              ...S.card,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                zIndex: 20,
                display: "flex",
                gap: 5,
                padding: 5,
                borderRadius: 9,
                background: "rgba(255,255,255,0.96)",
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

          {/* Schedule List */}
          <div>
            {/* 날씨 정보 위젯 영역 */}
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
                    isEditing={isEditing}
                    onDaySelect={handleDaySelect}
                    isSelected={selectedDayForMap === dNum}
                  >
                    {schedule.map((sItem, idx) => (
                      <SortablePlanItem
                        key={sItem.item._uiId}
                        item={sItem.item}
                        index={idx}
                        isEditing={isEditing}
                        onRemove={(id) =>
                          setEditItems((prev) =>
                            normalizeVisitOrders(
                              prev.filter((i) => i._uiId !== id),
                            ),
                          )
                        }
                        onStayChange={(id, m) =>
                          setEditItems((prev) =>
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

export default PlanDetail;
