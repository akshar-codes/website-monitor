import { z } from "zod";

export const updateSslSettingsSchema = z.object({
  sslMonitoringEnabled: z.boolean({
    required_error: "sslMonitoringEnabled is required",
    invalid_type_error: "sslMonitoringEnabled must be a boolean",
  }),
});
