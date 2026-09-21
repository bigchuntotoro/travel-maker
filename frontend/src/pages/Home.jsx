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
  CreditCard,
  Search,
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
    justifyContent: "center",
    gap: 6,
    padding: "9px 13px",
    borderRadius: 8,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  card: { border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" },
};

const createUiId = () =>
  `ui-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : null);

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
    .forEach((day) => {
      dayMap.get(day).forEach((item, index) => {
        result.push({ ...item, dayNumber: day, visitOrder: index + 1 });
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
  Object.keys(grouped).forEach((day) =>
    grouped[day].sort((a, b) => (a.visitOrder || 0) - (b.visitOrder || 0)),
  );
  return grouped;
};

const formatDuration = (mins, isSec = false) => {
  const minutes = isSec
    ? Math.round((Number(mins) || 0) / 60)
    : Number(mins) || 0;
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain === 0 ? `${hours}시간` : `${hours}시간 ${remain}분`;
};

const formatDistance = (meter) =>
  Number(meter) < 1000
    ? `${Math.round(meter)}m`
    : `${(Number(meter) / 1000).toFixed(1)}km`;

const formatPrice = (price) => {
  if (!price || Number(price) === 0) return "무료";
  return `${Number(price).toLocaleString()}원`;
};

const timeToMins = (time) => {
  if (!time) return 0;
  const [h, m] = String(time).split(":").map(Number);
  return h * 60 + m;
};
const minsToTime = (mins) =>
  `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

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
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="이동"
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
              alignItems: "flex-start",
              gap: 5,
              color: "#6b7280",
              fontSize: 12,
              marginBottom: 5,
              lineHeight: 1.4,
            }}
          >
            <MapPin size={13} style={{ flexShrink: 0, marginTop: 1 }} />
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 6,
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
              체류 {formatDuration(item.stayMinutes)}
            </span>
          </div>
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
                <span style={{ color: "#6b7280" }}>
                  · {formatDistance(routeSection.distance)}
                </span>
              )}
              {routeSection.tollFare > 0 && (
                <span style={{ color: "#d97706", marginLeft: 4 }}>
                  · 통행료 {formatPrice(routeSection.tollFare)}
                </span>
              )}
            </div>
          )}
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
              {STAY_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  체류 {formatDuration(m)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onRemove(item._uiId)}
              aria-label="삭제"
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

const Home = () => {
  const navigate = useNavigate();
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [items, setItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [routePathsByDay, setRoutePathsByDay] = useState({});
  const [routeSections, setRouteSections] = useState([]);
  const [routePriority, setRoutePriority] = useState("RECOMMEND"); // RECOMMEND(추천), FREE(무료우선) 등
  const routeRequestIdRef = useRef(0);
  const [selectedDayForMap, setSelectedDayForMap] = useState(1);
  const [selectedPlaceForMap, setSelectedPlaceForMap] = useState(null);
  const [activeDragId, setActiveDragId] = useState(null);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // 일자별 총 요금 계산 요약 상태 추가
  const [dayTollFares, setDayTollFares] = useState({});

  // 💡 지도 장소 검색 관련 상태
  const [mapSearchKeyword, setMapSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

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
    const val = e.target.value;
    setStartDate(val);
    if (endDate && val > endDate) setEndDate(val);
  };

  const dayNumbers = useMemo(() => {
    if (!startDate || !endDate) return [1];
    const diff = Math.floor(
      (new Date(`${endDate}T00:00:00`) - new Date(`${startDate}T00:00:00`)) /
        86400000,
    );
    const count = Math.max(diff + 1, 1);
    const maxItemDay = Math.max(
      ...items.map((i) => Number(i.dayNumber || 1)),
      1,
    );
    return Array.from({ length: Math.max(count, maxItemDay) }, (_, i) => i + 1);
  }, [startDate, endDate, items]);

  useEffect(() => {
    if (!dayNumbers.includes(selectedDayForMap)) {
      setSelectedDayForMap(dayNumbers[0] || 1);
      setSelectedPlaceForMap(null);
    }
  }, [dayNumbers, selectedDayForMap]);

  const normalizedCurrentItems = useMemo(() => normalizeItems(items), [items]);
  const itemsByDay = useMemo(
    () => groupItemsByDay(normalizedCurrentItems),
    [normalizedCurrentItems],
  );
  const selectedDayItems = itemsByDay[selectedDayForMap] || [];
  const selectedRoutePath = routePathsByDay[selectedDayForMap] || [];

  const extractRoutePath = (sections = []) => {
    const path = [];
    sections.forEach((s) =>
      (s?.roads || []).forEach((r) => {
        const v = r?.vertexes || [];
        for (let i = 0; i < v.length - 1; i += 2) {
          const lng = Number(v[i]),
            lat = Number(v[i + 1]);
          if (Number.isFinite(lat) && Number.isFinite(lng))
            path.push({ lat, lng });
        }
      }),
    );
    return path;
  };

  const loadRoadRoutesByDay = useCallback(
    async (currentItems, priorityOption) => {
      const requestId = ++routeRequestIdRef.current;
      const grouped = groupItemsByDay(currentItems);
      const days = Object.keys(grouped)
        .map(Number)
        .sort((a, b) => a - b);
      const newSections = [],
        newPaths = {};
      const newFares = {};

      if (days.length === 0) {
        setRouteSections([]);
        setRoutePathsByDay({});
        setDayTollFares({});
        return;
      }

      for (const dayNumber of days) {
        if (requestId !== routeRequestIdRef.current) return;
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
        const waypoints = dayItems.slice(1, -1).map((i) => ({
          name: i.placeName || "경유지",
          x: Number(i.longitude),
          y: Number(i.latitude),
        }));

        try {
          const res = await axiosInstance.post("/api/plans/route", {
            origin,
            destination,
            waypoints,
            priority: priorityOption, // 유료/무료 옵션 반영
            car_fuel: "GASOLINE",
          });
          const route = res?.data?.routes?.[0];
          if (!route) {
            newPaths[dayNumber] = [];
            newFares[dayNumber] = 0;
            continue;
          }
          const sections = route.sections || [];
          newPaths[dayNumber] = extractRoutePath(sections);

          let dayTotalToll = 0;
          sections.forEach((sec, idx) => {
            const fromItem = dayItems[idx],
              toItem = dayItems[idx + 1];
            const tollFare = Number(
              sec.tollFare || route.summary?.fare?.toll || 0,
            );
            dayTotalToll += tollFare;

            if (fromItem && toItem) {
              newSections.push({
                dayNumber,
                fromUiId: fromItem._uiId,
                toUiId: toItem._uiId,
                duration: Number(sec.duration || 0),
                distance: Number(sec.distance || 0),
                tollFare: Number(sec.tollFare || 0),
              });
            }
          });
          newFares[dayNumber] = route.summary?.fare?.toll ?? dayTotalToll;
        } catch (err) {
          newPaths[dayNumber] = [];
          newFares[dayNumber] = 0;
        }
      }
      if (requestId !== routeRequestIdRef.current) return;
      setRouteSections(newSections);
      setRoutePathsByDay(newPaths);
      setDayTollFares(newFares);
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(
      () => loadRoadRoutesByDay(normalizedCurrentItems, routePriority),
      350,
    );
    return () => clearTimeout(timer);
  }, [normalizedCurrentItems, routePriority, loadRoadRoutesByDay]);

  const fetchWeatherForSelectedDay = useCallback(async (dayItems) => {
    if (!dayItems.length || !Number.isFinite(Number(dayItems[0].latitude))) {
      setWeatherInfo(null);
      return;
    }
    setWeatherLoading(true);
    setTimeout(() => {
      setWeatherInfo({
        temperature: "22°C",
        description: "맑음",
        locationName: dayItems[0].placeName || "해당 지역",
      });
      setWeatherLoading(false);
    }, 100);
  }, []);

  useEffect(() => {
    fetchWeatherForSelectedDay(selectedDayItems);
  }, [selectedDayForMap, selectedDayItems, fetchWeatherForSelectedDay]);

  const handleDaySelect = (dayNumber) => {
    setSelectedDayForMap(Number(dayNumber));
    setSelectedPlaceForMap(null);
  };

  const handlePlaceSelectFromMap = (placeInfo) => {
    if (!placeInfo) return;
    const lat = Number(placeInfo.latitude ?? placeInfo.lat);
    const lng = Number(placeInfo.longitude ?? placeInfo.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (!placeInfo.address && window.kakao?.maps?.services) {
      new window.kakao.maps.services.Geocoder().coord2Address(
        lng,
        lat,
        (result, status) => {
          const address =
            status === window.kakao.maps.services.Status.OK
              ? result[0]?.road_address?.address_name ||
                result[0]?.address?.address_name ||
                ""
              : "";
          addPlaceItem({
            ...placeInfo,
            latitude: lat,
            longitude: lng,
            address,
          });
        },
      );
    } else {
      addPlaceItem({ ...placeInfo, latitude: lat, longitude: lng });
    }
  };

  const addPlaceItem = (placeInfo) => {
    const lat = Number(placeInfo.latitude),
      lng = Number(placeInfo.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const duplicate = selectedDayItems.some(
      (i) =>
        Math.abs(Number(i.latitude) - lat) < 0.000001 &&
        Math.abs(Number(i.longitude) - lng) < 0.000001,
    );
    if (duplicate) {
      setSelectedPlaceForMap({
        lat,
        lng,
        placeName: placeInfo.placeName || "선택된 장소",
      });
      return;
    }

    const newItem = {
      _uiId: createUiId(),
      dayNumber: selectedDayForMap,
      placeName: placeInfo.placeName || "선택된 장소",
      address: placeInfo.address || "",
      latitude: lat,
      longitude: lng,
      visitOrder: selectedDayItems.length + 1,
      stayMinutes: 60,
    };
    setItems((prev) => normalizeVisitOrders([...prev, newItem]));
    setSelectedPlaceForMap({ lat, lng, placeName: newItem.placeName });
  };

  // 💡 검색 결과 장소를 선택된 DAY 일정에 바로 추가
  const addSearchedItemToSchedule = (place) => {
    const lat = Number(place.y ?? place.latitude ?? place.lat);
    const lng = Number(place.x ?? place.longitude ?? place.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const placeName =
      place.place_name || place.placeName || place.name || "선택된 장소";
    const address =
      place.road_address_name || place.address_name || place.address || "";

    addPlaceItem({ placeName, address, latitude: lat, longitude: lng });
    setSearchResults([]);
    setMapSearchKeyword("");
  };

  // 💡 지도 장소 검색 실행
  const handleMapSearch = (e) => {
    e?.preventDefault();
    if (!mapSearchKeyword.trim()) return;

    if (window.kakao?.maps?.services) {
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
  };

  const handleRemoveItem = (uiId) => {
    setItems((prev) =>
      normalizeVisitOrders(prev.filter((i) => i._uiId !== uiId)),
    );
    if (selectedPlaceForMap?.uiId === uiId) setSelectedPlaceForMap(null);
  };

  const handleStayChange = (uiId, minutes) => {
    setItems((prev) =>
      prev.map((i) => (i._uiId === uiId ? { ...i, stayMinutes: minutes } : i)),
    );
  };

  const handleDragStart = (e) => setActiveDragId(String(e.active.id));
  const handleDragCancel = () => setActiveDragId(null);
  const handleDragEnd = (e) => {
    const { active, over } = e;
    setActiveDragId(null);
    if (!over) return;
    const activeId = String(active.id),
      overId = String(over.id);

    setItems((prev) => {
      const current = [...prev];
      const activeIdx = current.findIndex((i) => String(i._uiId) === activeId);
      if (activeIdx === -1) return prev;
      const activeItem = current[activeIdx];

      if (overId.startsWith("day-")) {
        const targetDay = Number(overId.replace("day-", ""));
        if (Number(activeItem.dayNumber) === targetDay) return prev;
        const remaining = current.filter((i) => String(i._uiId) !== activeId);
        return normalizeVisitOrders([
          ...remaining,
          { ...activeItem, dayNumber: targetDay },
        ]);
      }

      const overIdx = current.findIndex((i) => String(i._uiId) === overId);
      if (overIdx === -1) return prev;
      const targetDay = Number(current[overIdx].dayNumber || 1);
      const remaining = current.filter((i) => String(i._uiId) !== activeId);
      const targetIdx = remaining.findIndex((i) => String(i._uiId) === overId);
      if (targetIdx === -1) return prev;

      remaining.splice(targetIdx, 0, { ...activeItem, dayNumber: targetDay });
      return normalizeVisitOrders(remaining);
    });
  };

  const scheduleByDay = useMemo(() => {
    const result = {};
    dayNumbers.forEach((dayNumber) => {
      let curMins = timeToMins(DEFAULT_START_TIME);
      result[dayNumber] = (itemsByDay[dayNumber] || []).map((item) => {
        const arrMins = curMins,
          depMins = arrMins + Number(item.stayMinutes || 60);
        const section = routeSections.find(
          (s) => Number(s.dayNumber) === dayNumber && s.fromUiId === item._uiId,
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

  const handleSubmitPlan = async () => {
    if (!title.trim()) return alert("여행 제목을 입력해 주세요.");
    if (!startDate || !endDate) return alert("여행 기간을 설정해 주세요.");
    if (startDate > endDate)
      return alert("종료일이 시작일보다 빠를 수 없습니다.");
    if (items.length === 0)
      return alert("최소 하나 이상의 장소를 추가해 주세요.");
    if (!user.userId) return navigate("/login");

    const cleanItems = normalizeVisitOrders(items).map(
      ({ _uiId, ...rest }) => rest,
    );
    try {
      setIsSubmitting(true);
      const res = await createPlan({
        userId: user.userId,
        title: title.trim(),
        startDate,
        endDate,
        items: cleanItems,
      });
      alert(`성공적으로 저장되었습니다!`);
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
    <>
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { width: 100%; min-height: 100%; margin: 0; padding: 0; }
        .travel-home { width: 100%; max-width: 1500px; margin: 0 auto; padding: 25px 20px 50px; }
        .travel-header { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 15px; }
        .travel-header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .travel-basic-info { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; padding: 16px; flex-wrap: wrap; }
        .travel-main-grid { display: grid; grid-template-columns: minmax(0, 1.85fr) minmax(320px, 1fr); gap: 20px; align-items: start; }
        .travel-map-wrapper { position: sticky; top: 15px; height: 680px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; overflow: hidden; display: flex; flex-direction: column; }
        .travel-map-toolbar { width: 100%; min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; background: #fff; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
        .travel-map-search-box { display: flex; align-items: center; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 2px 8px; gap: 6px; flex: 1; min-width: 160px; }
        .travel-map-search-input { border: none; background: transparent; outline: none; font-size: 13px; color: #111827; padding: 6px 0; width: 100%; }
        .travel-map-search-btn { background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
        .travel-map-day-selector { display: flex; align-items: center; gap: 5px; max-width: calc(100% - 90px); overflow-x: auto; scrollbar-width: none; }
        .travel-map-content { position: relative; flex: 1; min-height: 0; width: 100%; overflow: hidden; }
        .travel-weather { margin-bottom: 16px; padding: 12px 16px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 12px; display: flex; justify-content: space-between; }
        .travel-day-section { margin-bottom: 14px; }
        .travel-day-header { display: flex; align-items: center; justify-content: space-between; padding: 11px 13px; border-radius: 10px 10px 0 0; cursor: pointer; }
        @media (max-width: 768px) {
          .travel-main-grid { grid-template-columns: 1fr; }
          .travel-map-wrapper { position: relative; height: 430px; }
          .travel-basic-info { flex-direction: column; }
        }
      `}</style>

      <div className="travel-home">
        <header className="travel-header">
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
            <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
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

        <div className="travel-basic-info" style={S.card}>
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
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, flex: 1.5 }}
          >
            <CalendarDays size={16} color="#6b7280" />
            <input
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              style={{
                padding: "9px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                width: "100%",
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
                width: "100%",
              }}
            />
          </div>

          {/* 경로 탐색 옵션 (유료/무료 도로 선택) 추가 */}
          <div
            style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}
          >
            <Car size={16} color="#6b7280" />
            <select
              value={routePriority}
              onChange={(e) => setRoutePriority(e.target.value)}
              style={{
                padding: "9px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                width: "100%",
                background: "#fff",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <option value="RECOMMEND">🚗 추천 경로 (유료/무료 혼합)</option>
              <option value="FREE">🛣️ 무료 도로 우선</option>
              <option value="TIME">⚡ 최단 시간 우선</option>
              <option value="DISTANCE">📏 최단 거리 우선</option>
            </select>
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
            }}
          >
            <Plus size={16} />
            {isSubmitting ? "저장 중..." : "일정 저장"}
          </button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <div className="travel-main-grid">
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
                <div className="travel-map-day-selector">
                  {dayNumbers.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleDaySelect(d)}
                      style={{
                        border: "none",
                        borderRadius: 7,
                        padding: "7px 11px",
                        background:
                          selectedDayForMap === d ? "#2563eb" : "#f3f4f6",
                        color: selectedDayForMap === d ? "#fff" : "#374151",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      DAY {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* 💡 검색 결과 목록 (클릭하면 바로 선택된 DAY 일정에 추가) */}
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
                      onClick={() => addSearchedItemToSchedule(resItem)}
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
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e40af",
                      }}
                    >
                      DAY {selectedDayForMap} 날씨 정보
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}
                    >
                      {weatherLoading
                        ? "불러오는 중..."
                        : weatherInfo
                          ? `${weatherInfo.locationName} · ${weatherInfo.temperature} (${weatherInfo.description})`
                          : "등록된 장소 없음"}
                    </div>
                  </div>
                </div>
              </div>

              {dayNumbers.map((d) => {
                const dayItems = itemsByDay[d] || [];
                const schedule = scheduleByDay[d] || [];
                const totalToll = dayTollFares[d] || 0;

                return (
                  <div key={d} className="travel-day-section">
                    <div
                      className="travel-day-header"
                      onClick={() => handleDaySelect(d)}
                      style={{
                        background:
                          selectedDayForMap === d ? "#eff6ff" : "#f3f4f6",
                        border:
                          selectedDayForMap === d
                            ? "1px solid #bfdbfe"
                            : "1px solid #e5e7eb",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color:
                            selectedDayForMap === d ? "#2563eb" : "#111827",
                        }}
                      >
                        DAY {d} ({dayItems.length}개 장소)
                      </div>

                      {/* 일자별 예상 통행료 표시 */}
                      {dayItems.length > 1 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 12,
                            fontWeight: 700,
                            color: totalToll > 0 ? "#d97706" : "#4b5563",
                          }}
                        >
                          <CreditCard size={14} />
                          <span>예상 통행료: {formatPrice(totalToll)}</span>
                        </div>
                      )}
                    </div>
                    <DayDropContainer
                      dayNumber={d}
                      itemIds={dayItems.map((i) => i._uiId)}
                      onDaySelect={handleDaySelect}
                      isSelected={selectedDayForMap === d}
                    >
                      {schedule.map((s, idx) => (
                        <SortablePlanItem
                          key={s.item._uiId}
                          item={s.item}
                          index={idx}
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
