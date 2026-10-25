const MAX_FIELD_LENGTH = 200;

const readString = (value) =>
  typeof value === "string" ? value.slice(0, MAX_FIELD_LENGTH) : null;

/** Keep only the fields used by the health response contract. */
export const createHealthResponseSnapshot = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  return {
    status: readString(body.status),
    services: {
      frontend: readString(body.services?.frontend),
      backend: readString(body.services?.backend),
      database: readString(body.services?.database),
    },
  };
};
