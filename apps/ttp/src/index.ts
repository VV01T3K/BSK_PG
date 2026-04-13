import { Hono } from "hono";
import { cors } from "hono/cors";

const demoProducts = [
  { id: 1, name: "Keyboard" },
  { id: 2, name: "Mouse" },
  { id: 3, name: "Monitor" },
];

export const app = new Hono()
  .use(
    "/api/*",
    cors({
      origin: "http://localhost:3000",
    }),
  )
  .get("/", (c) => {
    return c.text("Hello Hono!");
  })
  .get("/api/products", (c) => {
    return c.json({ products: demoProducts });
  });

export type TtpApp = typeof app;

export default {
  port: 3001,
  fetch: app.fetch,
};
