import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getContrastColor, getDarkVariant } from "./colorContrast.js";
describe("getContrastColor", () => {
    it("白背景（#ffffff）に対して暗い文字色を返す", () => {
        assert.equal(getContrastColor("#ffffff"), "#1a1a2e");
    });
    it("黒背景（#000000）に対して白文字色を返す", () => {
        assert.equal(getContrastColor("#000000"), "#ffffff");
    });
    it("明るい黄色（#ffff00）に対して暗い文字色を返す", () => {
        assert.equal(getContrastColor("#ffff00"), "#1a1a2e");
    });
    it("濃い紺（#1a1a2e）に対して白文字色を返す", () => {
        assert.equal(getContrastColor("#1a1a2e"), "#ffffff");
    });
    it("無効なHEX値に対してデフォルトの暗い文字色を返す", () => {
        assert.equal(getContrastColor("invalid"), "#1a1a2e");
    });
});
describe("getDarkVariant", () => {
    it("赤（#ff0000）を75%に暗くする", () => {
        assert.equal(getDarkVariant("#ff0000"), "#bf0000");
    });
    it("白（#ffffff）を暗くして#bfbfbfを返す", () => {
        assert.equal(getDarkVariant("#ffffff"), "#bfbfbf");
    });
    it("無効なHEX値をそのまま返す", () => {
        assert.equal(getDarkVariant("invalid"), "invalid");
    });
});
