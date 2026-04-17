import type { NextConfig } from "next";
import { withWorkflow } from "@workflow/next";

const nextConfig: NextConfig = {
  onDemandEntries: {
    // Keep all 26 slides compiled in memory during dev — no disposal lag when navigating
    maxInactiveAge: 60 * 60 * 1000, // 1 hour
    pagesBufferLength: 30,           // more than the 26 slides
  },
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
