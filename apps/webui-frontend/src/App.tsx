import { Route, Routes } from "react-router-dom";

import LatestTopicsPage from "./pages/latest-topics/latest-topics";

import IndexPage from "@/pages/index";
import ChatMessagesPage from "@/pages/chat-messages";
import AIDigestPage from "@/pages/ai-digest";
import GroupsPage from "@/pages/groups";

function App() {
    return (
        <Routes>
            <Route element={<IndexPage />} path="/" />
            <Route element={<ChatMessagesPage />} path="/chat-messages" />
            <Route element={<AIDigestPage />} path="/ai-digest" />
            <Route element={<GroupsPage />} path="/groups" />
            <Route element={<LatestTopicsPage />} path="/latest-topics" />
        </Routes>
    );
}

export default App;
