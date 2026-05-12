import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// ✅ Attach token to every request
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // ❌ If no response → stop
    if (!error.response) {
      return Promise.reject(error);
    }

    // ❌ DO NOT retry refresh endpoint
    if (original.url.includes("/auth/refresh")) {
      return Promise.reject(error);
    }

    // ✅ Handle 401 once
    if (error.response.status === 401 && !original._retry) {
      original._retry = true;

      try {
        const { data } = await api.post("/auth/refresh");

        const newToken = data?.data?.accessToken;

        if (!newToken) throw new Error("No token");

        localStorage.setItem("accessToken", newToken);

        api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
        original.headers.Authorization = `Bearer ${newToken}`;

        return api(original);
      } catch (refreshError) {
        // ❌ STOP LOOP HERE
        localStorage.clear();

        delete api.defaults.headers.common["Authorization"];

        window.location.href = "/login";

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;