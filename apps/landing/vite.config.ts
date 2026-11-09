import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { staticAssetsAdapter } from "@vinext/cloudflare/cache/static-assets-adapter";

export default defineConfig({
  // Build inputs are explicitly supplied; never load application dotenv files.
  envDir: false,
  resolve: { tsconfigPaths: false },
  plugins: [
    vinext({
      cache: { cdn: staticAssetsAdapter() },
      prerender: { routes: "*" },
    }),
    {
      name: "landing-runtime-react-resolution",
      enforce: "post",
      config(config) {
        // TypeScript pins React 19 declarations; runtime must retain package exports
        // and RSC conditions rather than resolve imports to declaration files.
        const aliases = config.resolve?.alias;
        if (Array.isArray(aliases)) config.resolve!.alias = aliases.filter((alias) =>
          !alias.replacement.includes("/node_modules/@types/react"));
      },
    },
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
