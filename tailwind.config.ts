import { frostedThemePlugin } from "@whop/react/tailwind";

export default {
  plugins: [
    frostedThemePlugin(),
    require('@tailwindcss/typography')
  ]
};
