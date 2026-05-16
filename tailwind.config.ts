import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f1115',
        panel: '#161922',
        panel2: '#1c2030',
        border: '#252a3a',
        text: '#e6e8ef',
        muted: '#8a90a3',
        accent: '#7c5cff',
        good: '#5fd97a',
        warn: '#f5b14a',
        bad: '#e8553b',
        brill: '#36c5d6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
