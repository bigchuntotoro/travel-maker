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

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  const notifyPlaceSelect = (place) => {
    if (!place) return;
    const latitude = Number(place.latitude ?? place.lat);
    const longitude = Number(place.longitude ?? place.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    onPlaceSelectRef.current?.({ ...place, latitude, longitude });
  };

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

  useEffect(() => {
    let mounted = true,
      timer = null;
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
        setTimeout(() => mapInstance.current?.relayout(), 100);
      });
    };
    initMap();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapWrapperRef.current) return;
    let resizeTimer = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(relayoutMap, 100);
    };
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(handleResize)
        : null;
    if (observer) observer.observe(mapWrapperRef.current);
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [mapReady]);

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
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const pos = new window.kakao.maps.LatLng(lat, lng);
    mapInstance.current.panTo(pos);

    const content = document.createElement("div");
    content.style.cssText =
      "padding:8px 12px;background:#d32f2f;color:#fff;border-radius:8px;font-size:13px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.3);white-space:nowrap;";
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

  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (!items.length) return;

    const bounds = new window.kakao.maps.LatLngBounds();
    items.forEach((item, idx) => {
      const lat = Number(item.latitude),
        lng = Number(item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const pos = new window.kakao.maps.LatLng(lat, lng);
      bounds.extend(pos);

      const content = document.createElement("div");
      content.style.cssText =
        "padding:7px 10px;background:#1976d2;color:#fff;border-radius:8px;font-size:12px;font-weight:700;box-shadow:0 2px 5px rgba(0,0,0,.3);white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;";
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

    if (!bounds.isEmpty()) mapInstance.current.setBounds(bounds);
    setTimeout(relayoutMap, 100);
  }, [items, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    if (!routePath?.length) return;

    const path = routePath
      .map((p) => {
        const lat = Number(p.latitude ?? p.lat),
          lng = Number(p.longitude ?? p.lng);
        return Number.isFinite(lat) && Number.isFinite(lng)
          ? new window.kakao.maps.LatLng(lat, lng)
          : null;
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
    path.forEach((p) => bounds.extend(p));
    if (!bounds.isEmpty()) mapInstance.current.setBounds(bounds);
    setTimeout(relayoutMap, 100);
  }, [routePath, mapReady]);

  const clearSearchMarkers = () => {
    searchMarkersRef.current.forEach((m) => m.setMap(null));
    searchMarkersRef.current = [];
    if (searchInfoWindowRef.current) {
      searchInfoWindowRef.current.setMap(null);
      searchInfoWindowRef.current = null;
    }
  };

  const addSearchPlaceToPlan = (place) => {
    const lat = Number(place.y),
      lng = Number(place.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    notifyPlaceSelect({
      placeName: place.place_name || "검색 장소",
      address: place.road_address_name || place.address_name || "",
      latitude: lat,
      longitude: lng,
    });
    searchInfoWindowRef.current?.setMap(null);
    searchInfoWindowRef.current = null;
    setSearchResults([]);
    setSearchKeyword("");
    setSearchMessage("");
    clearSearchMarkers();
  };

  const showSearchPlaceInfo = (place, pos) => {
    if (!mapInstance.current) return;
    if (searchInfoWindowRef.current) searchInfoWindowRef.current.setMap(null);

    const wrap = document.createElement("div");
    wrap.style.cssText =
      "width:min(300px, calc(100vw - 40px));padding:14px;background:#fff;border:1px solid #ddd;border-radius:10px;box-shadow:0 4px 15px rgba(0,0,0,.2);font-size:13px;";
    wrap.addEventListener("click", (e) => e.stopPropagation());

    wrap.innerHTML = `
      <div style="font-size:15px;font-weight:700;margin-bottom:8px;color:#222;line-height:1.4;">${place.place_name || "장소"}</div>
      ${place.category_name ? `<div style="color:#666;margin-bottom:5px;">${place.category_name}</div>` : ""}
      <div style="color:#555;margin-bottom:6px;">${place.road_address_name || place.address_name || "주소 없음"}</div>
      ${place.phone ? `<div style="color:#555;margin-bottom:10px;">${place.phone}</div>` : ""}
    `;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "일정에 추가";
    btn.style.cssText =
      "width:100%;border:none;border-radius:7px;padding:10px;background:#1976d2;color:#fff;font-size:13px;font-weight:700;cursor:pointer;";
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

  const searchPlacesInCurrentMap = () => {
    if (!mapInstance.current) return;
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
    const bounds = mapInstance.current.getBounds();
    const allResults = [],
      seen = new Set();

    const searchPage = (page) => {
      places.keywordSearch(
        keyword,
        (results, status, pagination) => {
          if (status === window.kakao.maps.services.Status.OK) {
            results.forEach((p) => {
              const lat = Number(p.y),
                lng = Number(p.x);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
              if (!bounds.contain(new window.kakao.maps.LatLng(lat, lng)))
                return;
              const key = p.id || `${p.place_name}_${p.x}_${p.y}`;
              if (seen.has(key)) return;
              seen.add(key);
              allResults.push(p);
            });
          }
          if (pagination && pagination.hasNextPage && page < 3) {
            searchPage(page + 1);
            return;
          }
          setSearchResults(allResults);
          setIsSearching(false);
          if (allResults.length) {
            if (mapInstance.current) {
              clearSearchMarkers();
              allResults.forEach((p, idx) => {
                const lat = Number(p.y),
                  lng = Number(p.x);
                const pos = new window.kakao.maps.LatLng(lat, lng);
                const el = document.createElement("div");
                el.style.cssText =
                  "width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#e53935;color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);font-size:12px;font-weight:700;cursor:pointer;";
                el.textContent = String(idx + 1);
                el.addEventListener("click", (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  showSearchPlaceInfo(p, pos);
                });
                const m = new window.kakao.maps.CustomOverlay({
                  position: pos,
                  content: el,
                  yAnchor: 0.5,
                  zIndex: 150,
                });
                m.setMap(mapInstance.current);
                searchMarkersRef.current.push(m);
              });
            }
          } else {
            setSearchMessage("현재 지도 영역에서 검색 결과가 없습니다.");
          }
        },
        { bounds, page, size: 15 },
      );
    };
    searchPage(1);
  };

  useEffect(() => {
    return () => {
      clearSearchMarkers();
      markersRef.current.forEach((m) => m.setMap(null));
      polylineRef.current?.setMap(null);
      selectedMarkerRef.current?.setMap(null);
      mapInstance.current = null;
    };
  }, []);

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
      <div
        ref={mapContainer}
        style={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          cursor: "crosshair",
        }}
      />

      {mapReady && (
        <div
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
          <div style={{ display: "flex", padding: 10, gap: 6 }}>
            <input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchPlacesInCurrentMap()}
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
              style={{ padding: "0 12px 10px", color: "#777", fontSize: 12 }}
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
              {searchResults.map((place, idx) => (
                <button
                  key={place.id || `${place.x}-${place.y}-${idx}`}
                  type="button"
                  onClick={() => {
                    const pos = new window.kakao.maps.LatLng(
                      Number(place.y),
                      Number(place.x),
                    );
                    mapInstance.current?.panTo(pos);
                    showSearchPlaceInfo(place, pos);
                    setSearchResults([]);
                  }}
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
                      {idx + 1}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
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
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
