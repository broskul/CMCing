/** @type {import('next').NextConfig} */
const remotePatterns = [];

try {
  if (process.env.CLOUDFLARE_R2_PUBLIC_URL) {
    const r2PublicUrl = new URL(process.env.CLOUDFLARE_R2_PUBLIC_URL);
    remotePatterns.push({
      protocol: r2PublicUrl.protocol.replace(':', ''),
      hostname: r2PublicUrl.hostname,
      pathname: '/**',
    });
  }
} catch {
  // Ignore malformed local env values; the upload API will validate at runtime.
}

const nextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;
