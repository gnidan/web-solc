import { vi } from "vitest";
import "@testing-library/react/dont-cleanup-after-each";

// Mock web-solc
vi.mock("web-solc", () => ({
  fetchSolc: vi.fn(),
  fetchAndLoadSolc: vi.fn(),
}));
