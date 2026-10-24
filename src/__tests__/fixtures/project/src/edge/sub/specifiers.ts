import { starPublic } from "./impl";

export { /** @private */ starPublic as sameLinePrivate, starPublic as afterSameLine };

export {
  starPublic as plain,
  /** @package */ starPublic as leadingSameLine,
};

export const first = 1, /** @package */ second = 2;
