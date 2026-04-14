import type { NextConfig } from "next";
import { withWorkflow } from "@workflow/next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/slides/directives",
        destination: "/slides/failure-crash-pattern",
        permanent: false,
      },
      {
        source: "/slides/idempotency",
        destination: "/slides/failure-retry-pattern",
        permanent: false,
      },
      {
        source: "/slides/naive",
        destination: "/slides/failure-retry-naive",
        permanent: false,
      },
      {
        source: "/slides/hooks",
        destination: "/slides/failure-slow-restaurant-pattern",
        permanent: false,
      },
      {
        source: "/slides/saga",
        destination: "/slides/failure-driver-refuses-pattern",
        permanent: false,
      },
    ];
  },
};

export default withWorkflow(nextConfig);
