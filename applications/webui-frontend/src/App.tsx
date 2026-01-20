import { Navigate, Route, Routes } from "react-router-dom";

import LatestTopicsPage from "./pages/latest-topics/latest-topics";
import ReportsPage from "./pages/reports/reports";

import IndexPage from "@/pages/index";
import ChatMessagesPage from "@/pages/chat-messages";
import AIDigestPage from "@/pages/ai-digest";
import GroupsPage from "@/pages/groups";
import AiChatPage from "@/pages/ai-chat/ai-chat";
import ConfigPage from "@/pages/config-panel/config";
import SystemMonitorPage from "@/pages/system-monitor";

function App() {
    return (
        <Routes>
            <Route element={<IndexPage />} path="/" />
            <Route element={<ChatMessagesPage />} path="/chat-messages" />
            <Route element={<AIDigestPage />} path="/ai-digest" />
            <Route element={<GroupsPage />} path="/groups" />
            <Route element={<LatestTopicsPage />} path="/latest-topics" />
            <Route element={<ReportsPage />} path="/reports" />
            <Route element={<AiChatPage />} path="/ai-chat" />
            <Route element={<Navigate replace to="/ai-chat" />} path="/rag" />
            <Route element={<ConfigPage />} path="/config" />
            <Route element={<SystemMonitorPage />} path="/system-monitor" />
        </Routes>
    );
}

export default App;
