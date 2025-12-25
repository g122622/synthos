import { Route, Routes } from "react-router-dom";

import LatestTopicsPage from "./pages/latest-topics/latest-topics";
import ReportsPage from "./pages/reports/reports";

import IndexPage from "@/pages/index";
import ChatMessagesPage from "@/pages/chat-messages";
import AIDigestPage from "@/pages/ai-digest";
import GroupsPage from "@/pages/groups";
import RagPage from "@/pages/rag/rag";
import ConfigPage from "@/pages/config-panel/config";

function App() {
    return (
        <Routes>
            <Route element={<IndexPage />} path="/" />
            <Route element={<ChatMessagesPage />} path="/chat-messages" />
            <Route element={<AIDigestPage />} path="/ai-digest" />
            <Route element={<GroupsPage />} path="/groups" />
            <Route element={<LatestTopicsPage />} path="/latest-topics" />
            <Route element={<ReportsPage />} path="/reports" />
            <Route element={<RagPage />} path="/rag" />
            <Route element={<ConfigPage />} path="/config" />
        </Routes>
    );
}

export default App;
