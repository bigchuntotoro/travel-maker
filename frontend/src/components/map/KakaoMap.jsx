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

  const searchMarkersRef = useRef([]);
  const searchInfoWindowRef = useRef(null);

  const onPlaceSelectRef = useRef(onPlaceSelect);

  const [mapReady, setMapReady] = useState(false);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");

  // ============================================================
  // 부모 callback 최신화
  // ============================================================

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  // ============================================================
  // 장소 선택 callback
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

      const selected = selectedPlaceForMap;

      if (
        selected &&
        Number.isFinite(Number(selected.lat)) &&
        Number.isFinite(Number(selected.lng))
      ) {
        const position = new window.kakao.maps.LatLng(
          Number(selected.lat),
          Number(selected.lng),
        );

        map.panTo(position);
      }
    } catch (error) {
      console.warn("KakaoMap relayout error:", error);
    }
  };

  // ============================================================
  // Kakao Map 초기화
  // ============================================================

  useEffect(() => {
    let mounted = true;
    let timer = null;

    const initMap = () => {
      if (!mounted) return;

      if (!window.kakao?.maps) {
        timer = setTimeout(initMap, 100);
        return;
      }

      if (!mapContainer.current) {
        timer = setTimeout(initMap, 100);
        return;
      }

      window.kakao.maps.load(() => {
        if (!mounted || !mapContainer.current) return;

        // 이미 생성된 경우 중복 생성 방지
        if (mapInstance.current) {
          relayoutMap();
          return;
        }

        const options = {
          center: new window.kakao.maps.LatLng(37.5665, 126.978),
          level: 4,
        };

        const map = new window.kakao.maps.Map(mapContainer.current, options);

        mapInstance.current = map;

        setMapReady(true);

        // 최초 렌더링 후 relayout
        setTimeout(() => {
          if (!mounted || !mapInstance.current) return;

          try {
            mapInstance.current.relayout();
          } catch (error) {
            console.warn("Initial relayout error:", error);
          }
        }, 100);

        setTimeout(() => {
          if (!mounted || !mapInstance.current) return;

          try {
            mapInstance.current.relayout();
          } catch (error) {
            console.warn("Delayed relayout error:", error);
          }
        }, 500);
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
  // ResizeObserver
  // 모바일 화면 / PC 화면 / 회전 대응
  // ============================================================

  useEffect(() => {
    if (!mapReady) return;

    const wrapper = mapWrapperRef.current;

    if (!wrapper) return;

    let resizeTimer = null;

    const handleResize = () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }

      resizeTimer = setTimeout(() => {
        relayoutMap();
      }, 100);
    };

    let observer = null;

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        handleResize();
      });

      observer.observe(wrapper);
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      if (observer) {
        observer.disconnect();
      }

      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);

      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
    };
  }, [mapReady]);

  // ============================================================
  // 선택 장소 표시
  // ============================================================

  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.setMap(null);
      selectedMarkerRef.current = null;
    }

    if (!selectedPlaceForMap) return;

    const latitude = Number(
      selectedPlaceForMap.latitude ?? selectedPlaceForMap.lat,
    );

    const longitude = Number(
      selectedPlaceForMap.longitude ?? selectedPlaceForMap.lng,
    );

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const position = new window.kakao.maps.LatLng(latitude, longitude);

    mapInstance.current.panTo(position);

    const content = document.createElement("div");

    content.style.cssText = `
      padding:8px 12px;
      background:#d32f2f;
      color:#fff;
      border-radius:8px;
      font-size:13px;
      font-weight:700;
      box-shadow:0 2px 6px rgba(0,0,0,.3);
      white-space:nowrap;
    `;

    content.textContent = selectedPlaceForMap.placeName || "선택 장소";

    selectedMarkerRef.current = new window.kakao.maps.CustomOverlay({
      position,
      content,
      yAnchor: 1.5,
      zIndex: 100,
    });

    selectedMarkerRef.current.setMap(mapInstance.current);

    setTimeout(() => {
      relayoutMap();
    }, 50);
  }, [selectedPlaceForMap, mapReady]);

  // ============================================================
  // 일정 장소 마커
  // ============================================================

  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    markersRef.current.forEach((marker) => {
      marker.setMap(null);
    });

    markersRef.current = [];

    if (!items.length) {
      return;
    }

    const bounds = new window.kakao.maps.LatLngBounds();

    items.forEach((item, index) => {
      const latitude = Number(item.latitude);
      const longitude = Number(item.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      const position = new window.kakao.maps.LatLng(latitude, longitude);

      bounds.extend(position);

      const content = document.createElement("div");

      content.style.cssText = `
        padding:7px 10px;
        background:#1976d2;
        color:#fff;
        border-radius:8px;
        font-size:12px;
        font-weight:700;
        box-shadow:0 2px 5px rgba(0,0,0,.3);
        white-space:nowrap;
        max-width:180px;
        overflow:hidden;
        text-overflow:ellipsis;
      `;

      content.textContent = `${index + 1}. ${item.placeName || "장소"}`;

      const overlay = new window.kakao.maps.CustomOverlay({
        position,
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

    setTimeout(() => {
      relayoutMap();
    }, 100);
  }, [items, mapReady]);

  // ============================================================
  // 실제 도로 경로
  // ============================================================

  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (!routePath?.length) {
      return;
    }

    const path = routePath
      .map((point) => {
        const latitude = Number(point.latitude ?? point.lat);

        const longitude = Number(point.longitude ?? point.lng);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        return new window.kakao.maps.LatLng(latitude, longitude);
      })
      .filter(Boolean);

    if (!path.length) return;

    polylineRef.current = new window.kakao.maps.Polyline({
      path,
      strokeWeight: 5,
      strokeColor: "#1976d2",
      strokeOpacity: 0.8,
      strokeStyle: "solid",
    });

    polylineRef.current.setMap(mapInstance.current);

    const bounds = new window.kakao.maps.LatLngBounds();

    path.forEach((point) => {
      bounds.extend(point);
    });

    if (!bounds.isEmpty()) {
      mapInstance.current.setBounds(bounds);
    }

    setTimeout(() => {
      relayoutMap();
    }, 100);
  }, [routePath, mapReady]);

  // ============================================================
  // 검색 마커 삭제
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
  // 검색 결과를 일정에 추가
  // ============================================================

  const addSearchPlaceToPlan = (place) => {
    if (!place) return;

    const latitude = Number(place.y);
    const longitude = Number(place.x);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const selectedPlace = {
      placeName: place.place_name || "검색 장소",

      address: place.road_address_name || place.address_name || "",

      latitude,
      longitude,

      isSearchPlace: false,
      source: "map-search-add",
    };

    notifyPlaceSelect(selectedPlace);

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
  // 검색 결과 상세 팝업
  // ============================================================

  const showSearchPlaceInfo = (place, position) => {
    if (!mapInstance.current) return;

    if (searchInfoWindowRef.current) {
      searchInfoWindowRef.current.setMap(null);
      searchInfoWindowRef.current = null;
    }

    const wrapper = document.createElement("div");

    wrapper.style.cssText = `
      width:min(300px, calc(100vw - 40px));
      box-sizing:border-box;
      padding:14px;
      background:#fff;
      border:1px solid #ddd;
      border-radius:10px;
      box-shadow:0 4px 15px rgba(0,0,0,.2);
      font-size:13px;
    `;

    wrapper.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    const title = document.createElement("div");

    title.style.cssText = `
      font-size:15px;
      font-weight:700;
      margin-bottom:8px;
      color:#222;
      line-height:1.4;
    `;

    title.textContent = place.place_name || "장소";

    wrapper.appendChild(title);

    if (place.category_name) {
      const category = document.createElement("div");

      category.style.cssText = `
        color:#666;
        margin-bottom:5px;
        line-height:1.4;
      `;

      category.textContent = place.category_name;

      wrapper.appendChild(category);
    }

    const address = document.createElement("div");

    address.style.cssText = `
      color:#555;
      line-height:1.4;
      margin-bottom:6px;
      word-break:keep-all;
    `;

    address.textContent =
      place.road_address_name || place.address_name || "주소 없음";

    wrapper.appendChild(address);

    if (place.phone) {
      const phone = document.createElement("div");

      phone.style.cssText = `
        color:#555;
        margin-bottom:10px;
      `;

      phone.textContent = place.phone;

      wrapper.appendChild(phone);
    }

    const addButton = document.createElement("button");

    addButton.type = "button";
    addButton.textContent = "일정에 추가";

    addButton.style.cssText = `
      width:100%;
      border:none;
      border-radius:7px;
      padding:10px 12px;
      background:#1976d2;
      color:#fff;
      font-size:13px;
      font-weight:700;
      cursor:pointer;
    `;

    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      addSearchPlaceToPlan(place);
    });

    wrapper.appendChild(addButton);

    searchInfoWindowRef.current = new window.kakao.maps.CustomOverlay({
      position,
      content: wrapper,
      yAnchor: 1.15,
      zIndex: 200,
    });

    searchInfoWindowRef.current.setMap(mapInstance.current);
  };

  // ============================================================
  // 현재 지도 영역에서 장소 검색
  // ============================================================

  const searchPlacesInCurrentMap = () => {
    if (!mapInstance.current) return;

    const keyword = searchKeyword.trim();

    if (!keyword) {
      setSearchMessage("검색어를 입력해주세요.");
      return;
    }

    if (!window.kakao?.maps?.services?.Places) {
      setSearchMessage("카카오 장소 검색 서비스를 사용할 수 없습니다.");
      return;
    }

    clearSearchMarkers();

    setIsSearching(true);
    setSearchMessage("");
    setSearchResults([]);

    const places = new window.kakao.maps.services.Places();

    const bounds = mapInstance.current.getBounds();

    const allResults = [];
    const seen = new Set();

    const searchPage = (page) => {
      places.keywordSearch(
        keyword,
        (results, status, pagination) => {
          if (status === window.kakao.maps.services.Status.OK) {
            results.forEach((place) => {
              const latitude = Number(place.y);
              const longitude = Number(place.x);

              if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                return;
              }

              const position = new window.kakao.maps.LatLng(
                latitude,
                longitude,
              );

              if (!bounds.contain(position)) {
                return;
              }

              const key =
                place.id || `${place.place_name}_${place.x}_${place.y}`;

              if (seen.has(key)) {
                return;
              }

              seen.add(key);
              allResults.push(place);
            });
          }

          if (pagination && pagination.hasNextPage && page < 3) {
            searchPage(page + 1);
            return;
          }

          displaySearchResults(allResults);

          setSearchResults(allResults);
          setIsSearching(false);

          if (!allResults.length) {
            setSearchMessage("현재 지도 영역에서 검색 결과가 없습니다.");
          }
        },
        {
          bounds,
          page,
          size: 15,
        },
      );
    };

    searchPage(1);
  };

  // ============================================================
  // 검색 결과 마커 표시
  // ============================================================

  const displaySearchResults = (results) => {
    if (!mapInstance.current) return;

    clearSearchMarkers();

    results.forEach((place, index) => {
      const latitude = Number(place.y);
      const longitude = Number(place.x);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      const position = new window.kakao.maps.LatLng(latitude, longitude);

      const markerElement = document.createElement("div");

      markerElement.style.cssText = `
        width:30px;
        height:30px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:50%;
        background:#e53935;
        color:#fff;
        border:2px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,.35);
        font-size:12px;
        font-weight:700;
        cursor:pointer;
      `;

      markerElement.textContent = String(index + 1);

      markerElement.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        showSearchPlaceInfo(place, position);
      });

      const marker = new window.kakao.maps.CustomOverlay({
        position,
        content: markerElement,
        yAnchor: 0.5,
        zIndex: 150,
      });

      marker.setMap(mapInstance.current);

      searchMarkersRef.current.push(marker);
    });
  };

  // ============================================================
  // 검색 결과 클릭
  // ============================================================

  const handleSearchResultClick = (place) => {
    if (!mapInstance.current) return;

    const latitude = Number(place.y);
    const longitude = Number(place.x);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const position = new window.kakao.maps.LatLng(latitude, longitude);

    mapInstance.current.panTo(position);

    showSearchPlaceInfo(place, position);

    setSearchResults([]);
  };

  // ============================================================
  // 정리
  // ============================================================

  useEffect(() => {
    return () => {
      clearSearchMarkers();

      markersRef.current.forEach((marker) => marker.setMap(null));

      markersRef.current = [];

      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }

      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.setMap(null);
        selectedMarkerRef.current = null;
      }

      mapInstance.current = null;
    };
  }, []);

  // ============================================================
  // 화면
  // ============================================================

  return (
    <div
      ref={mapWrapperRef}
      className="kakao-map-wrapper"
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
      {/* 실제 지도 */}
      <div
        ref={mapContainer}
        className="kakao-map-container"
        style={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          cursor: "crosshair",
        }}
      />

      {/* 지도 검색 */}
      {mapReady && (
        <div
          className="kakao-map-search"
          style={{
            position: "absolute",
            top: 15,
            left: 15,
            width: "min(330px, calc(100% - 30px))",
            maxHeight: 520,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 3px 12px rgba(0,0,0,.2)",
            overflow: "hidden",
            zIndex: 300,
          }}
          onClick={(e) => e.stopPropagation()}
        >
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  searchPlacesInCurrentMap();
                }
              }}
              placeholder="현재 지도에서 장소 검색"
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
              onClick={searchPlacesInCurrentMap}
              disabled={isSearching}
              style={{
                border: "none",
                borderRadius: 7,
                padding: "0 13px",
                background: "#1976d2",
                color: "#fff",
                fontWeight: 700,
                cursor: isSearching ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {isSearching ? "검색중" : "검색"}
            </button>
          </div>

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

          {searchResults.length > 0 && (
            <div
              style={{
                maxHeight: 390,
                overflowY: "auto",
                borderTop: "1px solid #eee",
              }}
            >
              {searchResults.map((place, index) => (
                <button
                  key={place.id || `${place.x}-${place.y}-${index}`}
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
                      {index + 1}
                    </span>

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

                      {place.category_name && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "#9ca3af",
                            marginTop: 2,
                          }}
                        >
                          {place.category_name}
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

      {/* 모바일용 안내 */}
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
