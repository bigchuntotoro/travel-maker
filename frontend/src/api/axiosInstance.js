import axios from "axios";

const axiosInstance = axios.create({
  // Vite dev proxy를 사용할 때는 baseURL을 빈 문자열('')로 설정합니다.
  // API 호출 시 '/api/users/signup', '/api/plans' 와 같이 작성하면 Vite가 8084 포트로 프록시해 줍니다.
  baseURL: "",
  headers: {
    "Content-Type": "application/json",
  },
});

export default axiosInstance;
