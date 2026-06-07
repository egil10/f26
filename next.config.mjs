/** @type {import('next').NextConfig} */

// The data files never change at a given URL (we bump ?v= when regenerating),
// so cache them hard instead of revalidating on every visit. See BLUEPRINT §6.
const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];

const nextConfig = {
  async headers() {
    return [
      { source: "/players.json", headers: immutable },
      { source: "/teams.json", headers: immutable },
    ];
  },
};

export default nextConfig;
