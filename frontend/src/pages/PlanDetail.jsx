// ============================================================
// PlanDetail.jsx (Refactored)
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
    justifyContent: "center",
    gap: 6,
    padding: "9px 13px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
};

const createUiId = () =>
  `ui-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const toNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

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

const normalizeVisitOrders = (items = []) => {
  const dayMap = new Map();
  items.forEach((item) => {
    const day = Number(item.dayNumber || 1);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day).push(item);
  });

  const result = [];
  [...dayMap.keys()]
    .sort((a, b) => a - b)
    .forEach((dayNumber) => {
      dayMap.get(dayNumber).forEach((item, index) => {
        result.push({ ...item, dayNumber, visitOrder: index + 1 });
      });
    });
  return result;
};

const groupItemsByDay = (items = []) => {
  const grouped = {};
  items.forEach((item) => {
    const day = Number(item.dayNumber || 1);
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(item);
  });
  Object.keys(grouped).forEach((day) => {
    grouped[day].sort(
      (a, b) => Number(a.visitOrder || 0) - Number(b.visitOrder || 0),
    );
  });
  return grouped;
};

const formatDuration = (val, isSec = false) => {
  const mins = isSec ? Math.round((Number(val) || 0) / 60) : Number(val) || 0;
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60),
    r = mins % 60;
  return r === 0 ? `${h}시간` : `${h}시간 ${r}분`;
};

const formatDistance = (val) => {
  const d = Number(val) || 0;
  return d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
};

const timeToMins = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
};

const minsToTime = (m) => {
  const total = Math.max(0, Number(m) || 0);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const calculateDayCount = (start, end) => {
  if (!start || !end) return 1;
  const s = new Date(start),
    e = new Date(end);
  if (isNaN(s) || isNaN(e)) return 1;
  return Math.max(Math.floor((e - s) / 86400000) + 1, 1);
};

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
    padding: 10,
    marginBottom: 8,
    boxShadow: isDragging
      ? "0 8px 20px rgba(37,99,235,0.15)"
      : "0 1px 3px rgba(0,0,0,0.05)",
    cursor: "pointer",
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
          <div style={{ ...S.flexRow, gap: 7, fontSize: 11, flexWrap: "wrap" }}>
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
                flexWrap: "wrap",
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
                  padding: "5px 7px",
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
    setSelectedPlaceForMap(null);
  }, []);

  const extractRoutePath = useCallback((sections = []) => {
    const path = [];
    sections.forEach((sec) => {
      sec?.roads?.forEach((road) => {
        const v = road?.vertexes || [];
        for (let i = 0; i < v.length - 1; i += 2) {
          const lng = Number(v[i]),
            lat = Number(v[i + 1]);
          if (isFinite(lat) && isFinite(lng)) path.push({ lat, lng });
        }
      });
    });
    return path;
  }, []);

  const loadRoadRoutesByDay = useCallback(
    async (items) => {
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
          const first = dayItems[0],
            last = dayItems[dayItems.length - 1];
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

          if (
            !isFinite(origin.x) ||
            !isFinite(origin.y) ||
            !isFinite(destination.x) ||
            !isFinite(destination.y)
          ) {
            newPaths[dayNumber] = [];
            continue;
          }

          const res = await axiosInstance.post("/api/plans/route", {
            origin,
            destination,
            waypoints,
            priority: "RECOMMEND",
            car_fuel: "GASOLINE",
          });
          const route = res?.data?.routes?.[0];
          if (!route) {
            newPaths[dayNumber] = [];
            continue;
          }
          const sections = route.sections || [];
          newPaths[dayNumber] = extractRoutePath(sections);
          sections.forEach((section, index) => {
            const fromItem = dayItems[index],
              toItem = dayItems[index + 1];
            if (!fromItem || !toItem) return;
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

        if (requestId !== routeRequestIdRef.current) return;
        setRouteSections(newSections);
        setRoutePathsByDay(newPaths);
      } catch (e) {
        if (requestId !== routeRequestIdRef.current) return;
        setRouteSections([]);
        setRoutePathsByDay({});
      }
    },
    [extractRoutePath],
  );

  const fetchPlanDetail = useCallback(async () => {
    if (!planId) return;
    try {
      setLoading(true);
      setError("");
      const res = await axiosInstance.get(`/api/plans/${planId}`);
      setPlan(res?.data);
      initEditState(res?.data);
      await loadRoadRoutesByDay(normalizeItems(res?.data?.items || []));
    } catch (err) {
      setError("여행 일정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [planId, initEditState, loadRoadRoutesByDay]);

  useEffect(() => {
    fetchPlanDetail();
  }, [fetchPlanDetail]);

  const currentItems = useMemo(
    () => (isEditing ? editItems : normalizeItems(plan?.items || [])),
    [isEditing, editItems, plan?.items],
  );
  const itemsByDay = useMemo(
    () => groupItemsByDay(currentItems),
    [currentItems],
  );

  const dayNumbers = useMemo(() => {
    const count = calculateDayCount(
      isEditing ? editStartDate : plan?.startDate,
      isEditing ? editEndDate : plan?.endDate,
    );
    const itemDays = Object.keys(itemsByDay)
      .map(Number)
      .filter(Number.isFinite);
    return Array.from(
      {
        length: Math.max(count, itemDays.length ? Math.max(...itemDays) : 1, 1),
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
    if (!dayNumbers.includes(selectedDayForMap)) {
      setSelectedDayForMap(dayNumbers[0] || 1);
      setSelectedPlaceForMap(null);
    }
  }, [dayNumbers, selectedDayForMap]);

  const selectedDayItems = itemsByDay[selectedDayForMap] || [];
  const selectedRoutePath = routePathsByDay[selectedDayForMap] || [];

  const fetchWeatherForSelectedDay = useCallback(async (dayItems) => {
    if (!dayItems || dayItems.length === 0) {
      setWeatherInfo(null);
      return;
    }
    const p = dayItems[0];
    if (!isFinite(p.latitude) || !isFinite(p.longitude)) {
      setWeatherInfo(null);
      return;
    }
    try {
      setWeatherLoading(true);
      await new Promise((r) => setTimeout(r, 200));
      setWeatherInfo({
        temperature: "22°C",
        description: "맑음",
        locationName: p.placeName || "해당 지역",
      });
    } catch {
      setWeatherInfo(null);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeatherForSelectedDay(selectedDayItems);
  }, [selectedDayForMap, selectedDayItems, fetchWeatherForSelectedDay]);

  const handleDaySelect = useCallback((day) => {
    setSelectedDayForMap(Number(day));
    setSelectedPlaceForMap(null);
  }, []);

  const handlePlaceSelectFromMap = useCallback(
    (place) => {
      if (!place) return;
      const lat = Number(place.latitude ?? place.lat),
        lng = Number(place.longitude ?? place.lng);
      if (!isFinite(lat) || !isFinite(lng)) return;

      if (!isEditing) {
        setSelectedPlaceForMap({
          lat,
          lng,
          placeName: place.placeName || place.name || "",
          uiId: place.uiId || null,
        });
        return;
      }
      if (place.source === "map-click") {
        setSelectedPlaceForMap({
          lat,
          lng,
          placeName: place.placeName || place.name || "",
        });
        return;
      }

      const targetDay = Number(selectedDayForMap || 1);
      const duplicated = editItems.some(
        (item) =>
          Number(item.dayNumber || 1) === targetDay &&
          Math.abs(Number(item.latitude) - lat) < 1e-6 &&
          Math.abs(Number(item.longitude) - lng) < 1e-6,
      );
      if (duplicated) {
        setSelectedPlaceForMap({
          lat,
          lng,
          placeName: place.placeName || place.name || "",
        });
        return;
      }

      const uiId = createUiId();
      const newItem = {
        _uiId: uiId,
        placeName: place.placeName || place.name || "선택된 장소",
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
      setSelectedPlaceForMap({ lat, lng, placeName: newItem.placeName, uiId });
    },
    [isEditing, selectedDayForMap, editItems],
  );

  const handleItemSelect = useCallback((item) => {
    setSelectedDayForMap(Number(item.dayNumber || 1));
    setSelectedPlaceForMap({
      lat: Number(item.latitude),
      lng: Number(item.longitude),
      placeName: item.placeName || "",
      uiId: item._uiId,
    });
  }, []);

  const handleRemoveItem = useCallback((uiId) => {
    setEditItems((prev) =>
      normalizeVisitOrders(prev.filter((i) => i._uiId !== uiId)),
    );
    setSelectedPlaceForMap((c) => (c?.uiId === uiId ? null : c));
  }, []);

  const handleStayChange = useCallback((uiId, minutes) => {
    setEditItems((prev) =>
      prev.map((i) => (i._uiId === uiId ? { ...i, stayMinutes: minutes } : i)),
    );
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;
    const activeId = String(active.id),
      overId = String(over.id);

    setEditItems((prev) => {
      const items = [...prev];
      const activeIdx = items.findIndex((i) => String(i._uiId) === activeId);
      if (activeIdx === -1) return prev;
      const activeItem = items[activeIdx];

      if (overId.startsWith("day-")) {
        const targetDay = Number(overId.replace("day-", ""));
        if (Number(activeItem.dayNumber) === targetDay) return prev;
        return normalizeVisitOrders([
          ...items.filter((i) => String(i._uiId) !== activeId),
          { ...activeItem, dayNumber: targetDay },
        ]);
      }

      const overIdx = items.findIndex((i) => String(i._uiId) === overId);
      if (overIdx === -1) return prev;
      const targetDay = Number(items[overIdx].dayNumber || 1);
      const withoutActive = items.filter((i) => String(i._uiId) !== activeId);
      const targetIdx = withoutActive.findIndex(
        (i) => String(i._uiId) === overId,
      );
      if (targetIdx === -1) return prev;

      withoutActive.splice(targetIdx, 0, {
        ...activeItem,
        dayNumber: targetDay,
      });
      return normalizeVisitOrders(withoutActive);
    });
  }, []);

  useEffect(() => {
    if (!isEditing || editItems.length === 0) return;
    const timer = setTimeout(() => loadRoadRoutesByDay(editItems), 400);
    return () => clearTimeout(timer);
  }, [editItems, isEditing, loadRoadRoutesByDay]);

  const scheduleByDay = useMemo(() => {
    const result = {};
    dayNumbers.forEach((dayNum) => {
      const dayItems = itemsByDay[dayNum] || [];
      let curMins = timeToMins(DEFAULT_START_TIME);
      result[dayNum] = dayItems.map((item) => {
        const arrMins = curMins,
          depMins = arrMins + Number(item.stayMinutes || 60);
        const section = routeSections.find(
          (r) => Number(r.dayNumber) === dayNum && r.fromUiId === item._uiId,
        );
        const drivingMins = section
          ? Math.round(Number(section.duration || 0) / 60)
          : 0;
        curMins = depMins + drivingMins;
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

  const handleSave = useCallback(async () => {
    if (isSaving) return;
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
      const cleanItems = normalizeVisitOrders(editItems).map(
        ({ _uiId, ...rest }) => rest,
      );
      await axiosInstance.put(`/api/plans/${planId}`, {
        title: editTitle.trim(),
        startDate: editStartDate,
        endDate: editEndDate,
        items: cleanItems,
      });
      alert("저장되었습니다.");
      setIsEditing(false);
      await fetchPlanDetail();
    } catch (e) {
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

  const handleDelete = useCallback(async () => {
    if (!window.confirm("이 여행 일정을 삭제하시겠습니까?")) return;
    try {
      await axiosInstance.delete(`/api/plans/${planId}`);
      alert("삭제되었습니다.");
      navigate("/plans");
    } catch (e) {
      alert("일정 삭제에 실패했습니다.");
    }
  }, [planId, navigate]);

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
            cursor: "pointer",
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
    <div className="travel-detail">
      <style>{`
        .travel-detail { width: 100%; max-width: 1500px; margin: 0 auto; padding: 25px 20px 50px; box-sizing: border-box; }
        .travel-detail-header { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 20px; }
        .travel-detail-header-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .travel-back-button { width: 38px; height: 38px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; display: flex; align-items: center; justifyContent: center; cursor: pointer; flex-shrink: 0; }
        .travel-detail-title { margin: 0; font-size: 25px; font-weight: 800; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .travel-detail-title-input { width: min(500px, 100%); font-size: 24px; font-weight: 800; border: 1px solid #d1d5db; border-radius: 7px; padding: 5px 8px; outline: none; }
        .travel-detail-date { display: flex; align-items: center; gap: 8px; margin-top: 5px; color: #6b7280; font-size: 13px; }
        .travel-detail-date input { max-width: 145px; border: 1px solid #d1d5db; border-radius: 6px; padding: 5px 7px; }
        .travel-detail-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .travel-detail-grid { display: grid; grid-template-columns: minmax(0, 1.85fr) minmax(320px, 1fr); gap: 20px; align-items: start; }
        .travel-map-wrapper { position: sticky; top: 15px; height: 650px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; overflow: hidden; display: flex; flex-direction: column; }
        .travel-map-toolbar { width: 100%; min-height: 54px; padding: 8px 10px; display: flex; align-items: center; justifyContent: space-between; gap: 10px; background: #fff; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; z-index: 10; }
        .travel-map-toolbar-title { display: flex; align-items: center; gap: 6px; color: #374151; font-size: 13px; font-weight: 800; white-space: nowrap; }
        .travel-map-day-selector { display: flex; align-items: center; gap: 5px; max-width: calc(100% - 90px); overflow-x: auto; scrollbar-width: none; }
        .travel-map-day-selector::-webkit-scrollbar { display: none; }
        .travel-map-day-button { border: none; border-radius: 7px; padding: 7px 10px; background: #f3f4f6; color: #374151; font-weight: 700; font-size: 12px; cursor: pointer; white-space: nowrap; }
        .travel-map-day-button.selected { background: #2563eb; color: #fff; }
        .travel-map-content { position: relative; flex: 1; min-height: 0; width: 100%; overflow: hidden; }
        .travel-weather { margin-bottom: 16px; padding: 12px 16px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 12px; }
        .travel-weather-inner, .travel-weather-left { display: flex; align-items: center; gap: 10px; }
        .travel-weather-inner { justify-content: space-between; }
        .travel-weather-icon { width: 36px; height: 36px; border-radius: 50%; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .travel-weather-title { font-size: 13px; font-weight: 800; color: #1e40af; }
        .travel-weather-text { margin-top: 2px; font-size: 12px; color: #4b5563; }
        .travel-day-section { margin-bottom: 14px; }
        .travel-day-header { display: flex; align-items: center; justify-content: space-between; padding: 11px 13px; border-radius: 10px 10px 0 0; cursor: pointer; }
        .travel-day-header.selected { background: #eff6ff; border: 1px solid #bfdbfe; color: #2563eb; }
        .travel-day-header:not(.selected) { background: #f3f4f6; border: 1px solid #e5e7eb; color: #111827; }
        .travel-day-title { font-size: 15px; font-weight: 800; }
        @media (max-width: 900px) {
          .travel-detail-grid { grid-template-columns: 1fr; }
          .travel-map-wrapper { position: relative; height: 500px; }
        }
        @media (max-width: 768px) {
          .travel-detail-header { flex-direction: column; align-items: stretch; }
          .travel-detail-actions { width: 100%; }
          .travel-detail-actions button { flex: 1; }
        }
      `}</style>

      <div className="travel-detail-header">
        <div className="travel-detail-header-left">
          <button
            type="button"
            className="travel-back-button"
            onClick={() => navigate("/plans")}
            aria-label="목록으로"
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ minWidth: 0 }}>
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
                      setEditStartDate(e.target.value);
                      if (editEndDate && e.target.value > editEndDate)
                        setEditEndDate(e.target.value);
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

        <div className="travel-detail-actions">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  initEditState(plan);
                  setIsEditing(false);
                  setSelectedPlaceForMap(null);
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveDragId(String(e.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        <div className="travel-detail-grid">
          <div className="travel-map-wrapper">
            <div className="travel-map-toolbar">
              <div className="travel-map-toolbar-title">
                <MapPin size={15} />
                <span>여행 지도</span>
              </div>
              <div className="travel-map-day-selector">
                {dayNumbers.map((dayNum) => (
                  <button
                    key={dayNum}
                    type="button"
                    className={`travel-map-day-button ${selectedDayForMap === dayNum ? "selected" : ""}`}
                    onClick={() => handleDaySelect(dayNum)}
                  >
                    DAY {dayNum}
                  </button>
                ))}
              </div>
            </div>
            <div className="travel-map-content">
              <KakaoMap
                items={selectedDayItems}
                selectedPlaceForMap={selectedPlaceForMap}
                onPlaceSelect={handlePlaceSelectFromMap}
                routePath={selectedRoutePath}
              />
            </div>
          </div>

          <div>
            <div className="travel-weather">
              <div className="travel-weather-inner">
                <div className="travel-weather-left">
                  <div className="travel-weather-icon">
                    <CloudSun size={20} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="travel-weather-title">
                      DAY {selectedDayForMap} 날씨 정보
                    </div>
                    <div className="travel-weather-text">
                      {weatherLoading
                        ? "날씨 정보를 불러오는 중..."
                        : weatherInfo
                          ? `${weatherInfo.locationName} 기준 · 기온: ${weatherInfo.temperature} (${weatherInfo.description})`
                          : "등록된 장소가 없어 날씨 정보를 확인할 수 없습니다."}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {dayNumbers.map((dayNum) => {
              const dayItems = itemsByDay[dayNum] || [];
              const schedule = scheduleByDay[dayNum] || [];
              const selected = selectedDayForMap === dayNum;

              return (
                <div key={dayNum} className="travel-day-section">
                  <div
                    className={`travel-day-header ${selected ? "selected" : ""}`}
                    onClick={() => handleDaySelect(dayNum)}
                  >
                    <div className="travel-day-title">
                      DAY {dayNum} ({dayItems.length}개 장소)
                    </div>
                  </div>
                  <DayDropContainer
                    dayNumber={dayNum}
                    itemIds={dayItems.map((i) => i._uiId)}
                    isEditing={isEditing}
                    onDaySelect={handleDaySelect}
                    isSelected={selected}
                  >
                    {schedule.map((s, idx) => (
                      <SortablePlanItem
                        key={s.item._uiId}
                        item={s.item}
                        index={idx}
                        isEditing={isEditing}
                        onRemove={handleRemoveItem}
                        onStayChange={handleStayChange}
                        onSelect={handleItemSelect}
                        routeSection={s.routeSection}
                        arrivalTime={s.arrivalTime}
                        departureTime={s.departureTime}
                      />
                    ))}
                  </DayDropContainer>
                </div>
              );
            })}
          </div>
        </div>

        <DragOverlay>
          {activeDragItem && (
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <GripVertical size={16} color="#2563eb" />
                <strong>{activeDragItem.placeName}</strong>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default PlanDetail;
