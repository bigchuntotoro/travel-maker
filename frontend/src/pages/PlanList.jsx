// src/pages/PlanList.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";

const PlanList = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 로그아웃 처리
  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  // 로그인한 유저의 여행 일정 목록 조회
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        // 백엔드 API 호출 (유저 ID 기준 목록 조회 또는 전체 내 일정 목록 조회)
        const res = await axiosInstance.get(`/api/plans?userId=${user.userId}`);
        setPlans(res.data);
      } catch (err) {
        console.error("일정 목록 조회 실패:", err);
        setError("여행 일정을 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    if (user.userId) {
      fetchPlans();
    } else {
      setLoading(false);
    }
  }, [user.userId]);

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
          {plans.map((plan) => (
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
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
              }}
            >
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: "#111827",
                  marginBottom: "8px",
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
                📅 {plan.startDate} ~ {plan.endDate}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "13px",
                  color: "#2563eb",
                  fontWeight: "600",
                }}
              >
                <span>
                  📍 방문 장소 {(plan.items && plan.items.length) || 0}곳
                </span>
                <span>상세보기 ➔</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlanList;
