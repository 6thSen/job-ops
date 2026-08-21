import { describe, expect, it } from "vitest";
import { buildSearchUrl, parseJobStreetListing, runJobStreetPh } from "../src/run";

describe("JobStreet Philippines extractor", () => {
  it("maps the live listing shape", () => {
    const job = parseJobStreetListing({ id: "94112914", title: "Operations", companyName: "AdminEdge", teaser: "Remote role", salaryLabel: "₱75,000", locations: [{ label: "Metro Manila" }], workTypes: ["Full time"], workArrangements: { displayText: "Remote" }, classifications: [{ classification: { description: "Administration" } }] });
    expect(job).toMatchObject({ source: "jobstreet_ph", jobUrl: "https://ph.jobstreet.com/job/94112914", employer: "AdminEdge", location: "Metro Manila", isRemote: true });
  });
  it("builds encoded API URLs and stops on a short page", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => { calls.push(url); return new Response(JSON.stringify({ data: [{ id: "1", title: "A", companyName: "C" }] }), { status: 200 }); };
    const result = await runJobStreetPh({ searchTerms: ["communications"], locations: ["Metro Manila"], fetcher: fetcher as typeof fetch });
    expect(result.jobs).toHaveLength(1);
    expect(calls[0]).toContain("siteKey=ph");
    expect(buildSearchUrl("communications", "Metro Manila", 1)).toContain("sortmode=ListedDate");
  });
  it("populates locationEvidence with the country so the location filter keeps jobs", () => {
    const job = parseJobStreetListing({ id: "94112914", title: "Ops", companyName: "Jollibee", locations: [{ label: "Pasig City, Metro Manila", countryCode: "PH" }] });
    expect(job?.location).toBe("Pasig City, Metro Manila");
    expect(job?.locationEvidence).toMatchObject({
      location: "Pasig City, Metro Manila",
      country: "Philippines",
      countryKey: "philippines",
      source: "jobstreet_ph",
    });
  });
});