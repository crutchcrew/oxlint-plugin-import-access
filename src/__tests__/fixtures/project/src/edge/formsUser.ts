import {
  overloaded,
  overloadedLater,
  PackageEnum,
  PackageConstEnum,
  PackageNamespace,
  PackageAbstractClass,
  packageAsync,
  packageDeclared,
  sameLineDoc,
  trailingDoc,
  notJsDoc,
  midLineTag,
  twoBlocks,
  explicitPublic,
  accessWithText,
  lineComment,
  localPackage,
  taggedLocal,
  type PackageType,
  specifierDoc,
} from "./sub/forms";

console.log(overloaded, overloadedLater, PackageEnum, PackageConstEnum.A, PackageNamespace, PackageAbstractClass, packageAsync, packageDeclared, sameLineDoc, trailingDoc, notJsDoc, midLineTag, twoBlocks, explicitPublic, accessWithText, lineComment, localPackage, taggedLocal, specifierDoc);
let t: PackageType | undefined;
console.log(t);
