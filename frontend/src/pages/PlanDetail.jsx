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
  CloudSun,
  Download,
  Eye,
  GripVertical,
  Printer,
  MapPin,
  Save,
  Trash2,
  X,
  Search,
  RotateCcw,
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
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const DEFAULT_START_TIME = "09:00";

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

const getStableItemKey = (item) =>
  item.id ?? item.itemId ?? item.planItemId ?? null;

const normalizeItems = (items = []) =>
  [...items]
    .map((item, idx) => {
      const stableKey = getStableItemKey(item);
      return {
        ...item,
        _uiId:
          item._uiId ||
          (stableKey != null ? `item-${stableKey}` : createUiId()),
        dayNumber: Number(item.dayNumber || 1),
        visitOrder: Number(item.visitOrder ?? idx + 1),
        stayMinutes: Number(item.stayMinutes ?? 60),
        latitude: toNumber(item.latitude ?? item.lat),
        longitude: toNumber(item.longitude ?? item.lng),
      };
    })
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
          <div
            style={{ ...S.flexRow, marginTop: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
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

const DayDropContainer = ({
  dayNumber,
  children,
  itemIds,
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
  const [dayRoutePriority, setDayRoutePriority] = useState({});
  const [routeFares, setRouteFares] = useState({});

  // 💡 검색 및 검색 결과용 상태
  const [mapSearchKeyword, setMapSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // A4 출력 / 이미지 / PDF 내보내기
  const printContainerRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);

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
    setDayRoutePriority(data?.dayRoutePriority || {});
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
    async (items, priorityMapOverride) => {
      const priorityMap = priorityMapOverride ?? dayRoutePriority;
      const requestId = ++routeRequestIdRef.current;
      const grouped = groupItemsByDay(items);
      try {
        const dayNumbers = Object.keys(grouped)
          .map(Number)
          .sort((a, b) => a - b);
        const newSections = [],
          newPaths = {};
        const newFares = {};

        for (const dayNumber of dayNumbers) {
          if (requestId !== routeRequestIdRef.current) return;
          const priority = priorityMap?.[dayNumber] || "RECOMMEND";
          const dayItems = grouped[dayNumber] || [];
          if (dayItems.length <= 1) {
            newPaths[dayNumber] = [];
            newFares[dayNumber] = 0;
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
            newFares[dayNumber] = 0;
            continue;
          }

          const requestPayload = {
            origin,
            destination,
            waypoints,
            priority: priority === "FREE" ? "RECOMMEND" : priority,
            car_fuel: "GASOLINE",
          };

          if (priority === "FREE") {
            requestPayload.avoid = ["toll"];
          }

          const res = await axiosInstance.post(
            "/api/plans/route",
            requestPayload,
          );
          const route = res?.data?.routes?.[0];
          if (!route) {
            newPaths[dayNumber] = [];
            newFares[dayNumber] = 0;
            continue;
          }
          newFares[dayNumber] =
            priority === "FREE" ? 0 : route.summary?.fare?.toll || 0;

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
        setRouteFares(newFares);
      } catch (e) {
        if (requestId !== routeRequestIdRef.current) return;
        setRouteSections([]);
        setRoutePathsByDay({});
        setRouteFares({});
      }
    },
    [extractRoutePath, dayRoutePriority],
  );

  const fetchPlanDetail = useCallback(async () => {
    if (!planId) return;
    try {
      setLoading(true);
      setError("");
      const res = await axiosInstance.get(`/api/plans/${planId}`);
      setPlan(res?.data);
      initEditState(res?.data);
      await loadRoadRoutesByDay(
        normalizeItems(res?.data?.items || []),
        res?.data?.dayRoutePriority || {},
      );
    } catch (err) {
      setError("여행 일정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [planId, initEditState, loadRoadRoutesByDay]);

  useEffect(() => {
    fetchPlanDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const currentItems = editItems;
  const itemsByDay = useMemo(
    () => groupItemsByDay(currentItems),
    [currentItems],
  );

  const dayNumbers = useMemo(() => {
    const count = calculateDayCount(editStartDate, editEndDate);
    const itemDays = Object.keys(itemsByDay)
      .map(Number)
      .filter(Number.isFinite);
    return Array.from(
      {
        length: Math.max(count, itemDays.length ? Math.max(...itemDays) : 1, 1),
      },
      (_, i) => i + 1,
    );
  }, [itemsByDay, editStartDate, editEndDate]);

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

  // 💡 검색된 장소를 특정 Day 일정에 추가하는 공통 함수
  const addSearchedItemToSchedule = useCallback(
    (place) => {
      const lat = Number(place.y ?? place.latitude ?? place.lat);
      const lng = Number(place.x ?? place.longitude ?? place.lng);
      if (!isFinite(lat) || !isFinite(lng)) return;

      const targetDay = Number(selectedDayForMap || 1);
      const placeName =
        place.place_name || place.placeName || place.name || "선택된 장소";
      const address =
        place.road_address_name || place.address_name || place.address || "";

      // 중복 체크 (위도, 경도가 같은 경우)
      const duplicated = editItems.some(
        (item) =>
          Number(item.dayNumber || 1) === targetDay &&
          Math.abs(Number(item.latitude) - lat) < 1e-6 &&
          Math.abs(Number(item.longitude) - lng) < 1e-6,
      );

      if (duplicated) {
        alert(`이미 DAY ${targetDay} 일정에 포함된 장소입니다.`);
        setSelectedPlaceForMap({ lat, lng, placeName });
        return;
      }

      const uiId = createUiId();
      const newItem = {
        _uiId: uiId,
        placeName,
        address,
        latitude: lat,
        longitude: lng,
        dayNumber: targetDay,
        visitOrder:
          editItems.filter((i) => Number(i.dayNumber || 1) === targetDay)
            .length + 1,
        stayMinutes: 60,
      };

      setEditItems((prev) => normalizeVisitOrders([...prev, newItem]));
      setSelectedPlaceForMap({ lat, lng, placeName, uiId });
      setSearchResults([]);
      setMapSearchKeyword("");
      alert(`DAY ${targetDay} 일정에 '${placeName}'이(가) 추가되었습니다.`);
    },
    [selectedDayForMap, editItems],
  );

  // 💡 지도 검색 실행 핸들러
  const handleMapSearch = useCallback(
    (e) => {
      e?.preventDefault();
      if (!mapSearchKeyword.trim()) return;

      if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
        setIsSearching(true);
        const ps = new window.kakao.maps.services.Places();
        ps.keywordSearch(mapSearchKeyword.trim(), (data, status) => {
          setIsSearching(false);
          if (status === window.kakao.maps.services.Status.OK) {
            setSearchResults(data);
            if (data.length > 0) {
              const first = data[0];
              setSelectedPlaceForMap({
                lat: Number(first.y),
                lng: Number(first.x),
                placeName: first.place_name,
              });
            }
          } else {
            setSearchResults([]);
            alert("검색 결과가 없습니다.");
          }
        });
      } else {
        alert("카카오 지도 서비스가 로드되지 않았습니다.");
      }
    },
    [mapSearchKeyword],
  );

  const handlePlaceSelectFromMap = useCallback(
    (place) => {
      if (!place) return;
      const lat = Number(place.latitude ?? place.lat ?? place.y),
        lng = Number(place.longitude ?? place.lng ?? place.x);
      if (!isFinite(lat) || !isFinite(lng)) return;

      const placeName = place.placeName || place.name || place.place_name || "";
      const address =
        place.address || place.road_address_name || place.address_name || "";

      setSelectedPlaceForMap({
        lat,
        lng,
        placeName,
        uiId: place.uiId || null,
      });

      // 💡 지도 클릭 또는 지도 위 "현재 화면 검색/카테고리" 결과 클릭 시
      // 확인 후 지명 + 주소를 함께 일정에 추가
      if (place.source === "map-click" || place.source === "filter-search") {
        if (
          window.confirm(
            `'${placeName || "이 장소"}'를 DAY ${selectedDayForMap} 일정에 추가하시겠습니까?`,
          )
        ) {
          addSearchedItemToSchedule({ ...place, address });
        }
      }
    },
    [selectedDayForMap, addSearchedItemToSchedule],
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
    if (editItems.length === 0) return;
    const timer = setTimeout(() => loadRoadRoutesByDay(editItems), 400);
    return () => clearTimeout(timer);
  }, [editItems, loadRoadRoutesByDay]);

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

  const getTotalTravelSeconds = useCallback(
    (schedule = []) =>
      schedule.reduce(
        (sum, s) => sum + Number(s.routeSection?.duration || 0),
        0,
      ),
    [],
  );

  const dayTravelTotals = useMemo(() => {
    const totals = {};
    dayNumbers.forEach((dayNum) => {
      totals[dayNum] = getTotalTravelSeconds(scheduleByDay[dayNum] || []);
    });
    return totals;
  }, [dayNumbers, scheduleByDay, getTotalTravelSeconds]);

  const getTravelerName = useCallback(() => {
    const directName =
      plan?.travelerName ||
      plan?.traveler?.name ||
      plan?.traveler?.nickname ||
      plan?.userName ||
      plan?.username ||
      plan?.nickname ||
      plan?.memberName ||
      plan?.member?.name ||
      plan?.member?.nickname ||
      plan?.user?.name ||
      plan?.user?.nickname ||
      plan?.user?.username;

    if (directName) return String(directName);

    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const user = JSON.parse(raw);
        const localName =
          user?.nickname || user?.name || user?.username || user?.userName;
        if (localName) return String(localName);
      }
    } catch {}

    return "여행자";
  }, [plan]);

  const getPlanStartDate = useCallback(() => {
    return (
      editStartDate ||
      plan?.startDate ||
      plan?.start_date ||
      plan?.tripStartDate ||
      plan?.tripStart ||
      plan?.departureDate ||
      plan?.fromDate ||
      ""
    );
  }, [editStartDate, plan]);

  const getPlanEndDate = useCallback(() => {
    return (
      editEndDate ||
      plan?.endDate ||
      plan?.end_date ||
      plan?.tripEndDate ||
      plan?.tripEnd ||
      plan?.arrivalDate ||
      plan?.toDate ||
      ""
    );
  }, [editEndDate, plan]);

  const formatPrintDate = useCallback((value, withYear = false) => {
    if (!value) return "";
    const text = String(value).slice(0, 10);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return String(value);

    const [, year, month, day] = match;
    return withYear
      ? `${year}.${month}.${day}`
      : `${Number(month)}월 ${Number(day)}일`;
  }, []);

  const getPrintWeekday = useCallback((value) => {
    if (!value) return "";
    const text = String(value).slice(0, 10);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "";

    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
    );
    if (Number.isNaN(date.getTime())) return "";

    return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  }, []);

  const getPrintDayDate = useCallback(
    (dayNumber) => {
      const startDate = getPlanStartDate();
      if (!startDate) return "";

      const text = String(startDate).slice(0, 10);
      const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return "";

      const date = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
      );
      if (Number.isNaN(date.getTime())) return "";

      date.setDate(date.getDate() + Number(dayNumber || 1) - 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    },
    [getPlanStartDate],
  );

  const getPrintDayTitle = useCallback((dayNumber, dayItems = []) => {
    const explicitTitle =
      dayItems.find((item) => item?.dayTitle)?.dayTitle ||
      dayItems.find((item) => item?.dayName)?.dayName ||
      dayItems.find((item) => item?.dayDescription)?.dayDescription;

    if (explicitTitle) return String(explicitTitle);

    const names = dayItems
      .map((item) => String(item?.placeName || "").trim())
      .filter(Boolean);
    const text = names.join(" ");

    if (/제주|애월|성산|서귀포|우도|한림/.test(text)) {
      return dayNumber === 1 ? "제주 주요 관광지 탐방" : "제주 지역 여행";
    }
    if (/서울|경복궁|명동|홍대|강남|한강|북촌|잠실/.test(text)) {
      return dayNumber === 1 ? "서울 주요 관광지 탐방" : "서울 도심 여행";
    }
    if (/부산|해운대|광안리|태종대|감천/.test(text)) {
      return dayNumber === 1 ? "부산 주요 관광지 탐방" : "부산 해안 여행";
    }
    if (/경주|불국사|첨성대|황리단길/.test(text)) {
      return dayNumber === 1 ? "경주 역사문화 탐방" : "경주 여행";
    }
    if (/여수|오동도|돌산|향일암/.test(text)) {
      return dayNumber === 1 ? "여수 주요 관광지 탐방" : "여수 여행";
    }

    const firstName = names[0];
    if (firstName) return `${firstName} 중심 여행`;
    return "여행 일정";
  }, []);

  const getPrintTime = useCallback((time) => {
    if (!time) return "";
    const [h, m] = String(time).split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return String(time);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }, []);

  const printDays = useMemo(() => {
    return dayNumbers.map((dayNumber) => {
      const rawItems = itemsByDay[dayNumber] || [];
      const schedule = scheduleByDay[dayNumber] || [];
      const dateValue = getPrintDayDate(dayNumber);

      return {
        dayNumber,
        title: getPrintDayTitle(dayNumber, rawItems),
        date: formatPrintDate(dateValue),
        weekday: getPrintWeekday(dateValue),
        items: schedule,
        totalTravelSeconds: getTotalTravelSeconds(schedule),
      };
    });
  }, [
    dayNumbers,
    itemsByDay,
    scheduleByDay,
    getPrintDayDate,
    getPrintDayTitle,
    formatPrintDate,
    getPrintWeekday,
    getTotalTravelSeconds,
  ]);

  const printPages = useMemo(() => {
    const pages = [];
    let current = [];
    let estimatedHeight = 150;
    const PAGE_LIMIT = 1030;

    printDays.forEach((day) => {
      const dayHeight = 88 + Math.max(day.items.length, 1) * 62;

      if (current.length > 0 && estimatedHeight + dayHeight > PAGE_LIMIT) {
        pages.push(current);
        current = [];
        estimatedHeight = 150;
      }

      current.push(day);
      estimatedHeight += dayHeight + 20;
    });

    if (current.length > 0) pages.push(current);
    return pages.length ? pages : [[]];
  }, [printDays]);

  const exportPageToCanvas = useCallback(async (pageElement) => {
    if (!pageElement) throw new Error("출력 영역을 찾을 수 없습니다.");
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));

    return html2canvas(pageElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#f8fafc",
      logging: false,
      imageTimeout: 15000,
      windowWidth: 794,
      windowHeight: 1123,
    });
  }, []);

  const safeFileName = useCallback((name) => {
    return (
      String(name || "travel-plan")
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100) || "travel-plan"
    );
  }, []);

  const handleExportImage = useCallback(async () => {
    if (exporting) return;
    const pages =
      printContainerRef.current?.querySelectorAll(".travel-print-page");
    if (!pages?.length) {
      alert("이미지로 출력할 일정이 없습니다.");
      return;
    }

    try {
      setExporting(true);
      const baseName = safeFileName(plan?.title || "여행 일정표");

      for (let i = 0; i < pages.length; i += 1) {
        const canvas = await exportPageToCanvas(pages[i]);
        const link = document.createElement("a");
        link.download =
          pages.length === 1
            ? `${baseName}.png`
            : `${baseName}_Page_${i + 1}.png`;
        link.href = canvas.toDataURL("image/png", 1.0);
        link.click();
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    } catch (e) {
      console.error("이미지 출력 오류:", e);
      alert("이미지 생성에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }, [exporting, plan?.title, safeFileName, exportPageToCanvas]);

  const handleExportPdf = useCallback(async () => {
    if (exporting) return;
    const pages =
      printContainerRef.current?.querySelectorAll(".travel-print-page");
    if (!pages?.length) {
      alert("PDF로 출력할 일정이 없습니다.");
      return;
    }

    try {
      setExporting(true);
      const baseName = safeFileName(plan?.title || "여행 일정표");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      for (let i = 0; i < pages.length; i += 1) {
        const canvas = await exportPageToCanvas(pages[i]);
        const imageData = canvas.toDataURL("image/jpeg", 0.95);

        if (i > 0) pdf.addPage("a4", "portrait");
        pdf.addImage(imageData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }

      pdf.save(`${baseName}.pdf`);
    } catch (e) {
      console.error("PDF 출력 오류:", e);
      alert("PDF 생성에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }, [exporting, plan?.title, safeFileName, exportPageToCanvas]);

  const handlePrint = useCallback(() => {
    if (exporting) return;
    window.print();
  }, [exporting]);

  const handleOpenPreview = useCallback(() => {
    if (exporting) return;
    setPreviewPageIndex(0);
    setPreviewOpen(true);
  }, [exporting]);

  const handleClosePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewPageIndex(0);
  }, []);

  const handlePreviewPrevious = useCallback((event) => {
    event?.preventDefault();
    event?.stopPropagation();
    setPreviewPageIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handlePreviewNext = useCallback(
    (event) => {
      event?.preventDefault();
      event?.stopPropagation();
      setPreviewPageIndex((prev) =>
        Math.min(Math.max(printPages.length - 1, 0), prev + 1),
      );
    },
    [printPages.length],
  );

  useEffect(() => {
    if (!previewOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClosePreview();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPreviewPageIndex((prev) => Math.max(0, prev - 1));
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setPreviewPageIndex((prev) =>
          Math.min(Math.max(printPages.length - 1, 0), prev + 1),
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [previewOpen, printPages.length, handleClosePreview]);

  const handleRevert = useCallback(() => {
    if (!plan) return;
    if (!window.confirm("저장하지 않은 변경사항을 모두 되돌리시겠습니까?")) {
      return;
    }
    initEditState(plan);
    setSelectedPlaceForMap(null);
  }, [plan, initEditState]);

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
        dayRoutePriority: dayRoutePriority,
      });
      alert("저장되었습니다.");
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
    dayRoutePriority,
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
        .travel-detail { width: 100%; max-width: 1500px; margin: 0 auto; padding: 25px 20px 50px; box-sizing: border-box; overflow-x: hidden; }
        .travel-detail-header { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
        .travel-detail-header-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .travel-back-button { width: 38px; height: 38px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .travel-detail-title { margin: 0; font-size: 25px; font-weight: 800; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .travel-detail-title-input { width: min(500px, 100%); font-size: 24px; font-weight: 800; border: 1px solid #d1d5db; border-radius: 7px; padding: 5px 8px; outline: none; }
        .travel-detail-date { display: flex; align-items: center; gap: 8px; margin-top: 5px; color: #6b7280; font-size: 13px; }
        .travel-detail-date input { max-width: 145px; border: 1px solid #d1d5db; border-radius: 6px; padding: 5px 7px; }
        .travel-detail-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
        .travel-export-buttons { display: flex; gap: 6px; flex-wrap: wrap; }
        .travel-preview-backdrop { position: fixed; inset: 0; z-index: 999999; background: rgba(15, 23, 42, 0.82); display: flex; flex-direction: column; isolation: isolate; }
        .travel-preview-toolbar { min-height: 64px; padding: 10px 16px; box-sizing: border-box; background: #ffffff; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; position: relative; z-index: 2; }
        .travel-preview-toolbar-left, .travel-preview-toolbar-right { display: flex; align-items: center; gap: 8px; }
        .travel-preview-title { font-size: 14px; font-weight: 800; color: #111827; }
        .travel-preview-page-count { font-size: 12px; color: #6b7280; margin-right: 4px; }
        .travel-preview-nav-button { width: 34px; height: 34px; border: 1px solid #d1d5db; border-radius: 7px; background: #fff; color: #374151; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .travel-preview-export-button { height: 34px; padding: 0 11px; border: 1px solid #dbeafe; border-radius: 7px; background: #eff6ff; color: #1d4ed8; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .travel-preview-close { border: 1px solid #d1d5db; border-radius: 7px; padding: 8px 12px; background: #fff; cursor: pointer; font-weight: 700; color: #374151; }
        .travel-preview-content { flex: 1; overflow: auto; padding: 24px; box-sizing: border-box; display: flex; justify-content: center; align-items: flex-start; }
        .travel-preview-sheet { width: 794px; min-width: 794px; transform-origin: top center; box-shadow: 0 12px 40px rgba(0,0,0,.28); }
        .travel-preview-sheet .travel-print-page { position: relative !important; left: auto !important; top: auto !important; width: 794px !important; height: 1123px !important; min-height: 1123px !important; margin: 0 !important; box-sizing: border-box !important; }
        .travel-preview-sheet .travel-print-page:last-child { page-break-after: auto !important; }
        
        .travel-detail-grid { display: grid; grid-template-columns: minmax(0, 1.85fr) minmax(320px, 1fr); gap: 20px; align-items: start; }
        .travel-map-wrapper { position: sticky; top: 15px; height: 650px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; overflow: hidden; display: flex; flex-direction: column; }
        .travel-map-toolbar { width: 100%; min-height: 54px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #fff; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; z-index: 10; flex-wrap: wrap; }
        
        .travel-map-search-box { display: flex; align-items: center; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 2px 8px; gap: 6px; }
        .travel-map-search-input { border: none; background: transparent; outline: none; font-size: 13px; color: #111827; padding: 4px 0; width: 140px; }
        .travel-map-search-btn { background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 4px 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; }

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

        .travel-print-container { position: fixed; left: -100000px; top: 0; width: 794px; z-index: -1; pointer-events: none; }
        .travel-print-page { width: 794px; min-height: 1123px; box-sizing: border-box; padding: 42px 48px 38px; background: #f8fafc; color: #111827; font-family: Arial, sans-serif; display: flex; flex-direction: column; overflow: hidden; }
        .travel-print-header { position: relative; overflow: hidden; padding: 34px 34px 28px; border-radius: 22px; color: #fff; background: linear-gradient(135deg, #2563eb 0%, #3b82f6 55%, #60a5fa 100%); box-shadow: 0 12px 28px rgba(37, 99, 235, 0.16); }
        .travel-print-brand { font-size: 12px; font-weight: 800; letter-spacing: 5px; opacity: 0.95; margin-bottom: 13px; }
        .travel-print-main-title { font-size: 30px; line-height: 1.25; font-weight: 900; }
        .travel-print-meta { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 15px; font-size: 12px; font-weight: 600; opacity: 0.96; }
        .travel-print-days { display: flex; flex-direction: column; gap: 18px; margin-top: 20px; flex: 1; }
        .travel-print-day-card { overflow: hidden; border: 1px solid #e5e7eb; border-radius: 16px; background: #fff; box-shadow: 0 3px 10px rgba(15, 23, 42, 0.04); }
        .travel-print-day-header { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 14px 18px; background: linear-gradient(90deg, #eff6ff 0%, #f8fafc 100%); border-bottom: 1px solid #e5e7eb; }
        .travel-print-day-title { color: #1e40af; font-size: 15px; font-weight: 900; }
        .travel-print-day-date { color: #64748b; font-size: 12px; font-weight: 700; }
        .travel-print-items { padding: 7px 18px 8px; }
        .travel-print-item { display: grid; grid-template-columns: 58px minmax(0, 1fr) 72px; align-items: center; gap: 12px; min-height: 56px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .travel-print-time { display: flex; align-items: center; justify-content: center; min-height: 28px; padding: 0 7px; border-radius: 7px; background: #dbeafe; color: #1d4ed8; font-size: 11px; font-weight: 900; }
        .travel-print-place-name { color: #111827; font-size: 13px; font-weight: 800; }
        .travel-print-address { margin-top: 3px; color: #94a3b8; font-size: 10px; }
        .travel-print-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 17px; color: #94a3b8; font-size: 9px; font-weight: 700; }

        @media (max-width: 900px) {
          .travel-detail-grid { grid-template-columns: 1fr; gap: 16px; }
          .travel-map-wrapper { position: relative; top: 0; height: 460px; }
        }

        @media (max-width: 640px) {
          .travel-detail { padding: 16px 12px 40px; }
          .travel-detail-header { gap: 10px; margin-bottom: 14px; }
          .travel-detail-actions { width: 100%; justify-content: flex-start; }
          .travel-export-buttons { width: 100%; }
          .travel-export-button { flex: 1 1 auto; justify-content: center; }
          .travel-detail-title { font-size: 19px; max-width: 100%; }
          .travel-detail-title-input { font-size: 17px; }
          .travel-detail-date { flex-wrap: wrap; row-gap: 6px; font-size: 12px; }
          .travel-detail-date input { max-width: 128px; font-size: 12px; }

          .travel-map-wrapper { height: 380px; border-radius: 10px; }
          .travel-map-toolbar { flex-direction: column; align-items: stretch; gap: 8px; padding: 8px; }
          .travel-map-toolbar > * { width: 100%; }
          .travel-map-search-box { width: 100%; box-sizing: border-box; }
          .travel-map-search-input { flex: 1; width: auto; }
          .travel-map-day-selector { max-width: 100%; }

          .travel-weather { padding: 10px 12px; margin-bottom: 12px; }
          .travel-weather-inner { flex-wrap: wrap; }
          .travel-day-header { padding: 10px 12px; flex-wrap: wrap; row-gap: 4px; }
          .travel-day-title { font-size: 14px; }

          .travel-preview-toolbar { flex-wrap: wrap; height: auto; min-height: 56px; gap: 8px 6px; padding: 8px 10px; }
          .travel-preview-toolbar-left { flex-wrap: wrap; }
          .travel-preview-content { padding: 12px; }
          .travel-preview-sheet { zoom: 0.62; }
        }

        @media (max-width: 420px) {
          .travel-map-wrapper { height: 320px; }
          .travel-detail-title { font-size: 17px; }
          .travel-map-search-input { font-size: 12px; }
          .travel-preview-sheet { zoom: 0.42; }
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
            <input
              className="travel-detail-title-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="여행 제목"
            />
            <div className="travel-detail-date">
              <CalendarDays size={14} />
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
            </div>
          </div>
        </div>

        <div className="travel-detail-actions">
          <div className="travel-export-buttons">
            <button
              type="button"
              className="travel-export-button preview-button"
              onClick={handleOpenPreview}
              disabled={exporting}
              style={{
                ...S.btnBase,
                border: "1px solid #dbeafe",
                background: exporting ? "#f1f5f9" : "#eff6ff",
                color: "#1d4ed8",
                cursor: exporting ? "default" : "pointer",
              }}
            >
              <Eye size={15} />
              미리보기
            </button>
            <button
              type="button"
              className="travel-export-button"
              onClick={handlePrint}
              disabled={exporting}
              style={{
                ...S.btnBase,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#374151",
                cursor: exporting ? "default" : "pointer",
              }}
            >
              <Printer size={15} />
              인쇄
            </button>
          </div>
          <button
            type="button"
            onClick={handleRevert}
            style={{
              ...S.btnBase,
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#374151",
            }}
          >
            <RotateCcw size={15} />
            되돌리기
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
              <form
                onSubmit={handleMapSearch}
                className="travel-map-search-box"
              >
                <Search size={14} color="#6b7280" />
                <input
                  type="text"
                  className="travel-map-search-input"
                  placeholder="장소 검색..."
                  value={mapSearchKeyword}
                  onChange={(e) => setMapSearchKeyword(e.target.value)}
                />
                <button
                  type="submit"
                  className="travel-map-search-btn"
                  disabled={isSearching}
                >
                  {isSearching ? "검색중" : "검색"}
                </button>
              </form>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Car size={14} color="#6b7280" />
                <span
                  style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}
                >
                  DAY {selectedDayForMap}
                </span>
                <select
                  value={dayRoutePriority[selectedDayForMap] || "RECOMMEND"}
                  onChange={(e) => {
                    const val = e.target.value;
                    const next = {
                      ...dayRoutePriority,
                      [selectedDayForMap]: val,
                    };
                    setDayRoutePriority(next);
                    loadRoadRoutesByDay(currentItems, next);
                  }}
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: 12,
                    background: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <option value="RECOMMEND">추천 경로 (유료 포함)</option>
                  <option value="FREE">무료 우선 도로</option>
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 13,
                  color: "#4b5563",
                }}
              >
                <div>
                  통행료:{" "}
                  <strong style={{ color: "#111827" }}>
                    {routeFares[selectedDayForMap] !== undefined
                      ? `${routeFares[selectedDayForMap].toLocaleString()}원`
                      : "계산 중..."}
                  </strong>
                </div>
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

            {/* 💡 검색 결과 목록 및 [일정 추가] 버튼 */}
            {searchResults.length > 0 && (
              <div
                style={{
                  background: "#f8fafc",
                  borderBottom: "1px solid #e5e7eb",
                  padding: "8px 12px",
                  maxHeight: "150px",
                  overflowY: "auto",
                  fontSize: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "4px",
                  }}
                >
                  <span style={{ fontWeight: "bold", color: "#4b5563" }}>
                    검색 결과 (DAY {selectedDayForMap} 일정에 추가):
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchResults([])}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#9ca3af",
                      fontSize: "11px",
                    }}
                  >
                    닫기
                  </button>
                </div>
                {searchResults.map((resItem, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      cursor: "pointer",
                      borderRadius: "6px",
                      background: "#fff",
                      marginBottom: "4px",
                      border: "1px solid #e2e8f0",
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      // 지도에 위치를 먼저 표시하고, 곧바로 선택된 Day 일정에 추가
                      setSelectedPlaceForMap({
                        lat: Number(resItem.y),
                        lng: Number(resItem.x),
                        placeName: resItem.place_name,
                      });
                      addSearchedItemToSchedule(resItem);
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                      <div
                        style={{
                          fontWeight: "bold",
                          color: "#111827",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {resItem.place_name}
                      </div>
                      <div
                        style={{
                          color: "#64748b",
                          fontSize: "11px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {resItem.road_address_name || resItem.address_name}
                      </div>
                    </div>
                    <span
                      style={{
                        background: "#2563eb",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "5px 10px",
                        fontSize: "11px",
                        fontWeight: "700",
                        flexShrink: 0,
                      }}
                    >
                      선택하여 추가
                    </span>
                  </div>
                ))}
              </div>
            )}

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
                    <div
                      style={{
                        ...S.flexRow,
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#059669",
                      }}
                    >
                      <Car size={13} />총 이동시간{" "}
                      {formatDuration(dayTravelTotals[dayNum] || 0, true)}
                    </div>
                  </div>
                  <DayDropContainer
                    dayNumber={dayNum}
                    itemIds={dayItems.map((i) => i._uiId)}
                    onDaySelect={handleDaySelect}
                    isSelected={selected}
                  >
                    {schedule.map((s, idx) => (
                      <SortablePlanItem
                        key={s.item._uiId}
                        item={s.item}
                        index={idx}
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

        {/* 프린트 및 미리보기 모달 구역 */}
        <div
          ref={printContainerRef}
          className="travel-print-container"
          aria-hidden="true"
        >
          {printPages.map((pageDays, pageIndex) => (
            <div className="travel-print-page" key={`print-page-${pageIndex}`}>
              {pageIndex === 0 && (
                <div className="travel-print-header">
                  <div className="travel-print-brand">
                    T R A V E L M A K E R
                  </div>
                  <div className="travel-print-main-title">
                    {plan?.title || "여행 일정표"}
                  </div>
                  <div className="travel-print-meta">
                    <span>
                      📅 기간: {formatPrintDate(getPlanStartDate(), true)}
                      {" ~ "}
                      {formatPrintDate(getPlanEndDate(), true)}
                    </span>
                    <span>여행자: {getTravelerName()} 님</span>
                  </div>
                </div>
              )}

              <div className="travel-print-days">
                {pageDays.map((day) => (
                  <div
                    className="travel-print-day-card"
                    key={`print-day-${day.dayNumber}`}
                  >
                    <div className="travel-print-day-header">
                      <div className="travel-print-day-title">
                        DAY {day.dayNumber} - {day.title}
                        <span style={{ color: "#059669", fontWeight: 700 }}>
                          {" "}
                          · 총 이동시간{" "}
                          {formatDuration(day.totalTravelSeconds || 0, true)}
                        </span>
                      </div>
                      <div className="travel-print-day-date">
                        {day.date} {day.weekday ? `(${day.weekday})` : ""}
                      </div>
                    </div>

                    <div className="travel-print-items">
                      {day.items.length > 0 ? (
                        day.items.map((scheduleItem, index) => (
                          <div
                            className="travel-print-item"
                            key={`print-item-${day.dayNumber}-${scheduleItem.item?._uiId || index}`}
                          >
                            <div className="travel-print-time">
                              {getPrintTime(scheduleItem.arrivalTime)}
                            </div>
                            <div className="travel-print-place">
                              <div className="travel-print-place-name">
                                {scheduleItem.item?.placeName || "장소"}
                              </div>
                              <div className="travel-print-address">
                                {scheduleItem.item?.address || "주소 정보 없음"}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="travel-print-empty">
                          등록된 일정이 없습니다.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="travel-print-footer">
                <span>TravelMaker - {plan?.title || "여행 일정표"}</span>
                <span>
                  Page {pageIndex + 1} / {printPages.length}
                </span>
              </div>
            </div>
          ))}
        </div>

        {previewOpen && (
          <div
            className="travel-preview-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="여행 일정표 미리보기"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault();
                handleClosePreview();
              }
            }}
          >
            <div
              className="travel-preview-toolbar"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="travel-preview-toolbar-left">
                <Eye size={17} color="#2563eb" />
                <span className="travel-preview-title">
                  여행 일정표 미리보기
                </span>
                <span className="travel-preview-page-count">
                  {previewPageIndex + 1} / {printPages.length} 페이지
                </span>
              </div>
              <div className="travel-preview-toolbar-right">
                <button
                  type="button"
                  className="travel-preview-export-button"
                  onClick={handleExportImage}
                  disabled={exporting}
                >
                  <Download size={14} />
                  {exporting ? "생성 중..." : "이미지"}
                </button>
                <button
                  type="button"
                  className="travel-preview-export-button"
                  onClick={handleExportPdf}
                  disabled={exporting}
                >
                  <Download size={14} />
                  PDF
                </button>
                <button
                  type="button"
                  className="travel-preview-nav-button"
                  onClick={handlePreviewPrevious}
                  disabled={previewPageIndex === 0}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="travel-preview-nav-button"
                  onClick={handlePreviewNext}
                  disabled={previewPageIndex >= printPages.length - 1}
                >
                  ›
                </button>
                <button
                  type="button"
                  className="travel-preview-close"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClosePreview();
                  }}
                >
                  <X size={15} />
                  닫기
                </button>
              </div>
            </div>

            <div
              className="travel-preview-content"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="travel-preview-sheet">
                {printPages[previewPageIndex] && (
                  <div className="travel-print-page">
                    {previewPageIndex === 0 && (
                      <div className="travel-print-header">
                        <div className="travel-print-brand">
                          T R A V E L M A K E R
                        </div>
                        <div className="travel-print-main-title">
                          {plan?.title || "여행 일정표"}
                        </div>
                        <div className="travel-print-meta">
                          <span>
                            📅 기간: {formatPrintDate(getPlanStartDate(), true)}
                            {" ~ "}
                            {formatPrintDate(getPlanEndDate(), true)}
                          </span>
                          <span>여행자: {getTravelerName()} 님</span>
                        </div>
                      </div>
                    )}

                    <div className="travel-print-days">
                      {printPages[previewPageIndex].map((day) => (
                        <div
                          className="travel-print-day-card"
                          key={`preview-day-${day.dayNumber}`}
                        >
                          <div className="travel-print-day-header">
                            <div className="travel-print-day-title">
                              DAY {day.dayNumber} - {day.title}
                              <span
                                style={{ color: "#059669", fontWeight: 700 }}
                              >
                                {" "}
                                · 총 이동시간{" "}
                                {formatDuration(
                                  day.totalTravelSeconds || 0,
                                  true,
                                )}
                              </span>
                            </div>
                            <div className="travel-print-day-date">
                              {day.date} {day.weekday ? `(${day.weekday})` : ""}
                            </div>
                          </div>
                          <div className="travel-print-items">
                            {day.items.length > 0 ? (
                              day.items.map((scheduleItem, index) => (
                                <div
                                  className="travel-print-item"
                                  key={`preview-item-${day.dayNumber}-${scheduleItem.item?._uiId || index}`}
                                >
                                  <div className="travel-print-time">
                                    {getPrintTime(scheduleItem.arrivalTime)}
                                  </div>
                                  <div className="travel-print-place">
                                    <div className="travel-print-place-name">
                                      {scheduleItem.item?.placeName || "장소"}
                                    </div>
                                    <div className="travel-print-address">
                                      {scheduleItem.item?.address ||
                                        "주소 정보 없음"}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="travel-print-empty">
                                등록된 일정이 없습니다.
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="travel-print-footer">
                      <span>TravelMaker - {plan?.title || "여행 일정표"}</span>
                      <span>
                        Page {previewPageIndex + 1} / {printPages.length}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
