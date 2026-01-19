// API服务封装
let API_BASE_URL = "";

// Dev: Vite/localhost runs frontend separately from backend.
// Prod (Docker/nginx): backend is reverse-proxied, so use relative URL.
if (window.location.hostname === "localhost") {
    API_BASE_URL = "http://localhost:3002";
} else {
    API_BASE_URL = "";
}

export default API_BASE_URL;
