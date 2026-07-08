// Static image imports (e.g. `import icon from "@/assets/images/icon.png"`).
// Metro resolves these to an asset reference; this declares the type for TS.
declare module "*.png" {
  const asset: number;
  export default asset;
}

// Side-effect CSS imports (e.g. `import "@/global.css"`). Expo also declares
// this via the generated, git-ignored `expo-env.d.ts`, but CI runs typecheck
// without regenerating that file, so declare it in a committed file too.
declare module "*.css";
