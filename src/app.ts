import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/v1", (_req, res) => {
  res.json({
    name: "verbose-api",
    version: "v1",
  });
});

app.get("/", (_req, res) => {
  res.status(200).json({ message: "Verbose backend running" });
});
