import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'jsdom',
    // A real https host is required: cookies only persist when the document has a
    // host, and the helper writes `cookieSecure: true` cookies that browsers (and
    // jsdom) only store under https.
    environmentOptions: {
      jsdom: {
        url: 'https://store.example.com',
      },
    },
  },
});
