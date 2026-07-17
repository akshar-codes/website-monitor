import MongoStore from "connect-mongo";
import env from "./env.js";

const sessionConfig = {
  name: env.SESSION_NAME,
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: env.MONGO_URI,
    collectionName: "sessions",
    ttl: env.SESSION_MAX_AGE_MS / 1000,
    autoRemove: "native",
  }),
  cookie: {
    httpOnly: true,
    secure: env.isProd, // requires HTTPS — only enforce once actually served over it
    sameSite: env.isProd ? "strict" : "lax",
    maxAge: env.SESSION_MAX_AGE_MS,
    path: "/",
  },
};

export default sessionConfig;
