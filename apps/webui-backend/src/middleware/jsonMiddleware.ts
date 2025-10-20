import { json, Express } from "express";

export const setupJsonMiddleware = (app: Express): void => {
    app.use(json());
};
