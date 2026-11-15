import { useState } from "react";
import { Shield, FileText, ShoppingBag, Mic2 } from "lucide-react";
import PageTabs from "@/components/PageTabs";
import { LEGAL_UPDATED, PRIVACY, ROAST, SHOP, TERMS, type LegalSection } from "@/data/legalText";

const TABS = [{ id: "privacy", label: "Privacy", Icon: Shield }, { id: "terms", label: "Terms", Icon: FileText }, { id: "shop", label: "Shop", Icon: ShoppingBag }, { id: "roast", label: "Roast", Icon: Mic2 }] as const;
const SETS: Record<string, { title: string; sections: LegalSection[] }> = {
  privacy: { title: "Privacy notice", sections: PRIVACY }, terms: { title: "Terms of use", sections: TERMS }, shop: { title: "Shop terms", sections: SHOP }, roast: { title: "Mchongwano roast rules", sections: ROAST },
};

export default function LegalPage() {
  const initial = new URLSearchParams(window.location.search).get("tab");
  const [tab, setTab] = useState(initial && SETS[initial] ? initial : "privacy");
  const set = SETS[tab];
  return <div className="inner" style={{ paddingTop: 12, paddingBottom: 90 }}>
    <PageTabs label="Legal sections" active={tab} tabs={TABS} onChange={setTab} />
    <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", margin: "12px 0 2px" }}>{set.title}</h2>
    <small style={{ color: "var(--muted2)" }}>Last updated {LEGAL_UPDATED}</small>
    {/* DRAFT banner: delete this block after a lawyer has checked the text and you have filled in your details. */}
    <div className="ios-glass" style={{ padding: 9, margin: "10px 0", fontSize: ".6rem", color: "var(--ready)", lineHeight: 1.45 }}>Draft text. Not yet reviewed by a lawyer.</div>
    {set.sections.map(section => <section key={section.title} style={{ marginTop: 12 }}>
      <b style={{ fontSize: ".78rem" }}>{section.title}</b>
      {section.body.map((paragraph, index) => <p key={index} style={{ fontSize: ".7rem", lineHeight: 1.6, color: "var(--muted2)", margin: "5px 0 0" }}>{paragraph}</p>)}
    </section>)}
  </div>;
}
