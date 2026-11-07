import ProbeRegionSettings from "../models/ProbeRegionSettings.js";
import { PROBE_REGIONS } from "../config/regions.js";

export const getProbeRegionSettings = async () => {
  const stored = await ProbeRegionSettings.find({}).lean();
  const byRegion = new Map(stored.map((item) => [item.regionId, item]));
  return PROBE_REGIONS.map((region) => ({
    regionId: region.id,
    name: region.name,
    location: region.location,
    egressIps: byRegion.get(region.id)?.egressIps || [],
  }));
};

export const saveProbeRegionSettings = async (regions, actor) => {
  await Promise.all(
    regions.map(({ regionId, egressIps }) =>
      ProbeRegionSettings.findOneAndUpdate(
        { regionId },
        { $set: { egressIps, updatedBy: actor.id || actor._id } },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true },
      ),
    ),
  );
  return getProbeRegionSettings();
};
