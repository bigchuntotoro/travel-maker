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

  const [mapReady, setMapReady] = useState(false);

  /* =========================================================
   * Callback 최신 상태 유지
   * ========================================================= */

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  /* =========================================================
   * 선택 장소 전달
   * ========================================================= */

  const notifyPlaceSelect = (place) => {
    if (!place) {
      return;
    }

    const latitude = Number(place.latitude ?? place.lat);

    const longitude = Number(place.longitude ?? place.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      console.warn("⚠️ 잘못된 좌표입니다.", place);
      return;
    }

    const selectedPlace = {
      placeName: place.placeName || "지도에서 선택한 장소",

      address: place.address || "",

      latitude,
      longitude,
    };

    console.log("📍 KakaoMap 장소 선택:", selectedPlace);

    if (onPlaceSelectRef.current) {
      onPlaceSelectRef.current(selectedPlace);
    }
  };

  /* =========================================================
   * Kakao Maps SDK 로딩 및 지도 생성
   * ========================================================= */

  useEffect(() => {
    let timer = null;

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

        /*
         * 이미 생성된 지도라면 다시 생성하지 않는다.
         */

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

        /* =====================================================
         * Geocoder 준비
         *
         * services 라이브러리가 없는 경우에도
         * 지도 클릭 자체는 정상 동작하도록 한다.
         * ===================================================== */

        let geocoder = null;

        if (window.kakao.maps.services && window.kakao.maps.services.Geocoder) {
          geocoder = new window.kakao.maps.services.Geocoder();

          console.log("✅ Kakao Geocoder 준비 완료");
        } else {
          console.warn("⚠️ Kakao services 라이브러리가 없습니다.");

          console.warn(
            "⚠️ 좌표 선택은 가능하지만 주소 변환은 사용할 수 없습니다.",
          );
        }

        /* =====================================================
         * 지도 클릭
         * ===================================================== */

        window.kakao.maps.event.addListener(map, "click", (mouseEvent) => {
          const latLng = mouseEvent.latLng;

          if (!latLng) {
            return;
          }

          const lat = latLng.getLat();

          const lng = latLng.getLng();

          console.log("📍 지도 클릭:", {
            latitude: lat,
            longitude: lng,
          });

          /*
           * 기본값
           *
           * Geocoder가 실패하더라도
           * 좌표는 반드시 부모에게 전달한다.
           */

          const sendSelectedPlace = (
            placeName = "지도에서 선택한 장소",
            address = "",
          ) => {
            notifyPlaceSelect({
              placeName,
              address,
              latitude: lat,
              longitude: lng,
            });

            /*
             * 클릭 위치로 이동
             */

            map.panTo(new window.kakao.maps.LatLng(lat, lng));
          };

          /*
           * Geocoder가 없는 경우
           */

          if (!geocoder) {
            sendSelectedPlace();

            return;
          }

          /*
           * 좌표 → 주소 변환
           */

          geocoder.coord2Address(lng, lat, (geoResult, geoStatus) => {
            if (
              geoStatus === window.kakao.maps.services.Status.OK &&
              geoResult &&
              geoResult.length > 0
            ) {
              const result = geoResult[0];

              const roadAddress = result.road_address?.address_name || "";

              const address = result.address?.address_name || "";

              const buildingName = result.road_address?.building_name || "";

              const placeName =
                buildingName ||
                roadAddress ||
                address ||
                "지도에서 선택한 장소";

              console.log("📍 주소 변환 성공:", {
                placeName,
                roadAddress,
                address,
                latitude: lat,
                longitude: lng,
              });

              sendSelectedPlace(placeName, roadAddress || address);

              return;
            }

            /*
             * 주소 변환 실패
             *
             * 그래도 좌표 선택은 유지
             */

            console.warn("⚠️ 주소 변환 실패", {
              geoStatus,
              latitude: lat,
              longitude: lng,
            });

            sendSelectedPlace();
          });
        });

        /* =====================================================
         * 지도 준비 완료
         * ===================================================== */

        setMapReady(true);

        /*
         * 처음 생성 직후 relayout
         */

        setTimeout(() => {
          if (mapInstance.current) {
            mapInstance.current.relayout();
          }
        }, 100);
      });
    };

    /* =========================================================
     * SDK가 이미 로드된 경우
     * ========================================================= */

    if (window.kakao && window.kakao.maps) {
      loadKakaoMap();

      return;
    }

    /* =========================================================
     * SDK 로딩 대기
     * ========================================================= */

    console.log("⏳ 카카오 지도 SDK 로딩 대기...");

    timer = setInterval(() => {
      if (window.kakao && window.kakao.maps) {
        clearInterval(timer);

        loadKakaoMap();
      }
    }, 100);

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, []);

  /* =========================================================
   * 부모 영역 크기 변경 대응
   * ========================================================= */

  useEffect(() => {
    if (!mapInstance.current || !mapReady) {
      return;
    }

    const map = mapInstance.current;

    const resizeMap = () => {
      if (mapInstance.current) {
        map.relayout();
      }
    };

    resizeMap();

    window.addEventListener("resize", resizeMap);

    let resizeObserver = null;

    if (window.ResizeObserver && mapContainer.current) {
      resizeObserver = new ResizeObserver(() => {
        resizeMap();
      });

      resizeObserver.observe(mapContainer.current);
    }

    return () => {
      window.removeEventListener("resize", resizeMap);

      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [mapReady]);

  /* =========================================================
   * 선택한 장소로 지도 이동
   * ========================================================= */

  useEffect(() => {
    const map = mapInstance.current;

    if (!map || !mapReady || !selectedPlaceForMap) {
      return;
    }

    const lat = parseFloat(
      selectedPlaceForMap.lat ?? selectedPlaceForMap.latitude,
    );

    const lng = parseFloat(
      selectedPlaceForMap.lng ?? selectedPlaceForMap.longitude,
    );

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return;
    }

    const moveLatLng = new window.kakao.maps.LatLng(lat, lng);

    map.relayout();

    map.panTo(moveLatLng);

    /* =====================================================
     * 선택 위치 표시
     * ===================================================== */

    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.setMap(null);

      selectedMarkerRef.current = null;
    }

    const selectedContent = `
      <div
        style="
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
          z-index: 100;
        "
      >
        <div
          style="
            background: #dc2626;
            color: #ffffff;
            padding: 7px 12px;
            border-radius: 18px;
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
            border: 2px solid #ffffff;
            box-shadow:
              0 3px 10px
              rgba(0,0,0,0.3);
          "
        >
          ${selectedPlaceForMap.placeName || "선택한 장소"}
        </div>

        <div
          style="
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 8px solid #dc2626;
          "
        ></div>
      </div>
    `;

    const selectedOverlay = new window.kakao.maps.CustomOverlay({
      map,
      position: moveLatLng,
      content: selectedContent,
      yAnchor: 1,
      zIndex: 100,
    });

    selectedMarkerRef.current = selectedOverlay;

    return () => {
      if (selectedMarkerRef.current === selectedOverlay) {
        selectedOverlay.setMap(null);

        selectedMarkerRef.current = null;
      }
    };
  }, [selectedPlaceForMap, mapReady]);

  /* =========================================================
   * 마커 표시
   * ========================================================= */

  useEffect(() => {
    const map = mapInstance.current;

    if (!map || !mapReady) {
      return;
    }

    map.relayout();

    /* =======================================================
     * 기존 마커 제거
     * ======================================================= */

    markersRef.current.forEach((marker) => {
      marker.setMap(null);
    });

    markersRef.current = [];

    if (!items || items.length === 0) {
      return;
    }

    /* =======================================================
     * 전체 장소 Bounds
     * ======================================================= */

    const bounds = new window.kakao.maps.LatLngBounds();

    items.forEach((item, index) => {
      const lat = parseFloat(item.latitude);

      const lng = parseFloat(item.longitude);

      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return;
      }

      const position = new window.kakao.maps.LatLng(lat, lng);

      bounds.extend(position);

      /* =================================================
       * 마커 번호 + 장소명
       *
       * pointer-events:none
       *
       * → 마커가 지도 클릭을 가로채지 않도록 한다.
       * ================================================= */

      const content = `
          <div
            style="
              display: flex;
              align-items: center;
              gap: 5px;

              padding: 5px 9px;

              background: #2563eb;
              color: white;

              border-radius: 16px;

              font-weight: 700;
              font-size: 11px;

              border: 2px solid white;

              box-shadow:
                0 2px 7px
                rgba(0,0,0,0.25);

              white-space: nowrap;

              transform:
                translateY(-50%);

              max-width: 220px;

              overflow: hidden;
              text-overflow: ellipsis;

              pointer-events: none;

              user-select: none;
            "
          >
            <span
              style="
                display: inline-flex;
                align-items: center;
                justify-content: center;

                width: 19px;
                height: 19px;

                border-radius: 50%;

                background: white;
                color: #2563eb;

                font-size: 10px;
                font-weight: 800;

                flex-shrink: 0;
              "
            >
              ${index + 1}
            </span>

            <span
              style="
                overflow: hidden;
                text-overflow: ellipsis;
              "
            >
              ${item.placeName || "장소"}
            </span>
          </div>
        `;

      const customOverlay = new window.kakao.maps.CustomOverlay({
        map,

        position,

        content,

        yAnchor: 1,

        zIndex: 10,
      });

      markersRef.current.push(customOverlay);
    });

    /* =======================================================
     * 장소 전체가 보이도록 지도 이동
     * ======================================================= */

    if (!bounds.isEmpty()) {
      setTimeout(() => {
        if (mapInstance.current) {
          mapInstance.current.relayout();

          mapInstance.current.setBounds(bounds, 50, 50, 50, 50);
        }
      }, 50);
    }

    /* =======================================================
     * Cleanup
     * ======================================================= */

    return () => {
      markersRef.current.forEach((marker) => {
        marker.setMap(null);
      });

      markersRef.current = [];
    };
  }, [items, mapReady]);

  /* =========================================================
   * 실제 도로 경로 표시
   * ========================================================= */

  useEffect(() => {
    const map = mapInstance.current;

    if (!map || !mapReady) {
      return;
    }

    /* =======================================================
     * 기존 경로 삭제
     * ======================================================= */

    if (polylineRef.current) {
      polylineRef.current.setMap(null);

      polylineRef.current = null;
    }

    if (!routePath || !Array.isArray(routePath) || routePath.length < 2) {
      return;
    }

    /* =======================================================
     * 좌표 변환
     * ======================================================= */

    const roadLinePath = routePath
      .map((point) => {
        const lat = parseFloat(point.lat ?? point.latitude);

        const lng = parseFloat(point.lng ?? point.longitude);

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

    /* =======================================================
     * 도로 Polyline
     * ======================================================= */

    const polyline = new window.kakao.maps.Polyline({
      path: roadLinePath,

      strokeWeight: 5,

      strokeColor: "#2563eb",

      strokeOpacity: 0.85,

      strokeStyle: "solid",
    });

    polyline.setMap(map);

    polylineRef.current = polyline;

    /* =======================================================
     * 경로 전체가 보이도록 Bounds
     * ======================================================= */

    const routeBounds = new window.kakao.maps.LatLngBounds();

    roadLinePath.forEach((position) => {
      routeBounds.extend(position);
    });

    if (!routeBounds.isEmpty()) {
      setTimeout(() => {
        if (mapInstance.current) {
          mapInstance.current.relayout();

          mapInstance.current.setBounds(routeBounds, 50, 50, 50, 50);
        }
      }, 50);
    }

    /* =======================================================
     * Cleanup
     * ======================================================= */

    return () => {
      if (polylineRef.current === polyline) {
        polyline.setMap(null);

        polylineRef.current = null;
      }
    };
  }, [routePath, mapReady]);

  /* =========================================================
   * 화면
   * ========================================================= */

  return (
    <div
      ref={mapContainer}
      style={{
        width: "100%",

        height: "100%",

        minHeight: "650px",

        borderRadius: "12px",

        overflow: "hidden",

        position: "relative",

        cursor: "crosshair",
      }}
    />
  );
};

export default KakaoMap;
