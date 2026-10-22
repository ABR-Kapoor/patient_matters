import type { Config } from 'tailwindcss';

const config: Config = {
    darkMode: ['class'],
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: { '2xl': '1400px' },
        },
        extend: {
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',

                /* ── AuraSutra Design System Palette ── */
                forest: {
                    400: '#2ea05a',
                    500: '#22854a',   // primary action
                    600: '#1d6b3c',
                    700: '#16522e',
                    800: '#103d22',
                    900: '#0a2e1a',
                },
                sage: {
                    50:  '#f2faf5',
                    100: '#e4f5ec',
                    200: '#c6ebd6',
                    300: '#a4dcba',
                    400: '#76c597',
                },

                /* ── Override primary to match forest-500 ── */
                primary: {
                    DEFAULT: '#22854a',
                    50:  '#f2faf5',
                    100: '#e4f5ec',
                    200: '#c6ebd6',
                    300: '#a4dcba',
                    400: '#2ea05a',
                    500: '#22854a',
                    600: '#1d6b3c',
                    700: '#16522e',
                    800: '#103d22',
                    900: '#0a2e1a',
                    foreground: '#FFFFFF',
                },
                secondary: {
                    DEFAULT: '#a4dcba',
                    400: '#76c597',
                    300: '#a4dcba',
                },
                health: {
                    primary: '#22854a',
                    secondary: '#F59E0B',
                    accent:   '#2ea05a',
                },
                status: {
                    success: '#22854a',
                    error:   '#b91c1c',
                    warning: '#c97c10',
                    info:    '#1d6b3c',
                },
                appointment: {
                    confirmed:  '#22854a',
                    pending:    '#c97c10',
                    cancelled:  '#b91c1c',
                    completed:  '#1d6b3c',
                },
                destructive: {
                    DEFAULT:    'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                muted: {
                    DEFAULT:    'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                popover: {
                    DEFAULT:    'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                card: {
                    DEFAULT:    'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
            },
            fontFamily: {
                display: ['"DM Serif Display"', 'Georgia', 'serif'],
                sans:    ['"DM Sans"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
                hindi:   ['"Noto Sans Devanagari"', 'sans-serif'],
            },
            borderRadius: {
                lg:  '1.25rem',
                md:  '0.875rem',
                sm:  '0.5rem',
                xl:  '1.75rem',
                '2xl': '2.5rem',
                '3xl': '2rem',
            },
            boxShadow: {
                // Ultra-subtle standard shadows (neutral black)
                'sm':      '0 1px 2px rgba(0,0,0,0.02)',
                'DEFAULT': '0 1px 3px rgba(0,0,0,0.03)',
                'md':      '0 4px 8px rgba(0,0,0,0.04)',
                'lg':      '0 8px 20px rgba(0,0,0,0.05)',
                'xl':      '0 12px 30px rgba(0,0,0,0.07)',
                '2xl':     '0 20px 40px rgba(0,0,0,0.10)',

                // Ultra-subtle custom shadows (neutral black)
                'primary':    '0 2px 10px rgba(0,0,0,0.05)',
                'forest-sm':  '0 1px 2px rgba(0,0,0,0.02)',
                'forest-md':  '0 2px 6px rgba(0,0,0,0.04)',
                'forest-lg':  '0 4px 12px rgba(0,0,0,0.06)',
                'forest-xl':  '0 8px 24px rgba(0,0,0,0.08)',
                'green-sm':   '0 1px 2px rgba(0,0,0,0.02)',
                'green-md':   '0 2px 4px rgba(0,0,0,0.03)',
                'green-lg':   '0 4px 8px rgba(0,0,0,0.04)',
                'green-xl':   '0 8px 16px rgba(0,0,0,0.05)',
            },
            keyframes: {
                'accordion-down': {
                    from: { height: '0' },
                    to:   { height: 'var(--radix-accordion-content-height)' },
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to:   { height: '0' },
                },
                'fade-in': {
                    from: { opacity: '0', transform: 'translateY(10px)' },
                    to:   { opacity: '1', transform: 'translateY(0)' },
                },
                'slide-up': {
                    from: { opacity: '0', transform: 'translateY(20px)' },
                    to:   { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up':   'accordion-up 0.2s ease-out',
                'fade-in':        'fade-in 0.4s ease-out forwards',
                'slide-up':       'slide-up 0.5s ease-out forwards',
            },
        },
    },
    plugins: [require('tailwindcss-animate')],
};

export default config;
