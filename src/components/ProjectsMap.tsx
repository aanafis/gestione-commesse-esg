"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { CommessaMapRow } from "@/lib/queries/commessa-list";
import { COMMESSA_STATUS_LABELS, label } from "@/lib/labels";

// Leaflet "puro" (non react-leaflet): il componente è comunque client-only
// (usa document/window), ma evitiamo tutte le sottigliezze SSR/hydration
// dei wrapper React attorno a Leaflet — costruiamo la mappa a mano in un
// useEffect, stessa scelta di semplicità del resto del progetto.
//
// Marker come divIcon con un cerchio colorato invece dei pin di default di
// Leaflet: le icone di default richiedono di risolvere i percorsi delle
// immagini nel bundler (un problema noto con Next.js/Turbopack), un divIcon
// inline lo evita del tutto.
export function ProjectsMap({ commesse }: { commesse: CommessaMapRow[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html:
          '<div style="width:16px;height:16px;border-radius:9999px;background:#2563eb;' +
          'border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const points: [number, number][] = [];
      for (const c of commesse) {
        const lat = Number(c.latitude);
        const lng = Number(c.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        points.push([lat, lng]);

        const popupHtml = `
          <div style="font-size:13px;line-height:1.4;">
            <strong>${escapeHtml(c.code)}</strong> — ${escapeHtml(label(COMMESSA_STATUS_LABELS, c.status))}<br/>
            ${c.assetName ? `${escapeHtml(c.assetName)}<br/>` : ""}
            ${escapeHtml(c.clientName)}<br/>
            <span style="color:#64748b">${escapeHtml(c.address ?? "")}</span>
          </div>
        `;
        L.marker([lat, lng], { icon }).addTo(map).bindPopup(popupHtml);
      }

      if (points.length > 0) {
        map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
      } else {
        map.setView([42.5, 12.5], 5); // fallback: centro Italia
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [commesse]);

  return <div ref={containerRef} className="h-[70vh] w-full rounded-lg border border-border" />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
