declare function dec(...args: unknown[]): any;

/** @package */ @dec export class DecoratedBefore {}

/**
 * @package
 */
@dec
@dec()
export class DecoratedLines {}

/** @package */ export @dec class DecoratedAfter {}

/** @private */
@dec
export default class {}
