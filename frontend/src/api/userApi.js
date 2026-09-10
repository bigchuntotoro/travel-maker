import axiosInstance from "./axiosInstance";

export const signupApi = async (userData) => {
  const response = await axiosInstance.post("/api/users/signup", userData);
  return response.data;
};
