import type { CreateJobInput } from "@shared/types/jobs";

const API_URL = "https://ph.jobstreet.com/api/jobsearch/v5/search";
const USER_AGENT = "Mozilla/5.0 (compatible; JobOps/1.0)";

export interface JobStreetSearchOptions {
  searchTerms?: string[];
  locations?: string[];
  maxPages?: number;
  fetcher?: typeof fetch;
  shouldCancel?: () => boolean;
  onProgress?: (event: { phase: "list"; currentUrl?: string; detail?: string }) => void;
}

export interface JobStreetResult {
  success: boolean;
  jobs: CreateJobInput[];
  error?: string;
  sourceErrors?: string[];
}

export function buildSearchUrl(keyword: string, location: string | undefined, page: number): string {
  const url = new URL(API_URL);
  url.searchParams.set("siteKey", "ph");
  url.searchParams.set("page", String(page));
  url.searchParams.set("keywords", keyword);
  if (location) url.searchParams.set("where", location);
  url.searchParams.set("sortmode", "ListedDate");
  return url.toString();
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function locationOf(item: Record<string, unknown>): string | undefined {
  const locations = Array.isArray(item.locations) ? item.locations : [];
  const labels = locations.flatMap((v) => v && typeof v === "object" ? [text((v as Record<string, unknown>).label)] : []).filter(Boolean);
  return labels.join(", ") || undefined;
}

export function parseJobStreetListing(item: unknown): CreateJobInput | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;
  const id = text(raw.id);
  const title = text(raw.title);
  if (!id || !title) return null;
  const employer = text(raw.companyName) ?? (raw.employer && typeof raw.employer === "object" ? text((raw.employer as Record<string, unknown>).name) : undefined) ?? "Unknown employer";
  const arrangement = raw.workArrangements && typeof raw.workArrangements === "object" ? text((raw.workArrangements as Record<string, unknown>).displayText) : undefined;
  const workTypes = Array.isArray(raw.workTypes) ? raw.workTypes.map(text).filter(Boolean).join(", ") : undefined;
  const classifications = Array.isArray(raw.classifications) ? raw.classifications.map((v) => v && typeof v === "object" ? text(((v as Record<string, unknown>).classification as Record<string, unknown> | undefined)?.description) : undefined).filter(Boolean).join(", ") : undefined;
  return {
    source: "jobstreet_ph",
    sourceJobId: id,
    title,
    employer,
    jobUrl: `https://ph.jobstreet.com/job/${id}`,
    applicationLink: `https://ph.jobstreet.com/job/${id}`,
    location: locationOf(raw),
    salary: text(raw.salaryLabel),
    datePosted: text(raw.listingDate),
    jobDescription: text(raw.teaser) ?? (Array.isArray(raw.bulletPoints) ? raw.bulletPoints.map(text).filter(Boolean).join("\n") : undefined),
    disciplines: classifications,
    jobType: workTypes,
    workFromHomeType: arrangement,
    isRemote: arrangement?.toLowerCase() === "remote",
    companyUrlDirect: raw.employer && typeof raw.employer === "object" ? text((raw.employer as Record<string, unknown>).companyUrl) : undefined,
  };
}

export async function runJobStreetPh(options: JobStreetSearchOptions = {}): Promise<JobStreetResult> {
  const fetcher = options.fetcher ?? fetch;
  const terms = (options.searchTerms ?? []).map((v) => v.trim()).filter(Boolean);
  const locations = options.locations?.length ? options.locations : [undefined];
  const jobs: CreateJobInput[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];
  try {
    for (const term of terms) for (const location of locations) for (let page = 1; page <= Math.min(options.maxPages ?? 5, 5); page++) {
      if (options.shouldCancel?.()) return { success: true, jobs, sourceErrors: errors };
      const url = buildSearchUrl(term, location, page);
      options.onProgress?.({ phase: "list", currentUrl: url, detail: `JobStreet PH: ${term}, page ${page}` });
      const response = await fetcher(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { data?: unknown };
      if (!Array.isArray(payload.data) || payload.data.length === 0) break;
      for (const item of payload.data) {
        try { const job = parseJobStreetListing(item); if (job && !seen.has(job.jobUrl)) { seen.add(job.jobUrl); jobs.push(job); } } catch (error) { errors.push(`malformed listing: ${String(error)}`); }
      }
      if (payload.data.length < 20) break;
    }
    return { success: true, jobs, sourceErrors: errors };
  } catch (error) { return { success: false, jobs, error: `JobStreet PH request failed: ${String(error)}`, sourceErrors: errors }; }
}