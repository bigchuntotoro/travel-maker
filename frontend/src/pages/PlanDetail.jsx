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
  Download,
  Image as ImageIcon,
  Eye,
} from "lucide-react";

// 📦 PDF 및 이미지 출력을 위한 라이브러리 임포트
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const DEFAULT_START_TIME = "09:00";
const STAY_OPTIONS = [30, 60, 90, 120, 150, 180, 240];
const CATEGORY_FILTERS = [
  { label: "맛집", code: "FD6" },
  { label: "카페", code: "CE7" },
  { label: "관광지", code: "AT4" },
  { label: "숙소", code: "AD5" },
  { label: "쇼핑", code: "MT1" },
];
// ============================================================
// DAY 자동 제목 분석
//
// 장소명 + 주소 + 카카오 카테고리를 기준으로 각 DAY의
// 대표 지역과 여행 테마를 자동으로 분석합니다.
// 외부 AI API를 사용하지 않는 로컬 분석 방식이라 즉시 반영됩니다.
// ============================================================

const DAY_REGION_PRIORITY = [
  // 서울 세부 지역을 먼저 검사해서 "서울"보다 "종로", "성수" 등이 우선되도록 합니다.
  "종로",
  "북촌",
  "서촌",
  "인사동",
  "광화문",
  "명동",
  "을지로",
  "성수",
  "뚝섬",
  "서울숲",
  "연남",
  "홍대",
  "합정",
  "망원",
  "마포",
  "강남",
  "서초",
  "잠실",
  "송파",
  "여의도",
  "용산",
  "이태원",
  "한남",
  "성북",
  "부산",
  "해운대",
  "광안리",
  "서면",
  "남포동",
  "제주",
  "애월",
  "서귀포",
  "경주",
  "전주",
  "강릉",
  "속초",
  "인천",
  "수원",
  "판교",
  "분당",
  "대전",
  "대구",
  "광주",
  "울산",
  "서울",
];

const DAY_THEME_DEFINITIONS = {
  역사문화: {
    label: "역사·문화",
    keywords: [
      "경복궁",
      "창덕궁",
      "덕수궁",
      "창경궁",
      "궁",
      "한옥",
      "북촌",
      "서촌",
      "인사동",
      "전통",
      "박물관",
      "미술관",
      "문화",
      "성곽",
      "유적",
      "사찰",
      "절",
      "기념관",
      "역사",
    ],
  },
  자연힐링: {
    label: "자연·힐링",
    keywords: [
      "공원",
      "서울숲",
      "한강",
      "호수",
      "산",
      "숲",
      "해변",
      "바다",
      "해수욕장",
      "폭포",
      "정원",
      "수목원",
      "둘레길",
      "산책",
      "자연",
      "유원지",
    ],
  },
  맛집미식: {
    label: "미식",
    keywords: [
      "맛집",
      "식당",
      "레스토랑",
      "갈비",
      "국밥",
      "냉면",
      "삼겹살",
      "고기",
      "횟집",
      "초밥",
      "스시",
      "한식",
      "중식",
      "일식",
      "치킨",
      "분식",
      "시장",
      "광장시장",
      "남대문시장",
      "망원시장",
      "곱창",
      "족발",
      "국수",
      "카레",
      "파스타",
      "버거",
      "베트남",
      "태국",
      "이탈리안",
    ],
  },
  카페감성: {
    label: "카페·감성",
    keywords: [
      "카페",
      "커피",
      "베이커리",
      "디저트",
      "브런치",
      "로스터리",
      "성수",
      "연남",
      "익선동",
      "티하우스",
      "케이크",
      "도넛",
    ],
  },
  쇼핑도심: {
    label: "쇼핑·도심",
    keywords: [
      "백화점",
      "쇼핑",
      "몰",
      "스타필드",
      "코엑스",
      "롯데월드몰",
      "타임스퀘어",
      "아울렛",
      "시장",
      "마트",
      "상점",
      "로드",
      "플래그십",
      "면세점",
    ],
  },
  관광체험: {
    label: "관광·체험",
    keywords: [
      "타워",
      "전망대",
      "랜드",
      "월드",
      "테마파크",
      "놀이공원",
      "체험",
      "전시",
      "공연",
      "아쿠아리움",
      "동물원",
      "식물원",
      "전망",
      "관광",
      "박람회",
    ],
  },
};

