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
  const onPlaceSelectRef = useRef(onPlaceSelect);

  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  // =========================================================
  // Kakao Maps SDK 로딩 및 지도 생성
  // =========================================================
  useEffect(() => {
    const loadKakaoMap = () => {
      if (!window.kakao || !window.kakao.maps) {
        console.error("❌ 카카오 지도 SDK가 없습니다.");
        return;
      }

      console.log("✅ 카카오 지도 SDK 발견");

      window.kakao.maps.load(() => {
        console.log("✅ 카카오 지도 SDK 로딩 완료");

        if (!mapContainer.current) {
          console.error("❌ 지도 컨테이너를 찾을 수 없습니다.");
          return;
        }

        if (mapInstance.current) {
          return;
        }

        const options = {
          center: new window.kakao.maps.LatLng(37.5665, 126.978),
          level: 4,
        };

        const map = new window.kakao.maps.Map(mapContainer.current, options);

        mapInstance.current = map;

        console.log("✅ 카카오 지도 생성 완료");

        // -----------------------------------------------------
        // 주소 변환 객체
        // -----------------------------------------------------
        const geocoder = new window.kakao.maps.services.Geocoder();

        // -----------------------------------------------------
        // 지도 클릭
        //
        // 기존:
        // categorySearch("CE7, FD6, AT4, AD5, CT1, PO3")
        //
        // 변경:
        // 클릭한 좌표 → 주소/건물명 변환
        // -----------------------------------------------------
        window.kakao.maps.event.addListener(map, "click", (mouseEvent) => {
          const latLng = mouseEvent.latLng;

          const lat = latLng.getLat();
          const lng = latLng.getLng();

          console.log("📍 지도 클릭:", {
            latitude: lat,
            longitude: lng,
          });

          geocoder.coord2Address(lng, lat, (geoResult, geoStatus) => {
            let placeName = "선택한 장소";

            if (
              geoStatus === window.kakao.maps.services.Status.OK &&
              geoResult &&
              geoResult.length > 0
            ) {
              const result = geoResult[0];

              // 건물명이 있으면 건물명 사용
              // 없으면 도로명 주소
              // 그것도 없으면 지번 주소
              placeName =
                result.road_address?.building_name ||
                result.road_address?.address_name ||
                result.address?.address_name ||
                "선택한 장소";
            }

            console.log("📍 지도에서 선택한 장소:", {
              placeName,
              latitude: lat,
              longitude: lng,
            });

            if (onPlaceSelectRef.current) {
              onPlaceSelectRef.current({
                placeName,
                latitude: lat,
                longitude: lng,
              });
            }
          });
        });

        // -----------------------------------------------------
        // 지도 준비 완료
        // -----------------------------------------------------
        setMapReady(true);
      });
    };

    // =========================================================
    // SDK가 index.html에서 아직 로딩 중일 수 있으므로
    // 잠시 기다렸다가 다시 확인
    // =========================================================

    if (window.kakao && window.kakao.maps) {
      loadKakaoMap();
      return;
    }

    console.log("⏳ 카카오 지도 SDK 로딩 대기...");

    const timer = setInterval(() => {
      if (window.kakao && window.kakao.maps) {
        clearInterval(timer);
        loadKakaoMap();
      }
    }, 100);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // =========================================================
  // 선택한 장소로 지도 이동
  // =========================================================
  useEffect(() => {
    const map = mapInstance.current;

    if (!map || !mapReady || !selectedPlaceForMap) {
      return;
    }

    const lat = parseFloat(selectedPlaceForMap.lat);

    const lng = parseFloat(selectedPlaceForMap.lng);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return;
    }

    const moveLatLng = new window.kakao.maps.LatLng(lat, lng);

    map.panTo(moveLatLng);
  }, [selectedPlaceForMap, mapReady]);

  // =========================================================
  // 마커 표시
  // =========================================================
  useEffect(() => {
    const map = mapInstance.current;

    if (!map || !mapReady) {
      return;
    }

    map.relayout();

    // 기존 마커 삭제
    markersRef.current.forEach((marker) => {
      marker.setMap(null);
    });

    markersRef.current = [];

    if (!items || items.length === 0) {
      return;
    }

    const bounds = new window.kakao.maps.LatLngBounds();

    items.forEach((item, index) => {
      const lat = parseFloat(item.latitude);
      const lng = parseFloat(item.longitude);

      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return;
      }

      const position = new window.kakao.maps.LatLng(lat, lng);

      bounds.extend(position);

      const content = `
        <div
          style="
            padding: 6px 12px;
            background: #2563eb;
            color: white;
            border-radius: 20px;
            font-weight: bold;
            font-size: 13px;
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            white-space: nowrap;
            transform: translateY(-50%);
          "
        >
          ${index + 1}. ${item.placeName}
        </div>
      `;

      const customOverlay = new window.kakao.maps.CustomOverlay({
        map,
        position,
        content,
        yAnchor: 1,
      });

      markersRef.current.push(customOverlay);
    });

    // 장소 전체가 보이도록 지도 이동
    if (!bounds.isEmpty()) {
      map.setBounds(bounds, 50, 50, 50, 50);
    }
  }, [items, mapReady]);

  // =========================================================
  // 실제 도로 경로 표시
  // =========================================================
  useEffect(() => {
    const map = mapInstance.current;

    if (!map || !mapReady) {
      return;
    }

    // 기존 경로 삭제
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (!routePath || !Array.isArray(routePath) || routePath.length < 2) {
      return;
    }

    const roadLinePath = routePath
      .map((point) => {
        const lat = parseFloat(point.lat);
        const lng = parseFloat(point.lng);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          return null;
        }

        return new window.kakao.maps.LatLng(lat, lng);
      })
      .filter(Boolean);

    if (roadLinePath.length < 2) {
      return;
    }

    console.log(`🚗 실제 도로 경로 표시: ${roadLinePath.length}개 좌표`);

    const polyline = new window.kakao.maps.Polyline({
      path: roadLinePath,
      strokeWeight: 5,
      strokeColor: "#2563eb",
      strokeOpacity: 0.85,
      strokeStyle: "solid",
    });

    polyline.setMap(map);

    polylineRef.current = polyline;

    // 실제 도로 경로 전체가 보이도록 확대
    const routeBounds = new window.kakao.maps.LatLngBounds();

    roadLinePath.forEach((position) => {
      routeBounds.extend(position);
    });

    if (!routeBounds.isEmpty()) {
      map.setBounds(routeBounds, 50, 50, 50, 50);
    }

    return () => {
      if (polylineRef.current === polyline) {
        polyline.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [routePath, mapReady]);

  // =========================================================
  // 화면
  // =========================================================
  return (
    <div
      ref={mapContainer}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "400px",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    />
  );
};

export default KakaoMap;
