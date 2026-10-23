declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "virtual:*" {
  /**
   * @package
   */
  export const virtualValue: string;
}

declare module "virtual:config" {
  export const configValue: string;
}
