import { z } from "zod";
import net from "net";
import { PROBE_REGIONS } from "../config/regions.js";

const regionIds = PROBE_REGIONS.map(({ id }) => id);
export const updateProbeRegionSettingsSchema = z
  .object({
    regions: z
      .array(
        z
          .object({
            regionId: z.enum(regionIds),
            egressIps: z
              .array(
                z
                  .string()
                  .refine((val) => net.isIP(val) !== 0, {
                    message: "Invalid IP address",
                  }),
              )
              .max(20),
          })
          .strict(),
      )
      .length(regionIds.length),
  })
  .strict()
  .superRefine(({ regions }, ctx) => {
    if (
      new Set(regions.map(({ regionId }) => regionId)).size !== regionIds.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Include each region exactly once.",
        path: ["regions"],
      });
    }
  });
