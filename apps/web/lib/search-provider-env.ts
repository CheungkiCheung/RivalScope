import {
  createSearchProviderFromEnv,
  type FixtureSearchIndex,
  type SearchProvider
} from "@rivalscope/tools";

export function createConfiguredSearchProvider(input: {
  env: Record<string, string | undefined>;
  fixtureIndex: FixtureSearchIndex;
}): SearchProvider {
  const searchProviderEnv = {
    ...(input.env.RIVALSCOPE_SEARCH_PROVIDER
      ? { RIVALSCOPE_SEARCH_PROVIDER: input.env.RIVALSCOPE_SEARCH_PROVIDER }
      : {}),
    ...(input.env.TAVILY_API_KEY ? { TAVILY_API_KEY: input.env.TAVILY_API_KEY } : {})
  };

  return createSearchProviderFromEnv(searchProviderEnv, input.fixtureIndex);
}
