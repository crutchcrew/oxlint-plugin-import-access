import value from "./sub/defaults";
import DefaultClass from "./sub/defaultClass";
import { nestedIndex } from "./sub/nested";
import { nestedIndex as viaJs } from "./sub/nested/index.js";
import data from "./sub/data.json";

console.log(value, DefaultClass, nestedIndex, viaJs, data);