const DAY_CATEGORY_THEME_MAP = {
  FD6: "맛집미식",
  CE7: "카페감성",
  AT4: "관광체험",
  MT1: "쇼핑도심",
};

const normalizeDayAnalysisText = (value = "") =>
  String(value)
    .replace(/\\([^)]*\\)/g, " ")
    .replace(/[|,]/g, " ")
    .replace(/\\s+/g, " ")
    .trim()
    .toLowerCase();

const getDayRegion = (items = []) => {
  const regionScores = {};

  items.forEach((item, index) => {
    const text = normalizeDayAnalysisText(
      `${item?.placeName || ""} ${item?.address || ""}`,
    );

    DAY_REGION_PRIORITY.forEach((region, regionIndex) => {
      if (!text.includes(region.toLowerCase())) return;

      // 주소에 실제로 등장하는 지역을 우선하고, 앞쪽 장소일수록 약간 가중합니다.
      const specificityBonus = Math.max(0, 12 - regionIndex * 0.15);
      const orderBonus = Math.max(0, 3 - index * 0.25);
      regionScores[region] =
        (regionScores[region] || 0) + specificityBonus + orderBonus;
    });
  });

  const bestRegion = Object.entries(regionScores).sort(
    ([regionA, scoreA], [regionB, scoreB]) =>
      scoreB - scoreA ||
      DAY_REGION_PRIORITY.indexOf(regionA) -
        DAY_REGION_PRIORITY.indexOf(regionB),
  )[0]?.[0];

  if (bestRegion) return bestRegion;

  // 지역 키워드가 없는 경우 주소의 시/구 단위에서 보조 추출합니다.
  const firstAddress = normalizeDayAnalysisText(items[0]?.address || "");
  const tokens = firstAddress.split(" ").filter(Boolean);
  const fallback = tokens.find(
    (token) =>
      token.endsWith("시") || token.endsWith("군") || token.endsWith("구"),
  );

  return fallback || "";
};

const getDayThemeScores = (items = []) => {
  const scores = Object.fromEntries(
    Object.keys(DAY_THEME_DEFINITIONS).map((theme) => [theme, 0]),
  );

  items.forEach((item, itemIndex) => {
    const placeName = normalizeDayAnalysisText(item?.placeName || "");
    const address = normalizeDayAnalysisText(item?.address || "");
    const categoryGroupCode = String(
      item?.categoryGroupCode || item?.category_group_code || "",
    ).toUpperCase();
    const categoryName = normalizeDayAnalysisText(
      item?.categoryName || item?.category_name || item?.category || "",
    );

    const fullText = `${placeName} ${address} ${categoryName}`;
    const orderWeight = itemIndex === 0 ? 1.15 : 1;

    Object.entries(DAY_THEME_DEFINITIONS).forEach(([theme, definition]) => {
      definition.keywords.forEach((keyword) => {
        const normalizedKeyword = keyword.toLowerCase();
        if (fullText.includes(normalizedKeyword)) {
          scores[theme] += orderWeight;
        }
      });
    });

    const categoryTheme = DAY_CATEGORY_THEME_MAP[categoryGroupCode];
    if (categoryTheme) scores[categoryTheme] += 3.5;

    // 카테고리명이 있는 기존 데이터도 최대한 활용합니다.
    if (categoryName.includes("음식") || categoryName.includes("식당")) {
      scores.맛집미식 += 2.5;
    }
    if (categoryName.includes("카페") || categoryName.includes("커피")) {
      scores.카페감성 += 2.5;
    }
    if (categoryName.includes("관광") || categoryName.includes("명소")) {
      scores.관광체험 += 2.5;
    }
    if (categoryName.includes("쇼핑")) {
      scores.쇼핑도심 += 2.5;
    }
  });

  return scores;
};

