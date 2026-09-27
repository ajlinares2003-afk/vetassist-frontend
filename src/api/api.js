import axios from "axios";

const api = axios.create({
  baseURL: "https://vetassist-ai.onrender.com",
});

export default api;