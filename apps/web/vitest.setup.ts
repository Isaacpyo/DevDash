import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Component tests opt into jsdom per file; unmount between tests there.
if (typeof window !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);
}
