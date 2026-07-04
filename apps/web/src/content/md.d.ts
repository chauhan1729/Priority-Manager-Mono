// Raw markdown imports — bundled as strings via the webpack `asset/source` rule
// configured in next.config.ts. Used to render the in-app karmic readings.
declare module "*.md" {
  const content: string;
  export default content;
}
