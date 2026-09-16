/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['@react-pdf/renderer']
  },
  webpack: (config, { nextRuntime }) => {
    // instrumentation.ts is compiled twice — once for the Node.js runtime,
    // once for the Edge runtime (middleware bootstraps it too). Our
    // register() only ever runs the node-cron / Prisma / nodemailer branch
    // on the Node.js runtime (guarded by NEXT_RUNTIME), but webpack still
    // statically bundles that dynamic import()'s dependency graph for the
    // Edge build, and those packages use Node built-ins (fs, path,
    // child_process, ...) that don't exist there. Stub them out of the Edge
    // bundle specifically — they're never actually called from it.
    if (nextRuntime === 'edge') {
      config.resolve.alias = {
        ...config.resolve.alias,
        'node-cron': false,
        nodemailer: false,
        '@prisma/client': false
      };
    }
    return config;
  }
};

export default nextConfig;
