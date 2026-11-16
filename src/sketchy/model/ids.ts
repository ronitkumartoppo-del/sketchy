import type { IdFactory } from "./types";

export const createId: IdFactory = (prefix) => `${prefix}_${crypto.randomUUID()}`;
