/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Shared colors (accessible via bg-blue-600, text-blue-600, etc. if we used standard palette)
        // Here we map our semantic vars
        
        // Accents
        accent: {
          DEFAULT: 'var(--accent-primary)',
          hover: 'var(--accent-secondary)',
          light: 'var(--accent-light)',
          primary: 'var(--accent-primary)', // for compatibility if needed
        },
        
        // Status Colors (available as bg-success, text-success, border-success etc)
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-down)',
        up: 'var(--color-up)',
        down: 'var(--color-down)',
      },
      // Specific overrides to match existing class naming convention (text-primary != bg-primary)
      backgroundColor: {
        primary: 'var(--bg-primary)',
        secondary: 'var(--bg-secondary)',
        tertiary: 'var(--bg-tertiary)',
        card: 'var(--bg-card)',
        'card-hover': 'var(--bg-card-hover)',
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
      },
      borderColor: {
        DEFAULT: 'var(--border-color)',
        light: 'var(--border-light)',
      },
      spacing: {
        xs: 'var(--spacing-xs)',
        sm: 'var(--spacing-sm)',
        md: 'var(--spacing-md)',
        lg: 'var(--spacing-lg)',
        xl: 'var(--spacing-xl)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      }
    },
  },
  plugins: [],
}
