import type { ExtractorManifest } from "@shared/types/extractors";
import { runJobStreetPh } from "./src/run";

export const manifest: ExtractorManifest = {
  id: "jobstreet_ph",
  displayName: "JobStreet Philippines",
  providesSources: ["jobstreet_ph"],
  capabilities: { locationEvidence: true },
  locationCapabilities: {
    jobstreet_ph: { supportedCountryKeys: ["philippines"] },
  },
  async run(context) {
    if (context.shouldCancel?.()) return { success: true, jobs: [] };
    const result = await runJobStreetPh({
      searchTerms: context.searchTerms,
      locations: context.sourceLocationPlan?.requestedCities,
      maxPages: 5,
      shouldCancel: context.shouldCancel,
      onProgress: context.onProgress,
    });
    return result.success
      ? { success: true, jobs: result.jobs, sourceErrors: result.sourceErrors }
      : { success: false, jobs: [], error: result.error };
  },
};

export default manifest;