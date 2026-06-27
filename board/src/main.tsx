import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import DriverApp from "./DriverApp";
import CustomerPortal from "./CustomerPortal";
import BrokerPortal from "./BrokerPortal";
import OwnerDash from "./OwnerDash";

// Lightweight surface routing — no router dependency. The dispatch board stays
// the default; the prototype surfaces live on their own paths. We read both the
// pathname (clean URLs in `vite dev`/`vite preview`, which fall back to
// index.html) AND the hash, so the surfaces still resolve on a dumb static host
// that doesn't do SPA fallback (loadedlogisticsnc.com/#track works anywhere).
function pickRoot() {
  const seg = (window.location.pathname.split("/")[1] || "").toLowerCase();
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  const route = seg || hash;
  if (route === "driver") return <DriverApp />;
  if (route === "track" || route === "portal") return <CustomerPortal />;
  if (route === "broker") return <BrokerPortal />;
  if (route === "owner") return <OwnerDash />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {pickRoot()}
  </React.StrictMode>
);
