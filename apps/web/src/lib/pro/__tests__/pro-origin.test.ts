import { describe, expect, it } from "vitest";

import {
  classifyProOriginHost,
  configuredProOriginHost,
} from "../pro-origin";

describe("PRO origin classification", () => {
  it("uses the same host boundary as the server, excluding protocol", () => {
    expect(
      classifyProOriginHost("http://example.test:3002", [
        "https://example.test:3002",
      ]),
    ).toMatchObject({ status: "allowed", currentHost: "example.test:3002" });
  });

  it("retains the port in the acceptance key", () => {
    expect(
      classifyProOriginHost("https://example.test:3000", [
        "https://example.test:3002",
      ]),
    ).toMatchObject({
      status: "mismatch",
      currentHost: "example.test:3000",
      allowedHosts: ["example.test:3002"],
    });
  });

  it("accepts either configured public host and deduplicates them", () => {
    expect(
      classifyProOriginHost("https://random.ngrok-free.app", [
        "https://random.ngrok-free.app",
        "random.ngrok-free.app",
      ]),
    ).toEqual({
      status: "allowed",
      currentHost: "random.ngrok-free.app",
      allowedHosts: ["random.ngrok-free.app"],
    });
  });

  it("reports unconfigured without inventing a mismatch", () => {
    expect(classifyProOriginHost("http://localhost:3002", [undefined, ""])).toEqual({
      status: "unconfigured",
      currentHost: "localhost:3002",
      allowedHosts: [],
    });
  });

  it("rejects a malformed request source using the server verdict", () => {
    expect(classifyProOriginHost("not-a-url", ["chesscito.com"])).toEqual({
      status: "invalid-source",
      currentHost: null,
      allowedHosts: ["chesscito.com"],
    });
  });

  it("preserves the existing configured-host transformation without trimming", () => {
    expect(configuredProOriginHost(" https://chesscito.com:443 ")).toBe(
      " https://chesscito.com:443 ",
    );
  });
});
