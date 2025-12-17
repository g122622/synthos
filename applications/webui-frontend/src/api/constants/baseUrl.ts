// API服务封装
let API_BASE_URL = "";

if (window.location.hostname === "localhost") {
    API_BASE_URL = "http://localhost:3002";
} else {
    API_BASE_URL = `https://caliphal-neal-adverbially.ngrok-free.dev`;
}

export default API_BASE_URL;