const getDayThemeTitle = (items = []) => {
  if (!items.length) {
    return { region: "", title: "여행 일정", theme: "" };
  }

  const region = getDayRegion(items);
  const scores = getDayThemeScores(items);
  const sortedThemes = Object.entries(scores).sort(
    ([themeA, scoreA], [themeB, scoreB]) =>
      scoreB - scoreA || themeA.localeCompare(themeB),
  );

  const [topTheme = "", topScore = 0] = sortedThemes[0] || [];
  const [secondTheme = "", secondScore = 0] = sortedThemes[1] || [];

  // 점수가 낮거나 특정 테마가 압도적이지 않은 경우에도 자연스러운 제목을 만듭니다.
  const meaningfulThemes = sortedThemes.filter(([, score]) => score > 0);
  let themeTitle = "도심 여행";

  if (meaningfulThemes.length === 0) {
    themeTitle = "알찬 여행";
  } else if (
    topTheme === "역사문화" &&
    secondTheme === "맛집미식" &&
    secondScore >= Math.max(1.5, topScore * 0.35)
  ) {
    themeTitle = "역사·문화 & 미식 여행";
  } else if (
    topTheme === "자연힐링" &&
    secondTheme === "카페감성" &&
    secondScore >= Math.max(1.5, topScore * 0.35)
  ) {
    themeTitle = "자연·카페 감성 여행";
  } else if (
    topTheme === "쇼핑도심" &&
    secondTheme === "맛집미식" &&
    secondScore >= Math.max(1.5, topScore * 0.35)
  ) {
    themeTitle = "도심·쇼핑 & 미식 여행";
  } else if (
    topTheme === "관광체험" &&
    secondTheme === "자연힐링" &&
    secondScore >= Math.max(1.5, topScore * 0.35)
  ) {
    themeTitle = "관광·자연 체험 여행";
  } else if (
    topTheme === "카페감성" &&
    secondTheme === "맛집미식" &&
    secondScore >= Math.max(1.5, topScore * 0.35)
  ) {
    themeTitle = "카페·미식 감성 여행";
  } else {
    themeTitle = DAY_THEME_DEFINITIONS[topTheme]?.label
      ? `${DAY_THEME_DEFINITIONS[topTheme].label} 여행`
      : "도심 여행";
  }

  return {
    region,
    title: region ? `${region} ${themeTitle}` : themeTitle,
    theme: topTheme,
  };
};

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

