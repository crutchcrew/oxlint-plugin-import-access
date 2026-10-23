import { starPackage, starPublic, starPrivate } from "./sub/barrel";
// @ts-expect-error -- `export *` does not re-export the default export
import implDefault from "./sub/barrel";
// @ts-expect-error -- `missingName` is not exported
import { starPackage as viaCycle, missingName } from "./sub/cycleA";
import { starPackage as shadowed } from "./sub/shadow";
import { packageNamespace, publicNamespace } from "./sub/namespaceReexport";

console.log(starPackage, starPublic, starPrivate, implDefault, viaCycle, missingName, shadowed, packageNamespace, publicNamespace);
