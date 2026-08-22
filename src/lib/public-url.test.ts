import { describe, expect, it } from "vitest";
import { assertPublicUrl, isPrivateAddress } from "./public-url";

describe("public article URL security", () => {
  it("blocks local and private network targets", async () => {
    await expect(assertPublicUrl("https://localhost/article")).rejects.toThrow(/Private network/);
    await expect(assertPublicUrl("https://127.0.0.1/article")).rejects.toThrow(/Private network/);
    await expect(assertPublicUrl("http://example.com/article")).rejects.toThrow(/HTTPS/);
    expect(isPrivateAddress("10.1.2.3")).toBe(true);
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });
});
