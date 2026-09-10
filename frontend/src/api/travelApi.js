import axiosInstance from "./axiosInstance";

// 여행 일정 등록 (POST /api/plans)
export const createPlan = async (planData) => {
  const response = await axiosInstance.post("/api/plans", planData);
  return response.data;
};

// 여행 일정 상세 조회 (GET /api/plans/{planId})
export const getPlan = async (planId) => {
  const response = await axiosInstance.get(`/api/plans/${planId}`);
  return response.data;
};

// 여행 일정 삭제 (DELETE /api/plans/{planId})
export const deletePlan = async (planId) => {
  const response = await axiosInstance.delete(`/api/plans/${planId}`);
  return response.data;
};
