// Geocodifica indirizzo → coordinate via Nominatim (OpenStreetMap) — scelta
// dall'utente al posto di Google Maps: gratuito, nessuna chiave API/carta di
// credito da configurare. Politica d'uso di Nominatim: max ~1 richiesta al
// secondo e uno User-Agent che identifichi l'app, mai uso massivo — qui è
// più che rispettata (poche decine di commesse in tutto, una chiamata solo
// quando l'indirizzo viene inserito o cambiato, non ad ogni salvataggio).
//
// Best-effort: se l'indirizzo non viene trovato (typo, indirizzo incompleto,
// servizio momentaneamente non raggiungibile), si salva comunque il testo
// dell'indirizzo e si torna null — niente coordinate sulla mappa per quella
// commessa, ma il salvataggio della commessa non fallisce mai per questo.

export type GeocodeResult = { latitude: number; longitude: number };

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, {
      headers: {
        // Richiesto dalla usage policy di Nominatim — identifica chi chiama.
        "User-Agent": "gestione-commesse-esg (uso interno, Il Prisma)",
      },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = data[0];
    if (!first) return null;

    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch {
    return null;
  }
}
