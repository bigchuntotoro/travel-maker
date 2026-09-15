import React, { useEffect, useRef, useState } from "react";

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
  const polylineRef = useRef(null);
  const selectedMarkerRef = useRef(null);

  // 검색 결과 마커
  const searchMarkersRef = useRef([]);

  // 검색 결과 상세 Overlay
  const searchInfoWindowRef = useRef(null);

  // 최신 callback 유지
  const onPlaceSelectRef = useRef(onPlaceSelect);

  const [mapReady, setMapReady] = useState(false);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");

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
  // 검색 마커 제거
  // ============================================================

  const clearSearchMarkers = () => {
    searchMarkersRef.current.forEach((marker) => {
      marker.setMap(null);
    });

    searchMarkersRef.current = [];

    if (searchInfoWindowRef.current) {
      searchInfoWindowRef.current.setMap(null);
      searchInfoWindowRef.current = null;
    }
  };

  // ============================================================
  // 검색 장소를 일정에 추가
  // ============================================================

  const addSearchPlaceToPlan = (place) => {
    const lat = Number(place.y);
    const lng = Number(place.x);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    notifyPlaceSelect({
      source: "search",
      placeName: place.place_name || "검색 장소",
      address: place.road_address_name || place.address_name || "",
      latitude: lat,
      longitude: lng,
    });

    if (searchInfoWindowRef.current) {
      searchInfoWindowRef.current.setMap(null);
      searchInfoWindowRef.current = null;
    }

    setSearchResults([]);
    setSearchKeyword("");
    setSearchMessage("");

    clearSearchMarkers();
  };

  // ============================================================
  // 검색 장소 상세 정보
  // ============================================================

  const showSearchPlaceInfo = (place, pos) => {
    if (!mapInstance.current) {
      return;
    }

    if (searchInfoWindowRef.current) {
      searchInfoWindowRef.current.setMap(null);
    }

    const wrap = document.createElement("div");

    wrap.style.cssText =
      "width:min(300px, calc(100vw - 40px));" +
      "padding:14px;" +
      "background:#fff;" +
      "border:1px solid #ddd;" +
      "border-radius:10px;" +
      "box-shadow:0 4px 15px rgba(0,0,0,.2);" +
      "font-size:13px;";

    wrap.addEventListener("click", (e) => e.stopPropagation());

    const title = document.createElement("div");

    title.style.cssText =
      "font-size:15px;" +
      "font-weight:700;" +
      "margin-bottom:8px;" +
      "color:#222;" +
      "line-height:1.4;";

    title.textContent = place.place_name || "장소";

    wrap.appendChild(title);

    if (place.category_name) {
      const category = document.createElement("div");

      category.style.cssText = "color:#666;" + "margin-bottom:5px;";

      category.textContent = place.category_name;

      wrap.appendChild(category);
    }

    const address = document.createElement("div");

    address.style.cssText = "color:#555;" + "margin-bottom:6px;";

    address.textContent =
      place.road_address_name || place.address_name || "주소 없음";

    wrap.appendChild(address);

    if (place.phone) {
      const phone = document.createElement("div");

      phone.style.cssText = "color:#555;" + "margin-bottom:10px;";

      phone.textContent = place.phone;

      wrap.appendChild(phone);
    }

    const btn = document.createElement("button");

    btn.type = "button";
    btn.textContent = "일정에 추가";

    btn.style.cssText =
      "width:100%;" +
      "border:none;" +
      "border-radius:7px;" +
      "padding:10px;" +
      "background:#1976d2;" +
      "color:#fff;" +
      "font-size:13px;" +
      "font-weight:700;" +
      "cursor:pointer;";

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      addSearchPlaceToPlan(place);
    });

    wrap.appendChild(btn);

    searchInfoWindowRef.current = new window.kakao.maps.CustomOverlay({
      position: pos,
      content: wrap,
      yAnchor: 1.15,
      zIndex: 200,
    });

    searchInfoWindowRef.current.setMap(mapInstance.current);
  };

  // ============================================================
  // ★ 전체 지도 장소 검색
  //
  // 기존:
  //   const bounds = mapInstance.current.getBounds();
  //   keywordSearch(..., { bounds })
  //
  // 변경:
  //   bounds를 전달하지 않음
  //
  // 따라서 현재 화면 영역으로 검색 결과를 제한하지 않습니다.
  // ============================================================

  const searchPlaces = () => {
    if (!mapInstance.current) {
      return;
    }

    const keyword = searchKeyword.trim();

    if (!keyword) {
      setSearchMessage("검색어를 입력해주세요.");
      return;
    }

    if (!window.kakao?.maps?.services?.Places) {
      setSearchMessage("카카오 검색 서비스를 사용할 수 없습니다.");
      return;
    }

    clearSearchMarkers();

    setIsSearching(true);
    setSearchMessage("");
    setSearchResults([]);

    const places = new window.kakao.maps.services.Places();

    const allResults = [];
    const seen = new Set();

    // 최대 3페이지 검색
    const MAX_PAGE = 3;

    const searchPage = (page) => {
      places.keywordSearch(
        keyword,
        (results, status, pagination) => {
          if (status === window.kakao.maps.services.Status.OK) {
            results.forEach((p) => {
              const lat = Number(p.y);
              const lng = Number(p.x);

              if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
              }

              const key = p.id || `${p.place_name}_${p.x}_${p.y}`;

              if (seen.has(key)) {
                return;
              }

              seen.add(key);

              allResults.push(p);
            });
          }

          if (pagination && pagination.hasNextPage && page < MAX_PAGE) {
            searchPage(page + 1);
            return;
          }

          setSearchResults(allResults);

          setIsSearching(false);

          // ==================================================
          // 검색 결과가 있는 경우
          // ==================================================

          if (allResults.length > 0) {
            clearSearchMarkers();

            const resultBounds = new window.kakao.maps.LatLngBounds();

            allResults.forEach((p, idx) => {
              const lat = Number(p.y);
              const lng = Number(p.x);

              if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
              }

              const pos = new window.kakao.maps.LatLng(lat, lng);

              resultBounds.extend(pos);

              // 검색 번호 마커
              const el = document.createElement("div");

              el.style.cssText =
                "width:30px;" +
                "height:30px;" +
                "display:flex;" +
                "align-items:center;" +
                "justify-content:center;" +
                "border-radius:50%;" +
                "background:#e53935;" +
                "color:#fff;" +
                "border:2px solid #fff;" +
                "box-shadow:0 2px 6px rgba(0,0,0,.35);" +
                "font-size:12px;" +
                "font-weight:700;" +
                "cursor:pointer;";

              el.textContent = String(idx + 1);

              el.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                mapInstance.current?.panTo(pos);

                showSearchPlaceInfo(p, pos);
              });

              const marker = new window.kakao.maps.CustomOverlay({
                position: pos,
                content: el,
                yAnchor: 0.5,
                zIndex: 150,
              });

              marker.setMap(mapInstance.current);

              searchMarkersRef.current.push(marker);
            });

            // 검색 결과 전체가 보이도록 지도 이동
            if (!resultBounds.isEmpty()) {
              mapInstance.current.setBounds(resultBounds);
            }

            setTimeout(relayoutMap, 100);
          } else {
            setSearchMessage(`"${keyword}" 검색 결과가 없습니다.`);
          }
        },

        // ======================================================
        // ★ 중요
        //
        // bounds를 지정하지 않습니다.
        // 현재 지도 화면에 검색 결과가 제한되지 않습니다.
        // ======================================================

        {
          page,
          size: 15,
        },
      );
    };

    searchPage(1);
  };

  // ============================================================
  // Enter 검색
  // ============================================================

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      if (!isSearching) {
        searchPlaces();
      }
    }
  };

  // ============================================================
  // 검색 결과 클릭
  // ============================================================

  const handleSearchResultClick = (place) => {
    const lat = Number(place.y);
    const lng = Number(place.x);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const pos = new window.kakao.maps.LatLng(lat, lng);

    mapInstance.current?.panTo(pos);

    showSearchPlaceInfo(place, pos);
  };

  // ============================================================
  // 컴포넌트 종료
  // ============================================================

  useEffect(() => {
    return () => {
      clearSearchMarkers();

      markersRef.current.forEach((m) => m.setMap(null));

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
          전체 지도 검색
      ====================================================== */}

      {mapReady && (
        <div
          style={{
            position: "absolute",
            top: 15,
            left: 15,
            width: "min(350px, calc(100% - 30px))",
            maxHeight: 520,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 3px 12px rgba(0,0,0,.2)",
            overflow: "hidden",
            zIndex: 300,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ==================================================
              검색 입력
          ================================================== */}

          <div
            style={{
              display: "flex",
              padding: 10,
              gap: 6,
            }}
          >
            <input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="전국 장소 검색"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "9px 10px",
                border: "1px solid #ddd",
                borderRadius: 7,
                outline: "none",
                fontSize: 13,
              }}
            />

            <button
              type="button"
              onClick={searchPlaces}
              disabled={isSearching}
              style={{
                border: "none",
                borderRadius: 7,
                padding: "0 13px",
                background: isSearching ? "#93c5fd" : "#1976d2",
                color: "#fff",
                fontWeight: 700,
                cursor: isSearching ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {isSearching ? "검색중" : "검색"}
            </button>
          </div>

          {/* ==================================================
              검색 안내
          ================================================== */}

          {searchMessage && (
            <div
              style={{
                padding: "0 12px 10px",
                color: "#777",
                fontSize: 12,
              }}
            >
              {searchMessage}
            </div>
          )}

          {/* ==================================================
              검색 결과
          ================================================== */}

          {searchResults.length > 0 && (
            <div
              style={{
                maxHeight: 390,
                overflowY: "auto",
                borderTop: "1px solid #eee",
              }}
            >
              {searchResults.map((place, idx) => (
                <button
                  key={place.id || `${place.x}-${place.y}-${idx}`}
                  type="button"
                  onClick={() => handleSearchResultClick(place)}
                  style={{
                    width: "100%",
                    border: "none",
                    borderBottom: "1px solid #eee",
                    background: "#fff",
                    padding: "10px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    {/* 번호 */}

                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "#e53935",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>

                    {/* 장소 정보 */}

                    <div
                      style={{
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#111827",
                          marginBottom: 3,
                        }}
                      >
                        {place.place_name}
                      </div>

                      {place.category_name && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "#9ca3af",
                            marginBottom: 2,
                          }}
                        >
                          {place.category_name}
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          lineHeight: 1.4,
                        }}
                      >
                        {place.road_address_name ||
                          place.address_name ||
                          "주소 없음"}
                      </div>

                      {place.phone && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "#9ca3af",
                            marginTop: 2,
                          }}
                        >
                          {place.phone}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
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
