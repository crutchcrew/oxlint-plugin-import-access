import DecoratedDefault, { DecoratedBefore, DecoratedLines, DecoratedAfter } from "./review/decorated";
import { hyphenPrivate, hyphenPackage, accessHyphen } from "./review/tags";
import { behindStar as viaCompact } from "./review/compactStar";
import { behindStar as viaComment } from "./review/commentStar";
import type { behindStar as viaType } from "./review/typeStar";
import { exportFoo, plain } from "./review/exportPrefix";
import { arrow, fn, paren, klass, overridden, y1, y2, x1, x2 } from "./review/initializers";
import templateText from "./review/templateText";
import { x as fromDirectory } from "./review/lib/foo/";
import { x as fromFile } from "./review/lib/foo";
import styles from "./review/styles.module.css";
import legacy from "legacy-lib";

type T = typeof viaType;
console.log(DecoratedDefault, DecoratedBefore, DecoratedLines, DecoratedAfter, hyphenPrivate, hyphenPackage, accessHyphen, viaCompact, viaComment, exportFoo, plain, arrow, fn, paren, klass, overridden, y1, y2, x1, x2, templateText, fromDirectory, fromFile, styles, legacy);
let t: T | undefined;
console.log(t);
