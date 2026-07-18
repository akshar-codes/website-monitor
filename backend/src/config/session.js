import MongoStore from "connect-mongo";
import env from "./env.js";

export const SESSION_COLLECTION_NAME = "sessions";

const sessionConfig = {
  name: env.SESSION_NAME,
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,

  rolling: true,
  store: MongoStore.create({
    mongoUrl: env.MONGO_URI,
    collectionName: SESSION_COLLECTION_NAME,

    ttl: env.SESSION_REMEMBER_ME_MAX_AGE_MS / 1000,
    autoRemove: "native",
  }),
  cookie: {
    httpOnly: true,
    secure: env.isProd, // requires HTTPS — only enforce once actually served over it
    sameSite: env.isProd ? "strict" : "lax",

    maxAge: env.SESSION_DEFAULT_MAX_AGE_MS,
    path: "/",
  },
};

export default sessionConfig;
