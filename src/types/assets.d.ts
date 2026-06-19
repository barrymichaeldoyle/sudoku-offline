// Static image imports (e.g. `import icon from "@/assets/images/icon.png"`).
// Metro resolves these to an asset reference; this declares the type for TS.
declare module "*.png" {
  const asset: number;
  export default asset;
}