const optimizeSingleDay = (dayItems, externalStart = null) => {
  if (!externalStart) {
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
  }

  if (!dayItems || dayItems.length < 2) return [...(dayItems || [])];
  const withExternalStart = (route) => [externalStart, ...route];

  if (dayItems.length <= 8) {
    let bestRoute = [...dayItems],
      bestDistance = calculatePathDistance(withExternalStart(bestRoute));
    generatePermutations(dayItems).forEach((perm) => {
      const dist = calculatePathDistance(withExternalStart(perm));
      if (dist < bestDistance) {
        bestDistance = dist;
        bestRoute = perm;
      }
    });
    return bestRoute;
  }

  const unvisited = [...dayItems],
    result = [];
  let current = externalStart;
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

const optimizeItemsByDay = (items = [], startLocationsByDay = {}) => {
  const grouped = groupItemsByDay(items);
  const optimized = [];
  Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((dayNumber) => {
      const startLoc = startLocationsByDay?.[dayNumber];
      const externalStart = startLoc
        ? { latitude: startLoc.lat, longitude: startLoc.lng }
        : null;
      optimizeSingleDay(grouped[dayNumber] || [], externalStart).forEach(
        (item, idx) => {
          optimized.push({ ...item, dayNumber, visitOrder: idx + 1 });
        },
      );
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
        {isEditing && (
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
        )}
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
  const [searchCategory, setSearchCategory] = useState("");
  const [selectedPlaceForMap, setSelectedPlaceForMap] = useState(null);
  const [routePathsByDay, setRoutePathsByDay] = useState({});
  const [routeSections, setRouteSections] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const routeRequestIdRef = useRef(0);
  const [selectedDayForMap, setSelectedDayForMap] = useState(1);
  const [activeDragId, setActiveDragId] = useState(null);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const optimizationBeforeRef = useRef(null);
  const [optimizationResultByDay, setOptimizationResultByDay] = useState({});
  const optimizationBeforeByDayRef = useRef({});
  const [currentLocationByDay, setCurrentLocationByDay] = useState({});
  const [locatingDayNum, setLocatingDayNum] = useState(null);

  // ✨ 미리보기 화면 자체를 이미지/PDF의 원본으로 사용합니다.
  const previewRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const waitForPreviewRender = async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => setTimeout(resolve, 80));
  };

  const capturePreviewCanvas = async () => {
    if (!previewRef.current) {
      throw new Error("미리보기 영역을 찾을 수 없습니다.");
    }

    await waitForPreviewRender();

    const element = previewRef.current;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    });

    if (!canvas.width || !canvas.height) {
      throw new Error("미리보기 캔버스가 비어 있습니다.");
    }

    return canvas;
  };

  const handleDownloadImage = async () => {
    try {
      setIsExporting(true);
      const canvas = await capturePreviewCanvas();
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `${plan?.title || "여행일정"}.png`;
      link.click();
    } catch (err) {
      console.error("❌ 이미지 저장 실패:", err);
      alert(
        `이미지 저장 중 오류가 발생했습니다.\
\
${err?.message || "알 수 없는 오류"}`,
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true);
      console.log("📄 A4 PDF 생성 시작");

      const canvas = await capturePreviewCanvas();
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 8;
      const marginY = 8;
      const contentWidth = pageWidth - marginX * 2;
      const contentHeight = pageHeight - marginY * 2;
      const scale = contentWidth / canvas.width;
      const pageCanvasHeight = Math.max(1, Math.floor(contentHeight / scale));

      let offsetY = 0;
      let pageNumber = 0;

      while (offsetY < canvas.height) {
        pageNumber += 1;
        const currentHeight = Math.min(
          pageCanvasHeight,
          canvas.height - offsetY,
        );

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = currentHeight;

        const context = pageCanvas.getContext("2d");
        if (!context) {
          throw new Error("PDF 페이지 캔버스를 생성할 수 없습니다.");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        context.drawImage(
          canvas,
          0,
          offsetY,
          canvas.width,
          currentHeight,
          0,
          0,
          canvas.width,
          currentHeight,
        );

        const pageImage = pageCanvas.toDataURL("image/jpeg", 0.95);
        const renderedHeight = currentHeight * scale;

        if (pageNumber > 1) pdf.addPage();

        pdf.addImage(
          pageImage,
          "JPEG",
          marginX,
          marginY,
          contentWidth,
          renderedHeight,
          undefined,
          "FAST",
        );

        offsetY += currentHeight;
      }

      const totalPages = pdf.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        pdf.setPage(page);
        pdf.setFontSize(8);
        pdf.setTextColor(107, 114, 128);
        pdf.text(
          `TravelMaker - ${plan?.title || "여행 일정표"}`,
          marginX,
          pageHeight - 3.5,
        );
        pdf.text(
          `Page ${page} of ${totalPages}`,
          pageWidth - marginX,
          pageHeight - 3.5,
          { align: "right" },
        );
      }

      pdf.save(`${plan?.title || "여행일정"}.pdf`);
      console.log(`📄 PDF 생성 완료: ${totalPages}페이지`);
    } catch (err) {
      console.error("❌ PDF 저장 실패:", err);
      alert(
        `PDF 저장 중 오류가 발생했습니다.\
\
${err?.message || "알 수 없는 오류"}`,
      );
    } finally {
      setIsExporting(false);
    }
  };

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
    setCurrentLocationByDay({});
    setLocatingDayNum(null);
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

  const loadRoadRoutesByDay = useCallback(
    async (items, startLocationsByDay = {}) => {
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
          const startLoc = startLocationsByDay?.[dayNumber];

          const routeChainItems = startLoc
            ? [
                {
                  _uiId: `current-location-${dayNumber}`,
                  placeName: "현재 위치",
                  latitude: startLoc.lat,
                  longitude: startLoc.lng,
                  isCurrentLocation: true,
                },
                ...dayItems,
              ]
            : dayItems;

          if (routeChainItems.length < 2) {
            newPaths[dayNumber] = [];
            continue;
          }

          const first = routeChainItems[0],
            last = routeChainItems[routeChainItems.length - 1],
            middle = routeChainItems.slice(1, -1);
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
            const fromItem = routeChainItems[idx],
              toItem = routeChainItems[idx + 1];
            if (!fromItem || !toItem) return;
            newSections.push({
              dayNumber,
              fromUiId: fromItem._uiId,
              toUiId: toItem._uiId,
              from: fromItem,
              to: toItem,
              duration: Number(section.duration || 0),
              distance: Number(section.distance || 0),
              isFromCurrentLocation: !!fromItem.isCurrentLocation,
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

        const pendingDayKeys = Object.keys(optimizationBeforeByDayRef.current);
        if (pendingDayKeys.length > 0) {
          const resolvedDays = pendingDayKeys.map(Number);
          setOptimizationResultByDay((prev) => {
            const next = { ...prev };
            resolvedDays.forEach((dayNumber) => {
              const beforeSec =
                Number(optimizationBeforeByDayRef.current[dayNumber]) || 0;
              const afterSec = newSections
                .filter((s) => Number(s.dayNumber) === dayNumber)
                .reduce((acc, s) => acc + Number(s.duration || 0), 0);
              next[dayNumber] = {
                beforeSeconds: beforeSec,
                afterSeconds: afterSec,
                savedSeconds: Math.max(0, beforeSec - afterSec),
              };
            });
            return next;
          });
          optimizationBeforeByDayRef.current = {};
        }
      } catch (err) {
        if (requestId !== routeRequestIdRef.current) return;
        setRouteSections([]);
        setRoutePathsByDay({});
      } finally {
        if (requestId === routeRequestIdRef.current) setRouteLoading(false);
      }
    },
    [],
  );

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

  const dayTitles = useMemo(() => {
    const result = {};
    dayNumbers.forEach((dayNum) => {
      result[dayNum] = getDayThemeTitle(itemsByDay[dayNum] || []);
    });
    return result;
  }, [dayNumbers, itemsByDay]);

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
      categoryGroupCode:
        place.categoryGroupCode || place.category_group_code || "",
      categoryName:
        place.categoryName || place.category_name || place.category || "",
      dayNumber: targetDay,
      visitOrder: 1,
      stayMinutes: 60,
    };

    setOptimizationResult(null);
    optimizationBeforeRef.current = null;
    setOptimizationResultByDay((prev) => {
      const next = { ...prev };
      delete next[targetDay];
      return next;
    });
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

    setOptimizationResultByDay({});
    optimizationBeforeByDayRef.current = {};

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
    const optimizedItems = optimizeItemsByDay(editItems, currentLocationByDay);

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
    setOptimizationResultByDay({});
    optimizationBeforeByDayRef.current = {};
    setEditItems(optimizedItems);
  };

  const handleOptimizeSingleDay = (dayNum) => {
    if (!isEditing) return;
    const targetDay = Number(dayNum);
    const dayItems = itemsByDay[targetDay] || [];
    const startLoc = currentLocationByDay[targetDay];
    const externalStart = startLoc
      ? { latitude: startLoc.lat, longitude: startLoc.lng }
      : null;
    const minItemsRequired = externalStart ? 2 : 3;

    if (dayItems.length < minItemsRequired) {
      return alert(
        `DAY ${targetDay}에는 최소 ${minItemsRequired}개 이상의 장소가 필요합니다.`,
      );
    }

    const beforeSec = routeSections
      .filter((s) => Number(s.dayNumber) === targetDay)
      .reduce((acc, s) => acc + Number(s.duration || 0), 0);

    const optimizedDayItems = optimizeSingleDay(dayItems, externalStart);

    const currentOrder = dayItems.map((i) => i._uiId);
    const optimizedOrder = optimizedDayItems.map((i) => i._uiId);
    if (
      currentOrder.length === optimizedOrder.length &&
      currentOrder.every((id, idx) => id === optimizedOrder[idx])
    ) {
      setOptimizationResultByDay((prev) => ({
        ...prev,
        [targetDay]: {
          beforeSeconds: beforeSec,
          afterSeconds: beforeSec,
          savedSeconds: 0,
        },
      }));
      return alert(
        `DAY ${targetDay}의 현재 경로가 이미 최적 경로에 가깝습니다.`,
      );
    }

    optimizationBeforeByDayRef.current = {
      ...optimizationBeforeByDayRef.current,
      [targetDay]: beforeSec,
    };
    setOptimizationResultByDay((prev) => ({
      ...prev,
      [targetDay]: {
        beforeSeconds: beforeSec,
        afterSeconds: null,
        savedSeconds: null,
      },
    }));

    setEditItems((prev) => {
      const others = prev.filter((i) => Number(i.dayNumber || 1) !== targetDay);
      return normalizeVisitOrders([...others, ...optimizedDayItems]);
    });
  };

  const handleToggleCurrentLocationStart = (dayNum) => {
    if (!isEditing) return;
    const targetDay = Number(dayNum);

    if (currentLocationByDay[targetDay]) {
      setCurrentLocationByDay((prev) => {
        const next = { ...prev };
        delete next[targetDay];
        return next;
      });
      setOptimizationResultByDay((prev) => {
        const next = { ...prev };
        delete next[targetDay];
        return next;
      });
      return;
    }

    if (!navigator.geolocation) {
      return alert("이 브라우저에서는 위치 정보를 사용할 수 없습니다.");
    }

    setLocatingDayNum(targetDay);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocatingDayNum(null);
        setCurrentLocationByDay((prev) => ({
          ...prev,
          [targetDay]: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        }));
        setOptimizationResultByDay((prev) => {
          const next = { ...prev };
          delete next[targetDay];
          return next;
        });
      },
      () => {
        setLocatingDayNum(null);
        alert(
          "현재 위치를 가져오지 못했습니다. 위치 접근 권한을 확인해주세요.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  useEffect(() => {
    if (!isEditing || editItems.length === 0) return;
    const timer = setTimeout(
      () => loadRoadRoutesByDay(editItems, currentLocationByDay),
      250,
    );
    return () => clearTimeout(timer);
  }, [editItems, isEditing, loadRoadRoutesByDay, currentLocationByDay]);

  const handleStayMinutesChange = (uiId, minutes) => {
    setOptimizationResult(null);
    optimizationBeforeRef.current = null;
    setOptimizationResultByDay({});
    optimizationBeforeByDayRef.current = {};
    setEditItems((prev) =>
      prev.map((i) => (i._uiId === uiId ? { ...i, stayMinutes: minutes } : i)),
    );
  };

  const handleRemoveItem = (uiId) => {
    setOptimizationResult(null);
    optimizationBeforeRef.current = null;
    setOptimizationResultByDay({});
    optimizationBeforeByDayRef.current = {};
    setEditItems((prev) =>
      normalizeVisitOrders(prev.filter((i) => i._uiId !== uiId)),
    );
  };

  const handleSearch = (categoryCode = searchCategory) => {
    const keyword = searchKeyword.trim();
    if (!keyword || !window.kakao?.maps?.services)
      return alert("카카오 지도 SDK 로딩 전입니다.");
    setIsSearching(true);
    const options = categoryCode ? { category_group_code: categoryCode } : {};
    new window.kakao.maps.services.Places().keywordSearch(
      keyword,
      (data, status) => {
        setIsSearching(false);
        setSearchResults(
          status === window.kakao.maps.services.Status.OK ? data || [] : [],
        );
      },
      options,
    );
  };

  const handleCategoryFilterClick = (code) => {
    const nextCode = searchCategory === code ? "" : code;
    setSearchCategory(nextCode);

    if (!nextCode) {
      setSearchResults([]);
      return;
    }
    if (searchKeyword.trim()) handleSearch(nextCode);
  };

  const handleAddSearchPlace = (place) => {
    setOptimizationResult(null);
    optimizationBeforeRef.current = null;
    setOptimizationResultByDay({});
    optimizationBeforeByDayRef.current = {};
    const newItem = {
      _uiId: createUiId(),
      placeName: place.place_name,
      address: place.road_address_name || place.address_name || "",
      latitude: Number(place.y),
      longitude: Number(place.x),
      categoryGroupCode: place.category_group_code || "",
      categoryName: place.category_name || "",
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

      if (currentLocationByDay[dayNum] && dayItems.length > 0) {
        const toFirstSection = routeSections.find(
          (s) =>
            Number(s.dayNumber) === Number(dayNum) && s.isFromCurrentLocation,
        );
        currentMins += toFirstSection
          ? Math.round(Number(toFirstSection.duration || 0) / 60)
          : 0;
      }

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
  }, [dayNumbers, itemsByDay, routeSections, currentLocationByDay]);

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
    setOptimizationResult(null);
    optimizationBeforeRef.current = null;
    setOptimizationResultByDay({});
    optimizationBeforeByDayRef.current = {};
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!isEditing && (
            <>
              {/* ✨ 미리보기 버튼 추가 */}
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 13px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  background: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <Eye size={15} />
                미리보기
              </button>
              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isExporting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 13px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  background: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <ImageIcon size={15} />
                이미지 저장
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExporting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 13px",
                  border: "none",
                  borderRadius: 8,
                  background: "#10b981",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <Download size={15} />
                PDF 다운로드
              </button>
            </>
          )}

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
              onClick={() => handleSearch()}
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

          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}
          >
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.code}
                type="button"
                onClick={() => handleCategoryFilterClick(f.code)}
                style={{
                  border:
                    searchCategory === f.code
                      ? "1px solid #2563eb"
                      : "1px solid #d1d5db",
                  borderRadius: 999,
                  padding: "5px 12px",
                  background: searchCategory === f.code ? "#2563eb" : "#ffffff",
                  color: searchCategory === f.code ? "#ffffff" : "#374151",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            ))}
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
              {searchResults.slice(0, 8).map((place) => {
                return (
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
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#111827",
                          fontSize: 13,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {place.place_name}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        color: "#6b7280",
                        fontSize: 11,
                        marginTop: 4,
                      }}
                    >
                      <MapPin size={11} />
                      <span>
                        {place.road_address_name || place.address_name}
                      </span>
                    </div>
                  </button>
                );
              })}
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
      </div>

      {/* Main UI Layout (Screen view) */}
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
            gridTemplateColumns: isEditing
              ? "minmax(0, 1.85fr) minmax(320px, 1fr)"
              : "1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* MAP */}
          {isEditing && (
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
                      color:
                        selectedDayForMap === dayNum ? "#ffffff" : "#374151",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    DAY {dayNum}
                  </button>
                ))}
              </div>
              <KakaoMap
                items={selectedDayItems}
                selectedPlaceForMap={selectedPlaceForMap}
                onPlaceSelect={handleMapPlaceSelect}
                routePath={selectedRoutePath}
              />
            </div>
          )}

          {/* SCHEDULE */}
          <div>
            {dayNumbers.map((dayNum) => {
              const dayItems = itemsByDay[dayNum] || [];
              const schedule = scheduleByDay[dayNum] || [];
              const itemIds = dayItems.map((i) => i._uiId);
              const dayRouteSections = routeSections.filter(
                (s) => Number(s.dayNumber) === Number(dayNum),
              );
              const dayDistanceMeters = dayRouteSections.reduce(
                (acc, s) => acc + Number(s.distance || 0),
                0,
              );
              const dayTravelSeconds = dayRouteSections.reduce(
                (acc, s) => acc + Number(s.duration || 0),
                0,
              );
              const dayEndTime =
                schedule.length > 0
                  ? schedule[schedule.length - 1].departureTime
                  : DEFAULT_START_TIME;

              return (
                <div key={dayNum} style={{ marginBottom: 14 }}>
                  <div
                    onClick={() => handleDaySelect(dayNum)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
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
                    <div style={{ minWidth: 0 }}>
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
                        <div>DAY {dayNum}</div>
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 13,
                            fontWeight: 800,
                            color: "#111827",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {dayTitles[dayNum]?.title || "여행 일정"}
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 5,
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 9,
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#4b5563",
                        }}
                      >
                        <span>🚗 {formatDistance(dayDistanceMeters)}</span>
                        <span>⏱ {formatTravelDuration(dayTravelSeconds)}</span>
                        <span>
                          📅 {DEFAULT_START_TIME} ~ {dayEndTime}
                        </span>
                      </div>
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

      {/* ✨ [신규] 일정 미리보기 모달(Modal) 창 */}
      {isPreviewOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "850px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 24px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: 800,
                  color: "#111827",
                }}
              >
                📄 일정 문서 미리보기
              </h3>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: "4px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* 모달 본문 (스크롤 영역 - 실제 인쇄용 템플릿 구조를 그대로 보여줌) */}
            <div
              style={{
                padding: "30px",
                overflowY: "auto",
                flex: 1,
                background: "#f9fafb",
              }}
            >
              <div
                ref={previewRef}
                style={{
                  width: "794px",
                  maxWidth: "794px",
                  minHeight: "1123px",
                  margin: "0 auto",
                  padding: "42px 42px 36px",
                  boxSizing: "border-box",
                  background: "#ffffff",
                  color: "#111827",
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
                  boxShadow: "0 3px 12px rgba(0,0,0,0.12)",
                }}
              >
                <div
                  style={{
                    borderBottom: "2px solid #2563eb",
                    paddingBottom: "15px",
                    marginBottom: "25px",
                  }}
                >
                  <h1
                    style={{
                      fontSize: "24px",
                      fontWeight: 800,
                      margin: "0 0 8px 0",
                    }}
                  >
                    {plan.title}
                  </h1>
                  <div style={{ fontSize: "14px", color: "#4b5563" }}>
                    여행 기간: {plan.startDate} ~ {plan.endDate} (총{" "}
                    {currentItems.length}개 장소)
                  </div>
                </div>

                {dayNumbers.map((dayNum) => {
                  const schedule = scheduleByDay[dayNum] || [];
                  if (schedule.length === 0) return null;

                  return (
                    <div key={dayNum} style={{ marginBottom: "25px" }}>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "#2563eb",
                          borderBottom: "1px solid #e5e7eb",
                          paddingBottom: "6px",
                          marginBottom: "12px",
                        }}
                      >
                        <div>DAY {dayNum}</div>
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 15,
                            fontWeight: 800,
                            color: "#111827",
                          }}
                        >
                          {dayTitles[dayNum]?.title || "여행 일정"}
                        </div>
                      </div>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "13px",
                        }}
                      >
                        <thead>
                          <tr
                            style={{ background: "#f3f4f6", textAlign: "left" }}
                          >
                            <th style={{ padding: "8px", width: "10%" }}>
                              순서
                            </th>
                            <th style={{ padding: "8px", width: "25%" }}>
                              시간
                            </th>
                            <th style={{ padding: "8px", width: "35%" }}>
                              장소명
                            </th>
                            <th style={{ padding: "8px", width: "30%" }}>
                              주소
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedule.map((schItem, idx) => (
                            <tr
                              key={schItem.item._uiId}
                              style={{ borderBottom: "1px solid #f3f4f6" }}
                            >
                              <td
                                style={{ padding: "10px 8px", fontWeight: 600 }}
                              >
                                {idx + 1}
                              </td>
                              <td
                                style={{
                                  padding: "10px 8px",
                                  color: "#2563eb",
                                  fontWeight: 600,
                                }}
                              >
                                {schItem.arrivalTime} ~ {schItem.departureTime}
                                <div
                                  style={{
                                    fontSize: "11px",
                                    color: "#6b7280",
                                    fontWeight: 400,
                                  }}
                                >
                                  (체류:{" "}
                                  {formatStayDuration(schItem.item.stayMinutes)}
                                  )
                                </div>
                              </td>
                              <td
                                style={{ padding: "10px 8px", fontWeight: 700 }}
                              >
                                {schItem.item.placeName}
                              </td>
                              <td
                                style={{
                                  padding: "10px 8px",
                                  color: "#6b7280",
                                  fontSize: "12px",
                                }}
                              >
                                {schItem.item.address || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 모달 푸터 (액션 버튼) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "16px 24px",
                borderTop: "1px solid #e5e7eb",
                background: "#ffffff",
              }}
            >
              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isExporting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 14px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  background: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <ImageIcon size={15} />
                이미지 저장
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExporting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 14px",
                  border: "none",
                  borderRadius: 8,
                  background: "#10b981",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <Download size={15} />
                PDF 다운로드
              </button>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                style={{
                  padding: "9px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  background: "#f3f4f6",
                  color: "#374151",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanDetail;
