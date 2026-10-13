import type { NextConfig } from "next"

const nextConfig: NextConfig = {

  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*", "*.local"],
}

export default nextConfig
