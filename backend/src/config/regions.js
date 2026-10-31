const definitions = [
  {
    id: "india-mumbai",
    name: "India",
    location: "Mumbai",
    country: "IN",
    deploymentId: "probe-india-mumbai",
  },
  {
    id: "us-east",
    name: "United States",
    location: "US East",
    country: "US",
    deploymentId: "probe-us-east",
  },
  {
    id: "eu-west",
    name: "Europe",
    location: "Western Europe",
    country: "NL",
    deploymentId: "probe-eu-west",
  },
  {
    id: "singapore",
    name: "Singapore",
    location: "Singapore",
    country: "SG",
    deploymentId: "probe-singapore",
  },
];

export const PROBE_REGIONS = Object.freeze(
  definitions.map((region) => Object.freeze({ ...region })),
);
export const getRegion = (id) =>
  PROBE_REGIONS.find((region) => region.id === id) || null;
