import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default 1MB (§serverActions.md) — troppo poco per il PDF di un ODA
      // emesso (richiesta dall'utente). 10MB copre comodamente uno scan
      // firmato, con margine per l'overhead di multipart/form-data.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
