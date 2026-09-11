// src/pages/PlanList.jsx
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";

const formatDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return "-";
  return `${startDate} ~ ${endDate}`;
};

const PlanList = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 카드별 진행 중인 액션 상태 (버튼 중복 클릭 방지 및 로딩 표시용)
  const [copyingId, setCopyingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [sharingId, setSharingId] = useState(null);

  // 로그아웃 처리
  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  // 로그인한 유저의 여행 일정 목록 조회
  const fetchPlans = useCallback(async () => {
    if (!user.userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      // 백엔드 API 호출 (유저 ID 기준 목록 조회 또는 전체 내 일정 목록 조회)
      const res = await axiosInstance.get(`/api/plans?userId=${user.userId}`);
      setPlans(res.data || []);
    } catch (err) {
      console.error("일정 목록 조회 실패:", err);
      setError("여행 일정을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user.userId]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // ✏️ 수정: 상세 페이지로 이동 (해당 페이지에서 '편집' 버튼으로 바로 진입하도록 플래그 전달)
  const handleEditPlan = (e, plan) => {
    e.stopPropagation();
    navigate(`/plans/${plan.planId}`, { state: { autoEdit: true } });
  };

  // 📋 복사: 기존 일정을 그대로 불러와 제목만 바꿔 새 일정으로 저장 (createPlan 재사용)
  const handleCopyPlan = async (e, plan) => {
    e.stopPropagation();
    if (copyingId || deletingId) return;
    if (!window.confirm(`"${plan.title}" 일정을 복사하시겠습니까?`)) return;

    try {
      setCopyingId(plan.planId);
      // 목록 응답에 items가 없을 수 있으므로 상세 조회로 전체 데이터를 가져온다.
      const detailRes = await axiosInstance.get(`/api/plans/${plan.planId}`);
      const source = detailRes.data || plan;

      const payload = {
        userId: user.userId,
        title: `${source.title} (복사본)`,
        startDate: source.startDate,
        endDate: source.endDate,
        items: (source.items || []).map((item) => ({
          placeName: item.placeName,
          address: item.address,
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          dayNumber: Number(item.dayNumber || 1),
          visitOrder: Number(item.visitOrder || 1),
          stayMinutes: Number(item.stayMinutes || 60),
        })),
      };

      await axiosInstance.post("/api/plans", payload);
      alert("일정이 복사되었습니다.");
      await fetchPlans();
    } catch (err) {
      console.error("일정 복사 실패:", err);
      alert("일정 복사에 실패했습니다.");
    } finally {
      setCopyingId(null);
    }
  };

  // 🗑 삭제: 목록에서 바로 삭제
  const handleDeletePlan = async (e, plan) => {
    e.stopPropagation();
    if (copyingId || deletingId) return;
    if (!window.confirm(`"${plan.title}" 일정을 삭제하시겠습니까?`)) return;

    try {
      setDeletingId(plan.planId);
      await axiosInstance.delete(`/api/plans/${plan.planId}`);
      setPlans((prev) => prev.filter((p) => p.planId !== plan.planId));
    } catch (err) {
      console.error("일정 삭제 실패:", err);
      alert("일정 삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  // 🔗 공유: 상세 페이지 링크를 클립보드에 복사
  // ⚠️ 별도의 '공유용 읽기 전용' 백엔드 API가 없는 상태라, 우선은 현재 상세 페이지 URL을
  //    복사해주는 수준으로 구현했습니다. 로그인하지 않은 사용자와 안전하게 공유하려면
  //    서버에 공유 토큰 발급 API가 추가로 필요합니다.
  const handleSharePlan = async (e, plan) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/plans/${plan.planId}`;

    try {
      setSharingId(plan.planId);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        alert(
          "일정 링크가 클립보드에 복사되었습니다.\n(로그인이 필요한 페이지이니, 동행자도 같은 계정으로 접속해야 볼 수 있어요.)",
        );
      } else {
        window.prompt("아래 링크를 복사하세요.", shareUrl);
      }
    } catch (err) {
      console.error("링크 복사 실패:", err);
      window.prompt("아래 링크를 복사하세요.", shareUrl);
    } finally {
      setSharingId(null);
    }
  };

  const cardActionButtonStyle = (color) => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "7px 6px",
    border: "1px solid #e5e7eb",
    borderRadius: 7,
    background: "#ffffff",
    color,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
      {/* 헤더 영역 */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
        }}
      >
        <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#111827" }}>
          ✈️ TravelMaker - 내 여행 일정
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}
          >
            👤 {user.nickname || "여행가"}님
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: "6px 12px",
              backgroundColor: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 상단 액션 바 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#1f2937" }}>
          📋 저장된 일정 목록 ({plans.length})
        </h2>
        <button
          onClick={() => navigate("/create-plan")}
          style={{
            padding: "10px 18px",
            backgroundColor: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          ➕ 새 일정 만들기
        </button>
      </div>

      {/* 일정 카드 목록 영역 */}
      {loading ? (
        <div
          style={{ textAlign: "center", padding: "80px 0", color: "#6b7280" }}
        >
          일정 목록을 불러오는 중입니다...
        </div>
      ) : error ? (
        <div
          style={{ textAlign: "center", padding: "80px 0", color: "#ef4444" }}
        >
          {error}
        </div>
      ) : plans.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 0",
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
          }}
        >
          <p
            style={{ fontSize: "16px", color: "#6b7280", marginBottom: "16px" }}
          >
            아직 등록된 여행 일정이 없습니다.
          </p>
          <button
            onClick={() => navigate("/create-plan")}
            style={{
              padding: "8px 16px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            첫 번째 일정 만들기
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "20px",
          }}
        >
          {plans.map((plan) => {
            const isBusy =
              copyingId === plan.planId ||
              deletingId === plan.planId ||
              sharingId === plan.planId;

            return (
              <div
                key={plan.planId}
                onClick={() => navigate(`/plans/${plan.planId}`)}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  padding: "20px",
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 1px 3px rgba(0,0,0,0.05)";
                }}
              >
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#111827",
                    marginBottom: "8px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {plan.title}
                </h3>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#6b7280",
                    margin: "0 0 12px 0",
                  }}
                >
                  📅 {formatDateRange(plan.startDate, plan.endDate)}
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "13px",
                    color: "#2563eb",
                    fontWeight: "600",
                    marginBottom: "14px",
                  }}
                >
                  <span>
                    📍 방문 장소 {(plan.items && plan.items.length) || 0}곳
                  </span>
                  <span>상세보기 ➔</span>
                </div>

                {/* 수정 / 복사 / 삭제 / 공유 */}
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    paddingTop: 12,
                    borderTop: "1px solid #f3f4f6",
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => handleEditPlan(e, plan)}
                    disabled={isBusy}
                    style={cardActionButtonStyle("#374151")}
                    title="일정 수정"
                  >
                    ✏️ 수정
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCopyPlan(e, plan)}
                    disabled={isBusy}
                    style={cardActionButtonStyle("#2563eb")}
                    title="일정 복사"
                  >
                    {copyingId === plan.planId ? "복사 중..." : "📋 복사"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleSharePlan(e, plan)}
                    disabled={isBusy}
                    style={cardActionButtonStyle("#059669")}
                    title="일정 공유"
                  >
                    {sharingId === plan.planId ? "복사 중..." : "🔗 공유"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeletePlan(e, plan)}
                    disabled={isBusy}
                    style={cardActionButtonStyle("#dc2626")}
                    title="일정 삭제"
                  >
                    {deletingId === plan.planId ? "삭제 중..." : "🗑 삭제"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlanList;
