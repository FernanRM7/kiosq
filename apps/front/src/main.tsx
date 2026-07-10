import { QueryClientProvider } from "@tanstack/react-query";
import { Component, lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import App from "./App.tsx";
import { queryClient } from "./lib/query-client";

const ReactQueryDevtools = lazy(async () => {
  const m = await import("@tanstack/react-query-devtools");

  return { default: m.ReactQueryDevtools };
});

window.addEventListener("error", (event) => {
  console.error("[Global Error]", {
    col: event.colno,
    err: event.error,
    line: event.lineno,
    msg: event.message,
    src: event.filename,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Promise]", event.reason);
});

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null, hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error("[ErrorBoundary]", error);
    return { error, hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h1>Algo salió mal</h1>
          <p>
            Ha ocurrido un error inesperado. Recarga la página para continuar.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.querySelector("#root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        {import.meta.env.DEV && (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
