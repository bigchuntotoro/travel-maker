import React, { useEffect, useRef, useState } from "react";

// ============================================================
// 카테고리별 빠른 검색 버튼 (카카오 장소 카테고리 코드)
// ============================================================
const CATEGORY_CHIPS = [
  { label: "편의점", code: "CS2" },
  { label: "카페", code: "CE7" },
  { label: "음식점", code: "FD6" },
  { label: "마트", code: "MT1" },
  { label: "주차장", code: "PK6" },
  { label: "은행", code: "BK9" },
  { label: "약국", code: "PM9" },
  { label: "지하철역", code: "SW8" },
  { label: "주유소", code: "OL7" },
];

const KakaoMap = ({
  items = [],
  onPlaceSelect,
  selectedPlaceForMap,
  routePath = [],
}) => {
  const mapContainer = useRef(null);
  const mapWrapperRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const searchMarkersRef = useRef([]);
  const polylineRef = useRef(null);
  const selectedMarkerRef = useRef(null);

  // 최신 callback 유지
  const onPlaceSelectRef = useRef(onPlaceSelect);

  const [mapReady, setMapReady] = useState(false);

  // 💡 현재 화면 범위 내 장소 검색 관련 상태
  const [filterKeyword, setFilterKeyword] = useState("");
  const [filterResults, setFilterResults] = useState([]);
  const [isFilterSearching, setIsFilterSearching] = useState(false);
  const [showResultsPanel, setShowResultsPanel] = useState(false);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  // ============================================================
  // 장소 선택 알림
  // ============================================================

  const notifyPlaceSelect = (place) => {
    if (!place) return;

    const latitude = Number(place.latitude ?? place.lat);
    const longitude = Number(place.longitude ?? place.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    onPlaceSelectRef.current?.({
      ...place,
      latitude,
      longitude,
    });
  };

  // ============================================================
  // 지도 relayout
  // ============================================================

  const relayoutMap = () => {
    const map = mapInstance.current;

    if (!map) return;

    try {
      map.relayout();

      const sel = selectedPlaceForMap;

      if (
        sel &&
        Number.isFinite(Number(sel.lat)) &&
        Number.isFinite(Number(sel.lng))
      ) {
        map.panTo(
          new window.kakao.maps.LatLng(Number(sel.lat), Number(sel.lng)),
        );
      }
    } catch (e) {
      console.warn("Relayout error:", e);
    }
  };

  // ============================================================
  // 카카오 지도 초기화
  // ============================================================

  useEffect(() => {
    let mounted = true;
    let timer = null;

    const initMap = () => {
      if (!mounted) return;

      if (!window.kakao?.maps || !mapContainer.current) {
        timer = setTimeout(initMap, 100);
        return;
      }

      window.kakao.maps.load(() => {
        if (!mounted || !mapContainer.current) return;

        if (mapInstance.current) {
          relayoutMap();
          return;
        }

        mapInstance.current = new window.kakao.maps.Map(mapContainer.current, {
          center: new window.kakao.maps.LatLng(37.5665, 126.978),
          level: 4,
        });

        setMapReady(true);

        setTimeout(() => {
          mapInstance.current?.relayout();
        }, 100);
      });
    };

    initMap();

    return () => {
      mounted = false;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  // ============================================================
  // 지도 클릭 → 장소 선택(추가 후보) 이벤트 발생
  // ============================================================

  useEffect(() => {
    if (!mapReady || !mapInstance.current || !window.kakao?.maps) return;

    const handleMapClick = (mouseEvent) => {
      const latlng = mouseEvent.latLng;
      const lat = latlng.getLat();
      const lng = latlng.getLng();

      const emitSelection = (placeName, address) => {
        notifyPlaceSelect({
          latitude: lat,
          longitude: lng,
          placeName: placeName || "선택한 위치",
          address: address || "",
          source: "map-click",
        });
      };

      // 카카오 지오코더로 좌표 → 주소/장소명 변환 시도
      if (window.kakao.maps.services?.Geocoder) {
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.coord2Address(lng, lat, (result, status) => {
          if (status === window.kakao.maps.services.Status.OK && result?.[0]) {
            const roadAddr = result[0].road_address;
            const jibunAddr = result[0].address;
            const address =
              roadAddr?.address_name || jibunAddr?.address_name || "";
            const placeName = roadAddr?.building_name || address;
            emitSelection(placeName, address);
          } else {
            emitSelection(null, null);
          }
        });
      } else {
        emitSelection(null, null);
      }
    };

    window.kakao.maps.event.addListener(
      mapInstance.current,
      "click",
      handleMapClick,
    );

    return () => {
      if (mapInstance.current) {
        window.kakao.maps.event.removeListener(
          mapInstance.current,
          "click",
          handleMapClick,
        );
      }
    };
  }, [mapReady]);

  // ============================================================
  // 반응형 지도 크기 변경
  // ============================================================

  useEffect(() => {
    if (!mapReady || !mapWrapperRef.current) return;

    let resizeTimer = null;

    const handleResize = () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }

      resizeTimer = setTimeout(() => {
        relayoutMap();
      }, 100);
    };

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(handleResize)
        : null;

    if (observer) {
      observer.observe(mapWrapperRef.current);
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      observer?.disconnect();

      window.removeEventListener("resize", handleResize);

      window.removeEventListener("orientationchange", handleResize);

      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
    };
  }, [mapReady]);

  // ============================================================
  // 선택된 장소 표시
  // ============================================================

  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.setMap(null);
      selectedMarkerRef.current = null;
    }

    if (!selectedPlaceForMap) return;

    const lat = Number(selectedPlaceForMap.latitude ?? selectedPlaceForMap.lat);

    const lng = Number(
      selectedPlaceForMap.longitude ?? selectedPlaceForMap.lng,
    );

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const pos = new window.kakao.maps.LatLng(lat, lng);

    mapInstance.current.panTo(pos);

    const content = document.createElement("div");

    content.style.cssText =
      "padding:8px 12px;" +
      "background:#d32f2f;" +
      "color:#fff;" +
      "border-radius:8px;" +
      "font-size:13px;" +
      "font-weight:700;" +
      "box-shadow:0 2px 6px rgba(0,0,0,.3);" +
      "white-space:nowrap;";

    content.textContent = selectedPlaceForMap.placeName || "선택 장소";

    selectedMarkerRef.current = new window.kakao.maps.CustomOverlay({
      position: pos,
      content,
      yAnchor: 1.5,
      zIndex: 100,
    });

    selectedMarkerRef.current.setMap(mapInstance.current);

    setTimeout(relayoutMap, 50);
  }, [selectedPlaceForMap, mapReady]);

  // ============================================================
  // 현재 DAY 일정 장소 마커
  // ============================================================

  useEffect(() => {
    if (!mapReady || !mapInstance.current) {
      return;
    }

    markersRef.current.forEach((m) => {
      m.setMap(null);
    });

    markersRef.current = [];

    if (!items.length) {
      return;
    }

    const bounds = new window.kakao.maps.LatLngBounds();

    items.forEach((item, idx) => {
      const lat = Number(item.latitude);
      const lng = Number(item.longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const pos = new window.kakao.maps.LatLng(lat, lng);

      bounds.extend(pos);

      const content = document.createElement("div");

      content.style.cssText =
        "padding:7px 10px;" +
        "background:#1976d2;" +
        "color:#fff;" +
        "border-radius:8px;" +
        "font-size:12px;" +
        "font-weight:700;" +
        "box-shadow:0 2px 5px rgba(0,0,0,.3);" +
        "white-space:nowrap;" +
        "max-width:180px;" +
        "overflow:hidden;" +
        "text-overflow:ellipsis;";

      content.textContent = `${idx + 1}. ${item.placeName || "장소"}`;
      content.style.cursor = "pointer";
      content.addEventListener("click", (e) => {
        e.stopPropagation();
        notifyPlaceSelect({
          latitude: lat,
          longitude: lng,
          placeName: item.placeName || "장소",
          address: item.address || "",
          uiId: item._uiId,
        });
      });

      const overlay = new window.kakao.maps.CustomOverlay({
        position: pos,
        content,
        yAnchor: 1.5,
        zIndex: 50,
      });

      overlay.setMap(mapInstance.current);

      markersRef.current.push(overlay);
    });

    if (!bounds.isEmpty()) {
      mapInstance.current.setBounds(bounds);
    }

    setTimeout(relayoutMap, 100);
  }, [items, mapReady]);

  // ============================================================
  // 도로 경로 표시
  // ============================================================

  useEffect(() => {
    if (!mapReady || !mapInstance.current) {
      return;
    }

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (!routePath?.length) {
      return;
    }

    const path = routePath
      .map((p) => {
        const lat = Number(p.latitude ?? p.lat);

        const lng = Number(p.longitude ?? p.lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return null;
        }

        return new window.kakao.maps.LatLng(lat, lng);
      })
      .filter(Boolean);

    if (!path.length) {
      return;
    }

    polylineRef.current = new window.kakao.maps.Polyline({
      path,
      strokeWeight: 5,
      strokeColor: "#1976d2",
      strokeOpacity: 0.8,
      strokeStyle: "solid",
    });

    polylineRef.current.setMap(mapInstance.current);

    const bounds = new window.kakao.maps.LatLngBounds();

    path.forEach((p) => {
      bounds.extend(p);
    });

    if (!bounds.isEmpty()) {
      mapInstance.current.setBounds(bounds);
    }

    setTimeout(relayoutMap, 100);
  }, [routePath, mapReady]);

  // ============================================================
  // 💡 현재 화면(bounds) 안에서만 장소 검색
  // ============================================================

  const runFilterSearch = (keyword, categoryCode) => {
    if (!mapReady || !mapInstance.current || !window.kakao?.maps?.services) {
      alert("지도가 아직 준비되지 않았습니다.");
      return;
    }

    const trimmed = (keyword || "").trim();

    if (!trimmed && !categoryCode) {
      return;
    }

    // 핵심: 현재 지도 화면의 bounds를 그대로 검색 옵션에 넘기면
    // 그 범위 안에 있는 결과만 반환된다.
    const bounds = mapInstance.current.getBounds();
    const ps = new window.kakao.maps.services.Places();

    setIsFilterSearching(true);
    setShowResultsPanel(true);

    const callback = (data, status) => {
      setIsFilterSearching(false);

      if (status === window.kakao.maps.services.Status.OK) {
        setFilterResults(data);
      } else {
        // ZERO_RESULT, ERROR 모두 빈 결과로 처리
        setFilterResults([]);
      }
    };

    if (categoryCode) {
      ps.categorySearch(categoryCode, callback, { bounds });
    } else {
      ps.keywordSearch(trimmed, callback, { bounds });
    }
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    runFilterSearch(filterKeyword);
  };

  const handleCategoryClick = (label, code) => {
    setFilterKeyword(label);
    runFilterSearch(label, code);
  };

  const handleClearFilterResults = () => {
    setFilterResults([]);
    setShowResultsPanel(false);
    setFilterKeyword("");
  };

  const handleFilterResultClick = (place) => {
    const lat = Number(place.y);
    const lng = Number(place.x);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    mapInstance.current?.panTo(new window.kakao.maps.LatLng(lat, lng));

    notifyPlaceSelect({
      latitude: lat,
      longitude: lng,
      placeName: place.place_name,
      address: place.road_address_name || place.address_name || "",
      source: "filter-search",
    });
  };

  // 검색 결과를 지도 위에 마커로 표시
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    searchMarkersRef.current.forEach((m) => m.setMap(null));
    searchMarkersRef.current = [];

    if (!filterResults.length) return;

    filterResults.forEach((place, idx) => {
      const lat = Number(place.y);
      const lng = Number(place.x);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const pos = new window.kakao.maps.LatLng(lat, lng);

      const content = document.createElement("div");

      content.style.cssText =
        "padding:6px 9px;" +
        "background:#059669;" +
        "color:#fff;" +
        "border-radius:8px;" +
        "font-size:11px;" +
        "font-weight:700;" +
        "box-shadow:0 2px 5px rgba(0,0,0,.3);" +
        "white-space:nowrap;" +
        "max-width:160px;" +
        "overflow:hidden;" +
        "text-overflow:ellipsis;" +
        "cursor:pointer;";

      content.textContent = `${idx + 1}. ${place.place_name}`;
      content.addEventListener("click", (e) => {
        e.stopPropagation();
        handleFilterResultClick(place);
      });

      const overlay = new window.kakao.maps.CustomOverlay({
        position: pos,
        content,
        yAnchor: 1.5,
        zIndex: 60,
      });

      overlay.setMap(mapInstance.current);

      searchMarkersRef.current.push(overlay);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterResults, mapReady]);

  // ============================================================
  // 컴포넌트 종료
  // ============================================================

  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.setMap(null));

      searchMarkersRef.current.forEach((m) => m.setMap(null));

      polylineRef.current?.setMap(null);

      selectedMarkerRef.current?.setMap(null);

      mapInstance.current = null;
    };
  }, []);

  // ============================================================
  // 화면
  // ============================================================

  return (
    <div
      ref={mapWrapperRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        position: "relative",
        overflow: "hidden",
        borderRadius: 12,
        background: "#f3f4f6",
      }}
    >
      {/* ======================================================
          카카오 지도
      ====================================================== */}

      <div
        ref={mapContainer}
        style={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          cursor: "crosshair",
        }}
      />

      {/* ======================================================
          💡 현재 화면 범위 내 검색 패널
      ====================================================== */}

      {mapReady && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            right: 10,
            zIndex: 30,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxWidth: 320,
          }}
        >
          <form
            onSubmit={handleFilterSubmit}
            style={{ display: "flex", gap: 6 }}
          >
            <input
              type="text"
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              placeholder="현재 화면에서 검색 (예: 편의점)"
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 13,
                outline: "none",
                background: "#fff",
              }}
            />
            <button
              type="submit"
              disabled={isFilterSearching}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: "#059669",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {isFilterSearching ? "검색중..." : "검색"}
            </button>
          </form>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {CATEGORY_CHIPS.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => handleCategoryClick(c.label, c.code)}
                style={{
                  padding: "5px 9px",
                  borderRadius: 999,
                  border: "1px solid #059669",
                  background: "#fff",
                  color: "#059669",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {showResultsPanel && (
            <div
              style={{
                background: "#fff",
                borderRadius: 10,
                boxShadow: "0 4px 14px rgba(0,0,0,.15)",
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderBottom: "1px solid #f0f0f0",
                  position: "sticky",
                  top: 0,
                  background: "#fff",
                }}
              >
                <span
                  style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}
                >
                  현재 화면 검색 결과
                  {filterResults.length > 0 ? ` (${filterResults.length})` : ""}
                </span>
                <button
                  type="button"
                  onClick={handleClearFilterResults}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#6b7280",
                    fontSize: 13,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>

              {isFilterSearching ? (
                <div style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                  검색 중...
                </div>
              ) : filterResults.length === 0 ? (
                <div style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>
                  현재 화면 범위 안에 결과가 없습니다. 지도를 이동하거나 축소한
                  뒤 다시 검색해보세요.
                </div>
              ) : (
                filterResults.map((place, idx) => (
                  <div
                    key={`${place.id || place.place_name}-${idx}`}
                    onClick={() => handleFilterResultClick(place)}
                    style={{
                      padding: "8px 10px",
                      borderBottom: "1px solid #f5f5f5",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {idx + 1}. {place.place_name}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}
                    >
                      {place.road_address_name || place.address_name || ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================
          지도 로딩
      ====================================================== */}

      {!mapReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f3f4f6",
            color: "#6b7280",
            fontSize: 13,
            zIndex: 10,
          }}
        >
          카카오 지도를 불러오는 중...
        </div>
      )}
    </div>
  );
};

export default KakaoMap;
