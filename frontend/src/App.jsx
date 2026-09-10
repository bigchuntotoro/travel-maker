// src/App.jsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import PlanList from "./pages/PlanList"; // 🔥 추가
import PlanDetail from "./pages/PlanDetail"; // 🔥 추가

// 로그인 상태 체크 전용 보호 라우트
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem("user");

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* 공개 라우트 */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* 1. 로그인 후 메인 화면: 일정 목록 조회 페이지 */}
        <Route
          path="/plans"
          element={
            <ProtectedRoute>
              <PlanList />
            </ProtectedRoute>
          }
        />

        {/* 2. 일정 상세 확인 & 수정/삭제 페이지 */}
        <Route
          path="/plans/:planId"
          element={
            <ProtectedRoute>
              <PlanDetail />
            </ProtectedRoute>
          }
        />

        {/* 3. 새 일정 만들기 페이지 */}
        <Route
          path="/create-plan"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        {/* 루트(/) 접속 시 로그인 되어있으면 일정 목록(/plans)으로, 없으면 로그인(/login)으로 이동 */}
        <Route path="/" element={<Navigate to="/plans" replace />} />

        {/* 예외 경로 처리 */}
        <Route path="*" element={<Navigate to="/plans" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
