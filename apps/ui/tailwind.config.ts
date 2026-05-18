import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        quality: {
          0: '#9d9d9d',
          1: '#ffffff',
          2: '#1eff00',
          3: '#0070dd',
          4: '#a335ee',
          5: '#ff8000',
        },
        panel: '#1a1a1f',
        panel2: '#23232b',
        ink: '#e6e6ea',
        muted: '#8b8b95',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
