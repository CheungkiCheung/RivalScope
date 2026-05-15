import { describe, expect, it, vi } from "vitest";
import { IntelligenceRepository } from "./repositories";

describe("IntelligenceRepository", () => {
  it("rejects facts without source chunk ids before calling Prisma", async () => {
    const db = {
      fact: {
        create: vi.fn()
      }
    };
    const repository = new IntelligenceRepository(db as never);

    await expect(
      repository.createFact({
        projectId: "project_1",
        competitorId: "competitor_cursor",
        dimension: "pricing",
        statement: "Cursor has an untraced pricing claim.",
        confidence: 0.72,
        chunkIds: []
      })
    ).rejects.toThrow("Cannot create fact without source chunk ids.");
    expect(db.fact.create).not.toHaveBeenCalled();
  });
});
