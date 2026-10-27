import * as lib from "./sub/lib";
import * as path from "node:path";

lib.publicMethod();
lib.packageMethod();
lib?.privateMethod();
lib["privateMethod"]();
const key = "publicMethod";
console.log(lib.default, lib[key], path.sep);
const value: lib.PrivateType = "";
console.log(value, lib);

function shadowed(lib: { privateMethod(): void }) {
  lib.privateMethod();
}
shadowed({ privateMethod() {} });
