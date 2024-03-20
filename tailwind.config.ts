import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{jsx,tsx}",
  ],
  theme: {
    extend: {
        scale: {
          "120": "1.2",
        },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
} satisfies Config