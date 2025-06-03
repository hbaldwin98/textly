export default {
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './src/**/*.{js,ts,jsx,tsx,svelte}',
    './src/**/*.svelte',
    './src/**/*.html'
  ],
  darkMode: 'class',
  safelist: [
    // Add any dynamic classes that Tailwind might not detect
    'dark',
    'light',
    // Add any classes that are dynamically generated
    /^bg-/,
    /^text-/,
    /^border-/,
    /^hover:/,
    /^focus:/,
    /^active:/
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Consolas', 'Courier New', 'monospace']
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            code: {
              backgroundColor: 'rgba(27,31,35,0.05)',
              borderRadius: '3px',
              fontSize: '85%',
              margin: '0',
              padding: '0.2em 0.4em',
              fontWeight: 'normal'
            },
            'code::before': {
              content: '""'
            },
            'code::after': {
              content: '""'
            }
          }
        },
        invert: {
          css: {
            code: {
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: '#e6fffa'
            }
          }
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography')
  ]
} 