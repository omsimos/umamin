import { Hono } from "hono";
import { validateRuntimeConfig } from "./config";
import { applyGlobalMiddleware } from "./middleware";
import { authRoutes } from "./routes/auth";
import { messageRoutes } from "./routes/messages";
import { noteRoutes } from "./routes/notes";
import { postRoutes } from "./routes/posts";
import { settingsRoutes } from "./routes/settings";
import { userRoutes } from "./routes/users";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

validateRuntimeConfig();
applyGlobalMiddleware(app);

app.get("/health", (c) => c.json({ ok: true }));
app.get("/healthz", (c) => c.json({ ok: true }));

app.route("/", authRoutes);
app.route("/", postRoutes);
app.route("/", noteRoutes);
app.route("/", messageRoutes);
app.route("/", userRoutes);
app.route("/", settingsRoutes);

export { app };
