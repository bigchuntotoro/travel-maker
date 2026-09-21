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

  // 최신 callback 유지
  const onPlaceSelectRef = useRef(onPlaceSelect);

  const [mapReady, setMapReady] = useState(false);

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
  // 컴포넌트 종료
  // ============================================================

  useEffect(() => {
    return () => {
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
