import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "#FDE047", // Yellow
        accent: "#8B5CF6",  // Purple
        neo: "#000000",
      },
      boxShadow: {
        'neo': '4px 4px 0px 0px rgba(0,0,0,1)',
        'neo-hover': '8px 8px 0px 0px rgba(0,0,0,1)',
      },
      borderWidth: {
        '3': '3px',
      }
    },
  },
  plugins: [],
};
export default config;
