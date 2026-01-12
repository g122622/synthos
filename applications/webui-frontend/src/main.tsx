import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.tsx";
import { Provider } from "./provider.tsx";
import "@/styles/globals.css";
import { preventPageClose } from "./util/closePrevension.ts";
import { DeviceType, getDeviceType } from "./util/getDeviceType.ts";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <BrowserRouter>
            <Provider>
                <App />
            </Provider>
        </BrowserRouter>
    </React.StrictMode>
);

if (getDeviceType() !== DeviceType.PC) {
    preventPageClose();
}
