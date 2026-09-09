import { Component, ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

// Catches any render-time error anywhere in the app and shows a readable
// message instead of leaving the user with a blank white screen — the
// previous failure mode when Firebase init threw before React could render.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Ma3 app crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: "2rem",
          background: "#0a0a14", color: "#f0ede8", fontFamily: "system-ui, sans-serif",
          textAlign: "center", gap: 12,
        }}>
          <div style={{ fontSize: "2.5rem" }}>⚠️</div>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Something went wrong</h1>
          <p style={{ fontSize: ".85rem", color: "#9a96a8", maxWidth: 420 }}>
            The app hit an error while loading. Try refreshing — if it keeps happening, check the browser console (F12) for details.
          </p>
          <pre style={{
            fontSize: ".7rem", color: "#dc2626", background: "rgba(220,38,38,.08)",
            border: "1px solid rgba(220,38,38,.25)", borderRadius: 10, padding: "10px 14px",
            maxWidth: 520, overflowX: "auto", textAlign: "left",
          }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: "10px 22px", borderRadius: 10,
              background: "#d97706", border: "none", color: "#000",
              fontWeight: 800, fontSize: ".82rem", cursor: "pointer",
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
