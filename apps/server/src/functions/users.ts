import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";

const getServerOnlyUsers = createServerOnlyFn(async () => {
  return [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
    { id: 3, name: "Charlie" },
  ];
});

export const getServerFnUsers = createServerFn({ method: "GET" }).handler(async () => {
  return getServerOnlyUsers();
});
