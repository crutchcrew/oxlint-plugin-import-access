declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export = classes;
}

declare module "legacy-lib" {
  /** @package */
  const legacy: { run(): void };
  /** @package */
  export = legacy;
}
