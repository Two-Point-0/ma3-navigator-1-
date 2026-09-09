import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="inner" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", textAlign: "center" }}>
      <div style={{ fontSize: "4rem", marginBottom: 12 }}>🚌</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 900, color: "var(--ready)", marginBottom: 6 }}>404</h2>
      <p style={{ fontSize: ".82rem", color: "var(--muted2)", marginBottom: 20 }}>This matatu took a wrong turn.</p>
      <Link href="/">
        <button className="btn btn-primary" style={{ padding: "10px 22px" }}>
          Back Home <ArrowRight size={14} />
        </button>
      </Link>
    </div>
  );
}
