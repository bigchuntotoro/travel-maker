import React, { useEffect, useRef, useState } from "react";

const KakaoMap = ({
  items = [],
  onPlaceSelect,
  selectedPlaceForMap,
  routePath = [],
}) => {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const selectedMarkerRef = useRef(null);
  const onPlaceSelectRef = useRef(onPlaceSelect);

  const searchMarkersRef = useRef([]);
  const searchInfoWindowRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");

  // =========================================================
  // 부모 callback 최신화
  // =========================================================
  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  // =========================================================
  // 장소 선택 → 부모 PlanDetail로 전달
  // =========================================================
  const notifyPlaceSelect = (place) => {
    if (!place) return;

    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      console.warn("잘못된 장소 좌표:", place);
      return;
    }

    onPlaceSelectRef.current?.({
      ...place,
      latitude,
      longitude,
    });
  };

  // =========================================================
  // 지도 초기화
  // =========================================================
  useEffect(() => {
    let mounted = true;
    let timer = null;

    const initMap = () => {
      if (!window.kakao?.maps || !mapContainer.current) {
        return;
      }

      window.kakao.maps.load(() => {
        if (!mounted || !mapContainer.current) return;

        const options = {
          center: new window.kakao.maps.LatLng(37.5665, 126.978),
          level: 4,
        };

        const map = new window.kakao.maps.Map(mapContainer.current, options);

        mapInstance.current = map;

        // =====================================================
        // 지도 클릭 → 주소 검색
        // =====================================================
        if (window.kakao.maps.services && window.kakao.maps.services.Geocoder) {
          const geocoder = new window.kakao.maps.services.Geocoder();

          window.kakao.maps.event.addListener(map, "click", (mouseEvent) => {
            const latlng = mouseEvent.latLng;

            const latitude = latlng.getLat();
            const longitude = latlng.getLng();

            geocoder.coord2Address(longitude, latitude, (result, status) => {
              let address = "";

              if (
                status === window.kakao.maps.services.Status.OK &&
                result?.length
              ) {
                address =
                  result[0].road_address?.address_name ||
                  result[0].address?.address_name ||
                  "";
              }

              notifyPlaceSelect({
                placeName: address || "지도에서 선택한 장소",
                address,
                latitude,
                longitude,
                isSearchPlace: false,
                source: "map-click",
              });

              map.panTo(latlng);
            });
          });
        }

        setMapReady(true);
      });
    };

    if (window.kakao?.maps) {
      initMap();
    } else {
      timer = setInterval(() => {
        if (window.kakao?.maps) {
          clearInterval(timer);
          timer = null;
          initMap();
        }
      }, 100);
    }

    return () => {
      mounted = false;

      if (timer) {
        clearInterval(timer);
      }
    };
  }, []);

  // =========================================================
  // 지도 resize
  // =========================================================
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    const timer = setTimeout(() => {
      mapInstance.current.relayout();
    }, 100);

    return () => clearTimeout(timer);
  }, [mapReady]);

  // =========================================================
  // 선택 장소 표시
  // =========================================================
  useEffect(() => {
    if (!mapReady || !mapInstance.current || !selectedPlaceForMap) {
      return;
    }

    const latitude = Number(selectedPlaceForMap.latitude);

    const longitude = Number(selectedPlaceForMap.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const position = new window.kakao.maps.LatLng(latitude, longitude);

    mapInstance.current.panTo(position);

    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.setMap(null);
      selectedMarkerRef.current = null;
    }

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
  }, [selectedPlaceForMap, mapReady]);

  // =========================================================
  // 일정 장소 마커
  // =========================================================
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    markersRef.current.forEach((marker) => {
      marker.setMap(null);
    });

    markersRef.current = [];

    if (!items.length) return;

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
  }, [items, mapReady]);

  // =========================================================
  // 경로 표시
  // =========================================================
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (!routePath?.length) return;

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

    mapInstance.current.setBounds(bounds);
  }, [routePath, mapReady]);

  // =========================================================
  // 검색 마커 제거
  // =========================================================
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

  // =========================================================
  // 검색 장소 → 실제 일정 추가
  //
  // 중요:
  // 검색 결과 클릭만으로는 추가하지 않는다.
  // 정보창의 "일정에 추가" 버튼을 눌렀을 때만
  // PlanDetail로 전달한다.
  // =========================================================
  const addSearchPlaceToPlan = (place) => {
    if (!place) return;

    const latitude = Number(place.y);
    const longitude = Number(place.x);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      console.warn("검색 장소 좌표가 올바르지 않습니다.", place);
      return;
    }

    const selectedPlace = {
      placeName: place.place_name || "검색 장소",

      address: place.road_address_name || place.address_name || "",

      latitude,
      longitude,

      // =====================================================
      // 부모 PlanDetail에서
      // "검색 장소 정보 선택"과
      // "실제 일정 추가"를 구분하기 위한 값
      // =====================================================
      isSearchPlace: false,
      source: "map-search-add",

      // 카카오 검색 부가정보
      categoryName: place.category_name || "",

      phone: place.phone || "",

      placeId: place.id || "",
    };

    console.log("📍 검색 장소 일정 추가:", selectedPlace);

    // =====================================================
    // 부모 PlanDetail → 실제 editItems 추가
    // =====================================================
    notifyPlaceSelect(selectedPlace);

    // =====================================================
    // 정보창 닫기
    // =====================================================
    if (searchInfoWindowRef.current) {
      searchInfoWindowRef.current.setMap(null);
      searchInfoWindowRef.current = null;
    }
  };

  // =========================================================
  // 검색 장소 정보창
  // =========================================================
  const showSearchPlaceInfo = (place, position) => {
    if (!mapInstance.current) return;

    if (searchInfoWindowRef.current) {
      searchInfoWindowRef.current.setMap(null);
      searchInfoWindowRef.current = null;
    }

    const wrapper = document.createElement("div");

    wrapper.style.cssText = `
      min-width:260px;
      max-width:300px;
      padding:14px;
      background:#fff;
      border:1px solid #ddd;
      border-radius:10px;
      box-shadow:0 4px 15px rgba(0,0,0,.2);
      font-size:13px;
    `;

    // =======================================================
    // 장소명
    // =======================================================
    const title = document.createElement("div");

    title.style.cssText = `
      font-size:15px;
      font-weight:700;
      margin-bottom:8px;
      color:#222;
    `;

    title.textContent = place.place_name || "장소";

    wrapper.appendChild(title);

    // =======================================================
    // 카테고리
    // =======================================================
    if (place.category_name) {
      const category = document.createElement("div");

      category.style.cssText = `
        color:#666;
        margin-bottom:5px;
      `;

      category.textContent = place.category_name;

      wrapper.appendChild(category);
    }

    // =======================================================
    // 주소
    // =======================================================
    const address = document.createElement("div");

    address.style.cssText = `
      color:#555;
      line-height:1.4;
      margin-bottom:6px;
    `;

    address.textContent =
      place.road_address_name || place.address_name || "주소 없음";

    wrapper.appendChild(address);

    // =======================================================
    // 전화번호
    // =======================================================
    if (place.phone) {
      const phone = document.createElement("div");

      phone.style.cssText = `
        color:#555;
        margin-bottom:10px;
      `;

      phone.textContent = place.phone;

      wrapper.appendChild(phone);
    }

    // =======================================================
    // 일정 추가 버튼
    // =======================================================
    const addButton = document.createElement("button");

    addButton.type = "button";

    addButton.textContent = "일정에 추가";

    addButton.style.cssText = `
      width:100%;
      border:none;
      border-radius:7px;
      padding:9px 12px;
      background:#1976d2;
      color:#fff;
      font-size:13px;
      font-weight:700;
      cursor:pointer;
    `;

    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      // 실제 일정 추가는 여기서 실행
      addSearchPlaceToPlan(place);
    });

    wrapper.appendChild(addButton);

    // =======================================================
    // 정보창 표시
    // =======================================================
    searchInfoWindowRef.current = new window.kakao.maps.CustomOverlay({
      position,
      content: wrapper,
      yAnchor: 1.15,
      zIndex: 200,
    });

    searchInfoWindowRef.current.setMap(mapInstance.current);
  };

  // =========================================================
  // 현재 지도 영역 검색
  // =========================================================
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

    // =======================================================
    // 검색 시작 시점의 현재 지도 영역
    // =======================================================
    const bounds = mapInstance.current.getBounds();

    const allResults = [];
    const seen = new Set();

    // =======================================================
    // 페이지 검색
    // =======================================================
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

              // 현재 지도 영역 안에 있는 장소만 표시
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

          // 최대 3페이지까지 검색
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

  // =========================================================
  // 검색 결과 마커 표시
  // =========================================================
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

      // =====================================================
      // 번호 마커
      // =====================================================
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

      // =====================================================
      // 마커 클릭
      //
      // 여기서는 일정에 바로 추가하지 않는다.
      // 정보창만 표시한다.
      // =====================================================
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

  // =========================================================
  // 검색 결과 목록 클릭
  //
  // 검색 결과를 클릭하면 지도 이동 + 정보창 표시
  // 실제 일정 추가는 정보창 버튼에서만 실행
  // =========================================================
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
  };

  // =========================================================
  // 컴포넌트 종료 시 정리
  // =========================================================
  useEffect(() => {
    return () => {
      clearSearchMarkers();

      markersRef.current.forEach((marker) => {
        marker.setMap(null);
      });

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

  // =========================================================
  // 화면
  // =========================================================
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "650px",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* =====================================================
          지도
      ===================================================== */}
      <div
        ref={mapContainer}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "650px",
          cursor: "crosshair",
        }}
      />

      {/* =====================================================
          지도 검색 UI
      ===================================================== */}
      {mapReady && (
        <div
          style={{
            position: "absolute",
            top: "15px",
            left: "15px",
            width: "330px",
            maxHeight: "520px",
            background: "#fff",
            borderRadius: "10px",
            boxShadow: "0 3px 12px rgba(0,0,0,.2)",
            overflow: "hidden",
            zIndex: 300,
          }}
        >
          {/* =================================================
              검색창
          ================================================= */}
          <div
            style={{
              display: "flex",
              padding: "10px",
              gap: "6px",
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
                borderRadius: "7px",
                outline: "none",
              }}
            />

            <button
              type="button"
              onClick={searchPlacesInCurrentMap}
              disabled={isSearching}
              style={{
                border: "none",
                borderRadius: "7px",
                padding: "0 13px",
                background: "#1976d2",
                color: "#fff",
                fontWeight: 700,
                cursor: isSearching ? "default" : "pointer",
              }}
            >
              {isSearching ? "검색중" : "검색"}
            </button>
          </div>

          {/* =================================================
              검색 메시지
          ================================================= */}
          {searchMessage && (
            <div
              style={{
                padding: "0 12px 10px",
                color: "#777",
                fontSize: "12px",
              }}
            >
              {searchMessage}
            </div>
          )}

          {/* =================================================
              검색 결과
          ================================================= */}
          {searchResults.length > 0 && (
            <div
              style={{
                borderTop: "1px solid #eee",
                maxHeight: "420px",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  padding: "9px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#555",
                  background: "#fafafa",
                }}
              >
                검색 결과 {searchResults.length}개
                <span
                  style={{
                    marginLeft: "6px",
                    color: "#999",
                    fontWeight: 400,
                  }}
                >
                  장소를 클릭하면 정보를 확인할 수 있습니다.
                </span>
              </div>

              {searchResults.map((place, index) => (
                <div
                  key={place.id || `${place.place_name}-${place.x}-${place.y}`}
                  onClick={() => handleSearchResultClick(place)}
                  style={{
                    padding: "10px 12px",
                    borderTop: "1px solid #f1f1f1",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                    }}
                  >
                    {/* 번호 */}
                    <span
                      style={{
                        flexShrink: 0,
                        width: "24px",
                        height: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        background: "#e53935",
                        color: "#fff",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      {index + 1}
                    </span>

                    {/* 장소 정보 */}
                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "13px",
                          marginBottom: "3px",
                        }}
                      >
                        {place.place_name}
                      </div>

                      <div
                        style={{
                          color: "#777",
                          fontSize: "11px",
                          lineHeight: 1.4,
                        }}
                      >
                        {place.road_address_name || place.address_name || ""}
                      </div>

                      {place.category_name && (
                        <div
                          style={{
                            color: "#999",
                            fontSize: "10px",
                            marginTop: "3px",
                          }}
                        >
                          {place.category_name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* =================================================
              현재 지도에서 다시 검색
          ================================================= */}
          {searchResults.length > 0 && (
            <button
              type="button"
              onClick={searchPlacesInCurrentMap}
              style={{
                width: "100%",
                border: "none",
                borderTop: "1px solid #eee",
                background: "#fafafa",
                padding: "9px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              현재 지도에서 다시 검색
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default KakaoMap;
