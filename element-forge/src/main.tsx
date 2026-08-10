import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Editor from "./editor/Editor";
import { initializeSession } from "./editor/storage";

initializeSession().finally(() => {
    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <Editor pageId={new URLSearchParams(window.location.search).get("page") ?? "home"} />
        </StrictMode>,
    );
});
