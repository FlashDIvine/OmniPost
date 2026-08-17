/**
 * Type-safe configuration for OmniPost web application.
 */
export const config = {
  apiUrl:
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') ||
    'http://localhost:3001/api',
  appName: 'OmniPost',
  appDescription: 'Unified Social Media Publishing Hub',
} as const;
