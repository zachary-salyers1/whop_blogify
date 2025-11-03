import { withWhopAppConfig } from "@whop/react/next.config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	images: {
		remotePatterns: [{ hostname: "**" }],
	},
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "X-Frame-Options",
						value: "ALLOWALL",
					},
					{
						key: "Content-Security-Policy",
						value: "frame-ancestors *",
					},
				],
			},
		];
	},
};

export default withWhopAppConfig(nextConfig);
