// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      // 백엔드 로그인 API 호출
      const res = await axiosInstance.post("/api/users/login", {
        email,
        password,
      });

      // 로그인 사용자 정보 localStorage 저장 (userId, nickname 등)
      localStorage.setItem("user", JSON.stringify(res.data));

      alert(`${res.data.nickname}님 환영합니다!`);

      // 🔥 [변경] 로그인 성공 후 '내 일정 목록/확인' 페이지로 이동
      navigate("/plans");
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "로그인 실패: 이메일이나 비밀번호를 확인하세요.",
      );
    }
  };

  return (
    <div
      style={{
        maxWidth: "400px",
        margin: "80px auto",
        padding: "24px",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          marginBottom: "24px",
          fontSize: "20px",
          fontWeight: "bold",
        }}
      >
        🔑 로그인
      </h2>

      {errorMessage && (
        <div
          style={{
            color: "#ef4444",
            marginBottom: "16px",
            fontSize: "14px",
            textAlign: "center",
          }}
        >
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{ display: "block", marginBottom: "6px", fontSize: "14px" }}
          >
            이메일
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              boxSizing: "border-box",
            }}
            required
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label
            style={{ display: "block", marginBottom: "6px", fontSize: "14px" }}
          >
            비밀번호
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              boxSizing: "border-box",
            }}
            required
          />
        </div>

        <button
          type="submit"
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          로그인
        </button>
      </form>

      <div
        style={{
          marginTop: "20px",
          textAlign: "center",
          fontSize: "14px",
          color: "#6b7280",
        }}
      >
        계정이 없으신가요?{" "}
        <Link
          to="/signup"
          style={{
            color: "#2563eb",
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          회원가입
        </Link>
      </div>
    </div>
  );
};

export default Login;
