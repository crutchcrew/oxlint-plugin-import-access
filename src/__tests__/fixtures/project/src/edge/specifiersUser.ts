import { sameLinePrivate, afterSameLine, plain, leadingSameLine, first, second } from "./sub/specifiers";
import cjsDefault from "./sub/cjs";
import logo from "./assets/logo.svg";
import { virtualValue } from "virtual:anything";
// @ts-expect-error -- `virtualValue` comes from "virtual:*", not "virtual:config"
import { configValue, virtualValue as notInConfig } from "virtual:config";

console.log(sameLinePrivate, afterSameLine, plain, leadingSameLine, first, second, cjsDefault, logo, virtualValue, configValue, notInConfig);
