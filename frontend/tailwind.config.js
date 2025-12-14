/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#1e1e1e',      // Background principal - VS Code dark
          surface: '#252526',  // Superfícies e cards
          elevated: '#2d2d30', // Elementos elevados
          border: '#3e3e42',   // Bordas
          hover: '#2a2d2e',    // Hover states
          text: {
            primary: '#cccccc',   // Texto principal
            secondary: '#858585', // Texto secundário
            disabled: '#656565',  // Texto desabilitado
          }
        }
      }
    },
  },
  plugins: [],
}
