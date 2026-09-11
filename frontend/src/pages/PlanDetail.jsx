import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import KakaoMap from "../components/map/KakaoMap";
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
import {
  ArrowLeft,
  CalendarDays,
  Car,
  Clock3,
  GripVertical,
  MapPin,
  Pencil,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

const DEFAULT_START_TIME = "09:00";
const STAY_OPTIONS = [30, 60, 90, 120, 150, 180, 240];

const createUiId = () =>
  `ui-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const normalizeItems = (items = []) => {
  return [...items]
    .map((item, index) => ({
      ...item,
      _uiId: item._uiId || createUiId(),
      dayNumber: Number(item.dayNumber || 1),
      visitOrder: Number(item.visitOrder ?? index + 1),
      stayMinutes: Number(item.stayMinutes ?? 60),
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
    }))
    .sort(
      (a, b) =>
        Number(a.dayNumber) - Number(b.dayNumber) ||
        Number(a.visitOrder) - Number(b.visitOrder),
    );
};

const normalizeVisitOrders = (items = []) => {
  const dayMap = new Map();
  items.forEach((item) => {
    const dayNumber = Number(item.dayNumber || 1);
    if (!dayMap.has(dayNumber)) dayMap.set(dayNumber, []);
    dayMap.get(dayNumber).push({ ...item });
  });

  const sortedDays = [...dayMap.keys()].sort((a, b) => a - b);
  const result = [];
  sortedDays.forEach((dayNumber) => {
    const dayItems = dayMap.get(dayNumber) || [];
    dayItems.forEach((item, index) => {
      result.push({ ...item, dayNumber, visitOrder: index + 1 });
    });
  });
  return result;
};

const groupItemsByDay = (items = []) => {
  const grouped = {};
  items.forEach((item) => {
    const dayNumber = Number(item.dayNumber || 1);
    if (!grouped[dayNumber]) grouped[dayNumber] = [];
    grouped[dayNumber].push(item);
  });
  Object.keys(grouped).forEach((dayNumber) => {
    grouped[dayNumber].sort(
      (a, b) => Number(a.visitOrder || 0) - Number(b.visitOrder || 0),
    );
  });
  return grouped;
};

const getDayCount = (startDate, endDate) => {
  if (!startDate || !endDate) return 1;
  const diff =
    Math.floor((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
  return Math.max(diff, 1);
};

const timeToMinutes = (time) => {
  if (!time) return 0;
  const [hour, minute] = String(time).split(":").map(Number);
  return hour * 60 + minute;
};

const minutesToTime = (minutes) => {
  const norm = Math.max(0, Number(minutes) || 0);
  const hour = Math.floor(norm / 60) % 24;
  const minute = norm % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const formatStayDuration = (minutes) => {
  const val = Number(minutes) || 0;
  if (val < 60) return `${val}분`;
  const hour = Math.floor(val / 60);
  const minute = val % 60;
  return minute === 0 ? `${hour}시간` : `${hour}시간 ${minute}분`;
};

const formatTravelDuration = (seconds) => {
  const minutes = Math.round((Number(seconds) || 0) / 60);
  if (minutes < 60) return `${minutes}분`;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return minute === 0 ? `${hour}시간` : `${hour}시간 ${minute}분`;
};

const formatDistance = (meters) => {
  const val = Number(meters) || 0;
  return val < 1000 ? `${Math.round(val)}m` : `${(val / 1000).toFixed(1)}km`;
};

const calculateGeoDistance = (a, b) => {
  const lat1 = Number(a.latitude),
    lng1 = Number(a.longitude);
  const lat2 = Number(b.latitude),
    lng2 = Number(b.longitude);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite))
    return Number.MAX_SAFE_INTEGER;

  const toRad = (val) => (val * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1),
    dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const calculatePathDistance = (items) => {
  if (!items || items.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < items.length - 1; i++)
    total += calculateGeoDistance(items[i], items[i + 1]);
  return total;
};

const generatePermutations = (items) => {
  if (items.length <= 1) return [items];
  const result = [];
  const permute = (rem, curr) => {
    if (rem.length === 0) return result.push([...curr]);
    rem.forEach((next, i) => {
      curr.push(next);
      permute([...rem.slice(0, i), ...rem.slice(i + 1)], curr);
      curr.pop();
    });
  };
  permute(items, []);
  return result;
};

const optimizeSingleDay = (dayItems) => {
  if (!dayItems || dayItems.length < 3) return [...dayItems];
  const start = dayItems[0],
    remaining = dayItems.slice(1);

  if (dayItems.length <= 8) {
    let bestRoute = [...dayItems],
      bestDistance = calculatePathDistance(bestRoute);
    generatePermutations(remaining).forEach((perm) => {
      const candidate = [start, ...perm];
      const dist = calculatePathDistance(candidate);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestRoute = candidate;
      }
    });
    return bestRoute;
  }

  const unvisited = [...remaining],
    result = [start];
  let current = start;
  while (unvisited.length > 0) {
    let nearestIdx = 0,
      nearestDist = Number.MAX_SAFE_INTEGER;
    unvisited.forEach((item, idx) => {
      const dist = calculateGeoDistance(current, item);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = idx;
      }
    });
    current = unvisited.splice(nearestIdx, 1)[0];
    result.push(current);
  }
  return result;
};

const optimizeItemsByDay = (items = []) => {
  const grouped = groupItemsByDay(items);
  const optimized = [];
  Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((dayNumber) => {
      optimizeSingleDay(grouped[dayNumber] || []).forEach((item, idx) => {
        optimized.push({ ...item, dayNumber, visitOrder: idx + 1 });
      });
    });
  return optimized;
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
          title="드래그하여 순서 변경"
        >
          <GripVertical size={16} />
        </button>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "#2563eb",
            color: "#ffffff",
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
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: "#6b7280",
              fontSize: 12,
              marginBottom: 5,
            }}
          >
            <MapPin size={13} />
            <span>{item.address || "주소 정보 없음"}</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 7,
              fontSize: 11,
            }}
          >
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
              체류 {formatStayDuration(item.stayMinutes)}
            </span>
          </div>
          {routeSection && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 5,
                color: "#059669",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <Car size={12} />
              <span>
                다음 장소까지 {formatTravelDuration(routeSection.duration)}
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
                onChange={(e) =>
                  onStayChange(item._uiId, Number(e.target.value))
                }
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  padding: "4px 6px",
                  fontSize: 11,
                  background: "#ffffff",
                }}
              >
                {STAY_OPTIONS.map((min) => (
                  <option key={min} value={min}>
                    체류 {formatStayDuration(min)}
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
                title="삭제"
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
  return (
    <div
      ref={setNodeRef}
      onClick={() => onDaySelect?.(dayNumber)}
      style={{
        border: isOver
          ? "2px dashed #2563eb"
          : isSelected
            ? "2px solid #2563eb"
            : "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 10,
        background: isOver ? "#eff6ff" : isSelected ? "#f8fbff" : "#f9fafb",
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
            background: "#ffffff",
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
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlaceForMap, setSelectedPlaceForMap] = useState(null);
  const [routePathsByDay, setRoutePathsByDay] = useState({});
  const [routeSections, setRouteSections] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const routeRequestIdRef = useRef(0);
  const [selectedDayForMap, setSelectedDayForMap] = useState(1);
  const [activeDragId, setActiveDragId] = useState(null);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const optimizationBeforeRef = useRef(null);

  // ✨ 날짜 변경 핸들러 추가
  const handleStartDateChange = (newStart) => {
    setEditStartDate(newStart);
    if (editEndDate && newStart > editEndDate) {
      setEditEndDate(newStart);
    }
  };

  const handleEndDateChange = (newEnd) => {
    if (editStartDate && newEnd < editStartDate) {
      alert("종료일은 시작일보다 앞설 수 없습니다.");
      setEditEndDate(editStartDate);
      return;
    }
    setEditEndDate(newEnd);
  };

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
    sections.forEach((section) => {
      (section?.roads || []).forEach((road) => {
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
    setRouteLoading(true);

    try {
      const dayNumbers = Object.keys(grouped)
        .map(Number)
        .sort((a, b) => a - b);
      const newSections = [],
        newPaths = {};

      for (const dayNumber of dayNumbers) {
        if (requestId !== routeRequestIdRef.current) return;
        const dayItems = grouped[dayNumber] || [];
        if (dayItems.length < 2) {
          newPaths[dayNumber] = [];
          continue;
        }

        const first = dayItems[0],
          last = dayItems[dayItems.length - 1],
          middle = dayItems.slice(1, -1);
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
        const waypoints = middle.map((item) => ({
          name: item.placeName || "경유지",
          x: Number(item.longitude),
          y: Number(item.latitude),
        }));

        if (
          [origin, destination, ...waypoints].some(
            (pt) => !Number.isFinite(pt.x) || !Number.isFinite(pt.y),
          )
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

        const route = (response?.data?.routes || [])[0];
        if (!route) {
          newPaths[dayNumber] = [];
          continue;
        }

        const sections = route.sections || [];
        newPaths[dayNumber] = extractRoutePath(sections);

        sections.forEach((section, idx) => {
          const fromItem = dayItems[idx],
            toItem = dayItems[idx + 1];
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

      if (optimizationBeforeRef.current !== null) {
        const beforeSec = Number(optimizationBeforeRef.current) || 0;
        const afterSec = newSections.reduce(
          (acc, sec) => acc + Number(sec.duration || 0),
          0,
        );
        setOptimizationResult({
          beforeSeconds: beforeSec,
          afterSeconds: afterSec,
          savedSeconds: Math.max(0, beforeSec - afterSec),
        });
        optimizationBeforeRef.current = null;
      }
    } catch (err) {
      if (requestId !== routeRequestIdRef.current) return;
      setRouteSections([]);
      setRoutePathsByDay({});
    } finally {
      if (requestId === routeRequestIdRef.current) setRouteLoading(false);
    }
  }, []);

  const fetchPlanDetail = useCallback(async () => {
    if (!planId) return;
    try {
      setLoading(true);
      setError("");
      const response = await axiosInstance.get(`/api/plans/${planId}`);
      setPlan(response.data);
      initEditState(response.data);
      await loadRoadRoutesByDay(normalizeItems(response.data?.items || []));
    } catch (err) {
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
    const dayCount = getDayCount(
      isEditing ? editStartDate : plan?.startDate,
      isEditing ? editEndDate : plan?.endDate,
    );
    return Array.from(
      { length: Math.max(dayCount, ...Object.keys(itemsByDay).map(Number), 1) },
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

  const handleDaySelect = (dayNum) => {
    setSelectedDayForMap(Number(dayNum));
    const firstItem = itemsByDay[dayNum]?.[0];
    if (firstItem)
      setSelectedPlaceForMap({
        lat: firstItem.latitude,
        lng: firstItem.longitude,
      });
  };

  const handleMapPlaceSelect = (place) => {
    if (!place) return;
    const lat = Number(place.latitude),
      lng = Number(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    setSelectedPlaceForMap({ lat, lng });
    if (!isEditing) return;

    if (
      editItems.some(
        (i) =>
          Math.abs(i.latitude - lat) < 0.000001 &&
          Math.abs(i.longitude - lng) < 0.000001,
      )
    ) {
      return alert("이미 일정에 추가된 장소입니다.");
    }

    const targetDay = Number(selectedDayForMap || 1);
    const newItem = {
      _uiId: createUiId(),
      placeName: place.placeName || "선택한 장소",
      address: place.address || "",
      latitude: lat,
      longitude: lng,
      dayNumber: targetDay,
      visitOrder: 1,
      stayMinutes: 60,
    };

    setOptimizationResult(null);
    optimizationBeforeRef.current = null;
    setEditItems((prev) => {
      const targetItems = prev.filter(
        (i) => Number(i.dayNumber || 1) === targetDay,
      );
      newItem.visitOrder = targetItems.length + 1;
      return normalizeVisitOrders([...prev, newItem]);
    });
    setSearchResults([]);
  };

  const handleDragStart = (e) => setActiveDragId(String(e.active.id));
  const handleDragCancel = () => setActiveDragId(null);

  const handleDragEnd = (event) => {
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
      const sourceDay = Number(activeItem.dayNumber || 1);

      if (overId.startsWith("day-")) {
        const targetDay = Number(overId.replace("day-", ""));
        if (!Number.isFinite(targetDay) || sourceDay === targetDay) return prev;

        const withoutActive = items.filter((i) => String(i._uiId) !== activeId);
        const targetItems = withoutActive.filter(
          (i) => Number(i.dayNumber || 1) === targetDay,
        );
        const movedItem = { ...activeItem, dayNumber: targetDay };

        if (targetItems.length === 0) {
          withoutActive.push(movedItem);
          return normalizeVisitOrders(withoutActive);
        }
        const insertIdx =
          withoutActive.findIndex(
            (i) =>
              String(i._uiId) ===
              String(targetItems[targetItems.length - 1]._uiId),
          ) + 1;
        withoutActive.splice(insertIdx, 0, movedItem);
        return normalizeVisitOrders(withoutActive);
      }

      const overIdx = items.findIndex((i) => String(i._uiId) === overId);
      if (overIdx === -1) return prev;
      const targetDay = Number(items[overIdx].dayNumber || 1);

      const withoutActive = items.filter((i) => String(i._uiId) !== activeId);
      const movedItem = { ...activeItem, dayNumber: targetDay };
      const newTargetIdx = withoutActive.findIndex(
        (i) => String(i._uiId) === overId,
      );
      if (newTargetIdx === -1) return prev;

      withoutActive.splice(newTargetIdx, 0, movedItem);
      return normalizeVisitOrders(withoutActive);
    });
  };

  const handleAutoOptimize = () => {
    if (!isEditing) return;
    if (editItems.length < 3)
      return alert("최소 3개 이상의 장소가 필요합니다.");

    const beforeSec = routeSections.reduce(
      (acc, s) => acc + Number(s.duration || 0),
      0,
    );
    const optimizedItems = optimizeItemsByDay(editItems);

    const currentOrder = editItems.map((i) => i._uiId);
    const optimizedOrder = optimizedItems.map((i) => i._uiId);
    if (
      currentOrder.length === optimizedOrder.length &&
      currentOrder.every((id, idx) => id === optimizedOrder[idx])
    ) {
      setOptimizationResult({
        beforeSeconds: beforeSec,
        afterSeconds: beforeSec,
        savedSeconds: 0,
      });
      return alert("현재 경로가 이미 최적 경로에 가깝습니다.");
    }

    optimizationBeforeRef.current = beforeSec;
    setOptimizationResult({
      beforeSeconds: beforeSec,
      afterSeconds: null,
      savedSeconds: null,
    });
    setEditItems(optimizedItems);
  };

  useEffect(() => {
    if (!isEditing || editItems.length === 0) return;
    const timer = setTimeout(() => loadRoadRoutesByDay(editItems), 250);
    return () => clearTimeout(timer);
  }, [editItems, isEditing, loadRoadRoutesByDay]);

  const handleStayMinutesChange = (uiId, minutes) => {
    setOptimizationResult(null);
    optimizationBeforeRef.current = null;
    setEditItems((prev) =>
      prev.map((i) => (i._uiId === uiId ? { ...i, stayMinutes: minutes } : i)),
    );
  };

  const handleRemoveItem = (uiId) => {
    setOptimizationResult(null);
    optimizationBeforeRef.current = null;
    setEditItems((prev) =>
      normalizeVisitOrders(prev.filter((i) => i._uiId !== uiId)),
    );
  };

  const handleSearch = () => {
    const keyword = searchKeyword.trim();
    if (!keyword || !window.kakao?.maps?.services)
      return alert("카카오 지도 SDK 로딩 전입니다.");
    setIsSearching(true);
    new window.kakao.maps.services.Places().keywordSearch(
      keyword,
      (data, status) => {
        setIsSearching(false);
        setSearchResults(
          status === window.kakao.maps.services.Status.OK ? data || [] : [],
        );
      },
    );
  };

  const handleAddSearchPlace = (place) => {
    setOptimizationResult(null);
    optimizationBeforeRef.current = null;
    const newItem = {
      _uiId: createUiId(),
      placeName: place.place_name,
      address: place.road_address_name || place.address_name || "",
      latitude: Number(place.y),
      longitude: Number(place.x),
      dayNumber: 1,
      visitOrder: 1,
      stayMinutes: 60,
    };

    setEditItems((prev) => {
      const dayOne = prev.filter((i) => Number(i.dayNumber || 1) === 1);
      newItem.visitOrder = dayOne.length + 1;
      return normalizeVisitOrders([...prev, newItem]);
    });
    setSelectedDayForMap(1);
    setSelectedPlaceForMap({ lat: Number(place.y), lng: Number(place.x) });
    setSearchResults([]);
    setSearchKeyword("");
  };

  const scheduleByDay = useMemo(() => {
    const result = {};
    dayNumbers.forEach((dayNum) => {
      const dayItems = itemsByDay[dayNum] || [];
      let currentMins = timeToMinutes(DEFAULT_START_TIME);
      result[dayNum] = dayItems.map((item) => {
        const arrivalMins = currentMins;
        const depMins = arrivalMins + Number(item.stayMinutes || 60);
        const routeSec = routeSections.find(
          (s) =>
            Number(s.dayNumber) === Number(dayNum) && s.fromUiId === item._uiId,
        );
        const travelMins = routeSec
          ? Math.round(Number(routeSec.duration || 0) / 60)
          : 0;
        currentMins = depMins + travelMins;
        return {
          item,
          arrivalTime: minutesToTime(arrivalMins),
          departureTime: minutesToTime(depMins),
          routeSection: routeSec,
        };
      });
    });
    return result;
  }, [dayNumbers, itemsByDay, routeSections]);

  const totalStayMinutes = useMemo(
    () => currentItems.reduce((acc, i) => acc + Number(i.stayMinutes || 0), 0),
    [currentItems],
  );
  const totalTravelSeconds = useMemo(
    () => routeSections.reduce((acc, s) => acc + Number(s.duration || 0), 0),
    [routeSections],
  );

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const normalized = normalizeVisitOrders(editItems);
      const payload = {
        title: editTitle,
        startDate: editStartDate,
        endDate: editEndDate,
        items: normalized.map((i) => ({
          placeName: i.placeName,
          address: i.address,
          latitude: Number(i.latitude),
          longitude: Number(i.longitude),
          dayNumber: Number(i.dayNumber || 1),
          visitOrder: Number(i.visitOrder || 1),
          stayMinutes: Number(i.stayMinutes || 60),
        })),
      };
      await axiosInstance.put(`/api/plans/${planId}`, payload);
      alert("여행 일정이 저장되었습니다.");
      setIsEditing(false);
      await fetchPlanDetail();
    } catch (err) {
      alert("일정 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!plan) return;
    initEditState(plan);
    setIsEditing(false);
    loadRoadRoutesByDay(normalizeItems(plan.items || []));
  };

  const handleDelete = async () => {
    if (!window.confirm("이 여행 일정을 삭제하시겠습니까?")) return;
    try {
      await axiosInstance.delete(`/api/plans/${planId}`);
      alert("여행 일정이 삭제되었습니다.");
      navigate("/plans");
    } catch (err) {
      alert("일정 삭제에 실패했습니다.");
    }
  };

  const activeDragItem = activeDragId
    ? currentItems.find((i) => String(i._uiId) === String(activeDragId))
    : null;

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
          type="button"
          onClick={() => navigate("/plans")}
          style={{
            padding: "10px 16px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            background: "#ffffff",
            cursor: "pointer",
          }}
        >
          목록으로
        </button>
      </div>
    );
  if (!plan) return null;

  return (
    <div
      style={{ maxWidth: 1500, margin: "0 auto", padding: "25px 20px 50px" }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 15,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => navigate("/plans")}
            style={{
              width: 38,
              height: 38,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: "#ffffff",
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
                display: "flex",
                alignItems: "center",
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
                    onChange={(e) => handleStartDateChange(e.target.value)}
                  />

                  <span>~</span>

                  <input
                    type="date"
                    value={editEndDate}
                    min={editStartDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
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
                type="button"
                onClick={handleCancelEdit}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 13px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  background: "#ffffff",
                  cursor: "pointer",
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
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 13px",
                  border: "none",
                  borderRadius: 8,
                  background: "#2563eb",
                  color: "#ffffff",
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
                onClick={() => setIsEditing(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 13px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  background: "#ffffff",
                  cursor: "pointer",
                }}
              >
                <Pencil size={15} />
                편집
              </button>
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 13px",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  background: "#fffafa",
                  color: "#dc2626",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={15} />
                삭제
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      {isEditing && (
        <div style={{ position: "relative", marginBottom: 15 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search
                size={17}
                style={{
                  position: "absolute",
                  left: 12,
                  top: 12,
                  color: "#9ca3af",
                }}
              />
              <input
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="장소를 검색하세요"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px 10px 36px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  outline: "none",
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearching}
              style={{
                padding: "0 18px",
                border: "none",
                borderRadius: 8,
                background: "#2563eb",
                color: "#ffffff",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {isSearching ? "검색 중..." : "검색"}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "calc(100% + 5px)",
                zIndex: 100,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                overflow: "hidden",
              }}
            >
              {searchResults.slice(0, 8).map((place) => (
                <button
                  type="button"
                  key={place.id}
                  onClick={() => handleAddSearchPlace(place)}
                  style={{
                    width: "100%",
                    border: "none",
                    borderBottom: "1px solid #f3f4f6",
                    background: "#ffffff",
                    padding: "10px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{ fontWeight: 700, color: "#111827", fontSize: 13 }}
                  >
                    {place.place_name}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 11, marginTop: 3 }}>
                    {place.road_address_name || place.address_name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Optimization Banner */}
      {isEditing && (
        <div
          style={{
            marginBottom: 20,
            padding: 14,
            border: "1px solid #dbeafe",
            borderRadius: 12,
            background: "#f8fbff",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#1e3a8a",
                  marginBottom: 4,
                }}
              >
                🚗 경로 자동 최적화
              </div>
              <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
                각 DAY의 첫 장소를 출발점으로 유지하고 나머지 장소의 순서를
                최적화합니다.
              </div>
            </div>
            <button
              type="button"
              onClick={handleAutoOptimize}
              disabled={routeLoading || editItems.length < 3}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 15px",
                border: "none",
                borderRadius: 8,
                background:
                  routeLoading || editItems.length < 3 ? "#cbd5e1" : "#2563eb",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 800,
                cursor:
                  routeLoading || editItems.length < 3 ? "default" : "pointer",
              }}
            >
              <Car size={15} />
              {routeLoading ? "경로 계산 중..." : "경로 자동 최적화"}
            </button>
          </div>
          {optimizationResult && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid #dbeafe",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "#64748b" }}>기존 이동시간</span>
                <strong style={{ color: "#334155" }}>
                  {formatTravelDuration(optimizationResult.beforeSeconds)}
                </strong>
                {optimizationResult.afterSeconds !== null && (
                  <>
                    <span style={{ color: "#94a3b8" }}>→</span>
                    <span style={{ color: "#64748b" }}>최적화 후</span>
                    <strong style={{ color: "#2563eb" }}>
                      {formatTravelDuration(optimizationResult.afterSeconds)}
                    </strong>
                  </>
                )}
              </div>
              {optimizationResult.savedSeconds !== null && (
                <div
                  style={{
                    marginTop: 7,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color:
                      optimizationResult.savedSeconds > 0
                        ? "#059669"
                        : "#64748b",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {optimizationResult.savedSeconds > 0
                    ? `▼ ${formatTravelDuration(optimizationResult.savedSeconds)} 절약`
                    : "현재 경로가 이미 최적 경로에 가깝습니다."}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary info */}
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}
      >
        <div
          style={{
            padding: "9px 13px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            background: "#ffffff",
            fontSize: 13,
          }}
        >
          <strong>{currentItems.length}</strong> 장소
        </div>
        <div
          style={{
            padding: "9px 13px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            background: "#ffffff",
            fontSize: 13,
          }}
        >
          체류 <strong>{formatStayDuration(totalStayMinutes)}</strong>
        </div>
        <div
          style={{
            padding: "9px 13px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            background: "#ffffff",
            fontSize: 13,
          }}
        >
          이동 <strong>{formatTravelDuration(totalTravelSeconds)}</strong>
        </div>
        {routeLoading && (
          <div
            style={{
              padding: "9px 13px",
              border: "1px solid #bfdbfe",
              borderRadius: 8,
              background: "#eff6ff",
              color: "#2563eb",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            🚗 DAY별 도로 경로 계산 중...
          </div>
        )}
      </div>

      {/* Main DnD Layout */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.85fr) minmax(320px, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* MAP */}
          <div
            style={{
              position: "sticky",
              top: 15,
              height: 650,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
              background: "#ffffff",
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
                boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
              }}
            >
              {dayNumbers.map((dayNum) => (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleDaySelect(dayNum)}
                  style={{
                    border: "none",
                    borderRadius: 7,
                    padding: "7px 10px",
                    background:
                      selectedDayForMap === dayNum ? "#2563eb" : "#f3f4f6",
                    color: selectedDayForMap === dayNum ? "#ffffff" : "#374151",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  DAY {dayNum}
                </button>
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                right: 12,
                top: 12,
                zIndex: 20,
                padding: "7px 10px",
                borderRadius: 7,
                background: "rgba(255,255,255,0.94)",
                color: "#374151",
                fontSize: 11,
                fontWeight: 600,
                boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
              }}
            >
              DAY {selectedDayForMap} · {selectedDayItems.length}개 장소
            </div>
            <KakaoMap
              items={selectedDayItems}
              selectedPlaceForMap={selectedPlaceForMap}
              onPlaceSelect={handleMapPlaceSelect}
              routePath={selectedRoutePath}
            />
          </div>

          {/* SCHEDULE */}
          <div>
            <div
              style={{
                marginBottom: 10,
                fontSize: 14,
                fontWeight: 700,
                color: "#374151",
              }}
            >
              {isEditing
                ? "장소를 드래그해서 DAY와 순서를 변경하세요."
                : "DAY를 클릭하면 해당 DAY의 경로가 지도에 표시됩니다."}
            </div>

            {dayNumbers.map((dayNum) => {
              const dayItems = itemsByDay[dayNum] || [];
              const schedule = scheduleByDay[dayNum] || [];
              const itemIds = dayItems.map((i) => i._uiId);
              const dayRoutePath = routePathsByDay[dayNum] || [];

              return (
                <div key={dayNum} style={{ marginBottom: 14 }}>
                  <div
                    onClick={() => handleDaySelect(dayNum)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "11px 13px",
                      borderRadius: "10px 10px 0 0",
                      background:
                        selectedDayForMap === dayNum ? "#eff6ff" : "#f3f4f6",
                      border:
                        selectedDayForMap === dayNum
                          ? "1px solid #bfdbfe"
                          : "1px solid #e5e7eb",
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color:
                            selectedDayForMap === dayNum
                              ? "#2563eb"
                              : "#111827",
                        }}
                      >
                        DAY {dayNum}
                      </div>
                      <div
                        style={{ marginTop: 2, color: "#6b7280", fontSize: 11 }}
                      >
                        09:00 시작 · {dayItems.length}개 장소
                      </div>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 7 }}
                    >
                      {dayRoutePath.length > 1 && (
                        <span
                          style={{
                            padding: "4px 7px",
                            borderRadius: 5,
                            background: "#dcfce7",
                            color: "#15803d",
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          실제 도로
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: "#6b7280" }}>
                        지도 보기
                      </span>
                    </div>
                  </div>

                  <DayDropContainer
                    dayNumber={dayNum}
                    itemIds={itemIds}
                    isEditing={isEditing}
                    onDaySelect={handleDaySelect}
                    isSelected={selectedDayForMap === dayNum}
                  >
                    {schedule.map((schItem, idx) => (
                      <SortablePlanItem
                        key={schItem.item._uiId}
                        item={schItem.item}
                        index={idx}
                        isEditing={isEditing}
                        onRemove={handleRemoveItem}
                        onStayChange={handleStayMinutesChange}
                        onSelect={(item) => {
                          setSelectedDayForMap(Number(item.dayNumber || 1));
                          setSelectedPlaceForMap({
                            lat: item.latitude,
                            lng: item.longitude,
                          });
                        }}
                        routeSection={schItem.routeSection}
                        arrivalTime={schItem.arrivalTime}
                        departureTime={schItem.departureTime}
                      />
                    ))}
                  </DayDropContainer>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeDragItem ? (
            <div
              style={{
                width: 330,
                background: "#ffffff",
                border: "2px solid #2563eb",
                borderRadius: 10,
                padding: "12px 14px",
                boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <GripVertical size={16} color="#2563eb" />
                <strong style={{ fontSize: 14 }}>
                  {activeDragItem.placeName}
                </strong>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default PlanDetail;
