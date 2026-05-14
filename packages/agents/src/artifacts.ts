export type ArtifactKind =
  | "analysis_requirements"
  | "sources"
  | "source_chunks"
  | "facts"
  | "claims"
  | "report"
  | "review_findings"
  | "repair_result"
  | "final_eval";

export interface Artifact<T = unknown> {
  id: string;
  kind: ArtifactKind;
  value: T;
  createdAt: string;
}

export interface ArtifactStore {
  put<T>(input: Omit<Artifact<T>, "id" | "createdAt">): Artifact<T>;
  get<T = unknown>(id: string): Artifact<T> | undefined;
  list(): Artifact[];
}

export class InMemoryArtifactStore implements ArtifactStore {
  private artifacts = new Map<string, Artifact>();

  put<T>(input: Omit<Artifact<T>, "id" | "createdAt">): Artifact<T> {
    const artifact: Artifact<T> = {
      ...input,
      id: createId("artifact"),
      createdAt: new Date().toISOString()
    };

    this.artifacts.set(artifact.id, artifact);
    return artifact;
  }

  get<T = unknown>(id: string): Artifact<T> | undefined {
    const artifact = this.artifacts.get(id);
    return artifact as Artifact<T> | undefined;
  }

  list(): Artifact[] {
    return Array.from(this.artifacts.values()).map((artifact) => ({
      ...artifact
    }));
  }
}

export function getLatestArtifactValue<T>(
  artifacts: Artifact[],
  kind: ArtifactKind
): T {
  let artifact: Artifact | undefined;

  for (let index = artifacts.length - 1; index >= 0; index -= 1) {
    if (artifacts[index]?.kind === kind) {
      artifact = artifacts[index];
      break;
    }
  }

  if (!artifact) {
    throw new Error(`Missing required artifact ${kind}`);
  }

  return artifact.value as T;
}

export function getOptionalLatestArtifactValue<T>(
  artifacts: Artifact[],
  kind: ArtifactKind
): T | undefined {
  for (let index = artifacts.length - 1; index >= 0; index -= 1) {
    if (artifacts[index]?.kind === kind) {
      return artifacts[index]?.value as T;
    }
  }

  return undefined;
}

function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}
