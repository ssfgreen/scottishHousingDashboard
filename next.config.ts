/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/sparql",
        destination: "http://statistics.gov.scot/sparql",
      },
    ];
  },
};

module.exports = nextConfig;
