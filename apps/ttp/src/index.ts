import { Hono } from "hono";
import { cors } from "hono/cors";

const demoUsers = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Charlie" },
];

const app = new Hono()
  .use(
    "/api/*",
    cors({
      origin: "http://localhost:3000",
    }),
  )
  .get("/", (c) => {
    return c.text("Hello Hono!");
  })
  .get("/api/users", (c) => {
    return c.json({ users: demoUsers });
  });

export { app };
export type TtpApp = typeof app;

export default {
  port: 3001,
  fetch: app.fetch,
};
