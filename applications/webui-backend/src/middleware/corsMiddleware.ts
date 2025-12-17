import cors from "cors";
import { Express } from "express";

export const setupCorsMiddleware = (app: Express): void => {
    app.use(cors());
};
