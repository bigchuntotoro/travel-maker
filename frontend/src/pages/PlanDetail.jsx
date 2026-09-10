// src/pages/PlanDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import KakaoMap from "../components/map/KakaoMap";

const PlanDetail = () => {
  const { planId } = useParams();
  const navigate = useNavigate();

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🔥 수정 모드 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editItems, setEditItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // 🔍 장소 검색 및 지도 중심 이동 관련 상태
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlaceForMap, setSelectedPlaceForMap] = useState(null);

  useEffect(() => {
    fetchPlanDetail();
  }, [planId]);

  // 일정 상세 조회
  const fetchPlanDetail = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/api/plans/${planId}`);
      setPlan(res.data);
      initEditState(res.data);
    } catch (err) {
      console.error("일정 상세 조회 실패:", err);
      setError("일정 정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 수정 Form 초기값 세팅
  const initEditState = (data) => {
    setEditTitle(data.title || "");
    setEditStartDate(data.startDate || "");
    setEditEndDate(data.endDate || "");
    setEditItems(data.items ? [...data.items] : []);
    setSearchKeyword("");
    setSearchResults([]);
    setSelectedPlaceForMap(null);
  };

  // 🗑️ 일정 삭제 처리
  const handleDeletePlan = async () => {
    if (!window.confirm("정말로 이 일정을 삭제하시겠습니까?")) return;

    try {
      await axiosInstance.delete(`/api/plans/${planId}`);
      alert("일정이 삭제되었습니다.");
      navigate("/plans");
    } catch (err) {
      console.error("일정 삭제 실패:", err);
      alert("일정 삭제 중 오류가 발생했습니다.");
    }
  };

  // ✏️ 수정 모드 취소
  const handleCancelEdit = () => {
    initEditState(plan);
    setIsEditing(false);
  };

  // 💾 일정 수정 저장
  const handleSaveEdit = async () => {
    if (!editTitle) return alert("여행 제목을 입력해 주세요.");
    if (!editStartDate || !editEndDate)
      return alert("여행 기간을 입력해 주세요.");
    if (editItems.length === 0)
      return alert("최소 하나 이상의 장소가 필요합니다.");

    // 순서 재정렬 및 visitOrder, dayNumber 동기화
    const updatedItems = editItems.map((item, idx) => ({
      ...item,
      planId: Number(planId),
      dayNumber: item.dayNumber || 1,
      visitOrder: idx + 1,
    }));

    const payload = {
      title: editTitle,
      startDate: editStartDate,
      endDate: editEndDate,
      items: updatedItems,
    };

    try {
      setIsSaving(true);
      await axiosInstance.put(`/api/plans/${planId}`, payload);
      alert("일정이 수정되었습니다.");
      setIsEditing(false);
      fetchPlanDetail(); // 최신 데이터 재조회
    } catch (err) {
      console.error("일정 수정 실패:", err);
      alert("일정 수정 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // 🔍 카카오 장소 검색 API 함수
  const handleSearchPlaces = (e) => {
    e.preventDefault();
    if (!searchKeyword.trim()) return alert("검색어를 입력해주세요.");

    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      return alert("카카오 지도 라이브러리가 로드되지 않았습니다.");
    }

    setIsSearching(true);
    const ps = new window.kakao.maps.services.Places();

    ps.keywordSearch(searchKeyword, (data, status) => {
      setIsSearching(false);
      if (status === window.kakao.maps.services.Status.OK) {
        setSearchResults(data);
      } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
        alert("검색 결과가 존재하지 않습니다.");
        setSearchResults([]);
      } else {
        alert("장소 검색 중 오류가 발생했습니다.");
        setSearchResults([]);
      }
    });
  };

  // ➕ [검색 결과]에서 장소 추가 시 (지도 이동 및 검색 결과 초기화 포함)
  const handleAddPlaceFromSearch = (place) => {
    const lat = parseFloat(place.y);
    const lng = parseFloat(place.x);

    // 지도 이동용 위치 지정
    setSelectedPlaceForMap({ lat, lng });

    const newItem = {
      planId: Number(planId),
      dayNumber: 1,
      placeName: place.place_name,
      latitude: lat,
      longitude: lng,
      visitOrder: editItems.length + 1,
      memo: "",
    };

    setEditItems((prev) => [...prev, newItem]);

    // ✨ 검색창 및 결과 초기화
    setSearchKeyword("");
    setSearchResults([]);
  };

  // 🗺️ [지도 직접 클릭]시 지명/주소 기반 장소 추가 콜백 함수
  const handleMapPlaceSelect = (placeInfo) => {
    if (!isEditing) return; // 수정 모드일 때만 클릭 등록 가능

    const newItem = {
      planId: Number(planId),
      dayNumber: 1,
      placeName: placeInfo.placeName,
      latitude: placeInfo.latitude,
      longitude: placeInfo.longitude,
      visitOrder: editItems.length + 1,
      memo: "",
    };

    setEditItems((prev) => [...prev, newItem]);
  };

  // 📍 수정 모드: 장소 목록에서 특정 장소 삭제
  const handleRemoveItem = (index) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  // 📍 수정 모드: 장소 순서 이동 (Up/Down)
  const handleMoveItem = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= editItems.length) return;

    const updated = [...editItems];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setEditItems(updated);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0", color: "#6b7280" }}>
        일정 상세 정보를 불러오는 중입니다...
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0" }}>
        <p style={{ color: "#ef4444", marginBottom: "16px" }}>
          {error || "일정을 찾을 수 없습니다."}
        </p>
        <button
          onClick={() => navigate("/plans")}
          style={{
            padding: "8px 16px",
            backgroundColor: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  const currentItems = isEditing ? editItems : plan.items || [];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
      {/* 🎯 상단 컨트롤 영역 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={() => navigate("/plans")}
          style={{
            padding: "8px 16px",
            backgroundColor: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#374151",
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
          }}
        >
          ⬅️ 목록으로
        </button>

        {/* 수정 / 삭제 / 저장 컨트롤 버튼 */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {isEditing ? (
            <>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                {isSaving ? "저장 중..." : "💾 저장완료"}
              </button>
              <button
                onClick={handleCancelEdit}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ffffff",
                  color: "#4b5563",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                ✏️ 수정
              </button>
              <button
                onClick={handleDeletePlan}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                🗑️ 삭제
              </button>
            </>
          )}
        </div>
      </div>

      {/* 일정 기본정보 영역 (조회 vs 수정) */}
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "20px 24px",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          marginBottom: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        {isEditing ? (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="여행 제목 입력"
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
              }}
            />
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                }}
              />
              <span>~</span>
              <input
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: "bold",
                margin: "0 0 8px 0",
                color: "#111827",
              }}
            >
              {plan.title}
            </h1>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
              📅 여행 기간: {plan.startDate} ~ {plan.endDate} | 📍 방문 장소:{" "}
              {currentItems.length}곳
            </p>
          </>
        )}
      </div>

      {/* 지도 및 동선 경로 목록 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "20px",
          height: "650px",
        }}
      >
        {/* ✨ KakaoMap에 클릭 이벤트 콜백 및 선택 장소 전달 */}
        <KakaoMap
          items={currentItems}
          onPlaceSelect={handleMapPlaceSelect}
          selectedPlaceForMap={selectedPlaceForMap}
        />

        {/* 우측 장소 목록 및 검색 폼 */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* 수정 모드일 때 나타나는 장소 검색 창 */}
          {isEditing && (
            <div
              style={{
                marginBottom: "16px",
                paddingBottom: "16px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  margin: "0 0 8px 0",
                  color: "#1f2937",
                }}
              >
                🔍 장소 검색 또는 지도 직접 클릭하여 추가
              </h3>
              <form
                onSubmit={handleSearchPlaces}
                style={{ display: "flex", gap: "6px" }}
              >
                <input
                  type="text"
                  placeholder="예: 해운대, 맛집"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "13px",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  {isSearching ? "검색중..." : "검색"}
                </button>
              </form>

              {/* 검색 결과 리스트 */}
              {searchResults.length > 0 && (
                <div
                  style={{
                    marginTop: "8px",
                    maxHeight: "140px",
                    overflowY: "auto",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    backgroundColor: "#f9fafb",
                  }}
                >
                  {searchResults.map((place) => (
                    <div
                      key={place.id}
                      style={{
                        padding: "8px",
                        borderBottom: "1px solid #f3f4f6",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          marginRight: "8px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: "bold",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {place.place_name}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#6b7280",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {place.road_address_name || place.address_name}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddPlaceFromSearch(place)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#10b981",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "11px",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        + 추가
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 방문 코스 목록 영역 */}
          <h2
            style={{
              fontSize: "16px",
              fontWeight: "bold",
              marginBottom: "12px",
              color: "#374151",
            }}
          >
            🚩 {isEditing ? "현재 코스 목록" : "방문 코스 상세"}
          </h2>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {currentItems.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: "14px" }}>
                등록된 장소가 없습니다.
              </p>
            ) : (
              currentItems.map((item, index) => (
                <div
                  key={item.itemId || index}
                  style={{
                    padding: "10px",
                    border: "1px solid #f3f4f6",
                    backgroundColor: "#f9fafb",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: "#2563eb",
                        color: "#ffffff",
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: "bold",
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          color: "#1f2937",
                        }}
                      >
                        {item.placeName}
                      </h4>
                      {item.memo && (
                        <p
                          style={{
                            margin: "2px 0 0 0",
                            fontSize: "11px",
                            color: "#6b7280",
                          }}
                        >
                          📝 {item.memo}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 수정 모드 컨트롤: 순서 변경 및 삭제 */}
                  {isEditing && (
                    <div style={{ display: "flex", gap: "2px" }}>
                      <button
                        onClick={() => handleMoveItem(index, -1)}
                        disabled={index === 0}
                        style={{
                          padding: "2px 5px",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveItem(index, 1)}
                        disabled={index === currentItems.length - 1}
                        style={{
                          padding: "2px 5px",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        style={{
                          padding: "2px 5px",
                          fontSize: "11px",
                          color: "#ef4444",
                          border: "none",
                          backgroundColor: "transparent",
                          cursor: "pointer",
                        }}
                      >
                        ✖
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanDetail;
