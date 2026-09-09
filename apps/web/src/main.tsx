import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App.js";
import { AudioPlayer } from "./audio/AudioPlayer.js";
import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("AgentIntersect World root element is missing");
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 5_000 } },
});

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AudioPlayer />
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
