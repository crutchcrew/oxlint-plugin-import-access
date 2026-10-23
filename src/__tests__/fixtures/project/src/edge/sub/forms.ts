/**
 * @package
 */
export function overloaded(a: string): string;
export function overloaded(a: number): number;
export function overloaded(a: unknown): unknown {
  return a;
}

export function overloadedLater(a: string): string;
/**
 * @package
 */
export function overloadedLater(a: number): number;
export function overloadedLater(a: unknown): unknown {
  return a;
}

/**
 * @package
 */
export enum PackageEnum {
  A,
}

/**
 * @package
 */
export const enum PackageConstEnum {
  A,
}

/**
 * @package
 */
export namespace PackageNamespace {
  export const inner = 1;
}

/**
 * @package
 */
export abstract class PackageAbstractClass {}

/**
 * @package
 */
export async function packageAsync(): Promise<void> {}

/**
 * @package
 */
export declare const packageDeclared: number;

/** @package */ export const sameLineDoc = 1;

export const previous = 1; /** @package */ export const trailingDoc = 2;

/* @package */
export const notJsDoc = 1;

/**
 * Some text mentioning @package mid-line is not a tag.
 */
export const midLineTag = 1;

/**
 * @access private
 */
/**
 * @package
 */
export const twoBlocks = 1;

/**
 * @public
 */
export const explicitPublic = 1;

/**
 * @access package with extra words
 */
export const accessWithText = 1;

// @package
export const lineComment = 1;

const local = 1;
/**
 * @package
 */
export { local as localPackage };

/**
 * @package
 */
const taggedLocal = 1;
export { taggedLocal };

/** @package */
export type { PackageType } from "./types";

export {
  /**
   * @package
   */
  starPublic as specifierDoc,
} from "./impl";
