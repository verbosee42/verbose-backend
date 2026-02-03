import "dotenv/config";
import { app } from "./app";
import { checkDbConnection, pool } from "./config/db";

const PORT = Number(process.env.PORT || 4000);

async function start() {
  try {
    await checkDbConnection();

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

    const shutdown = async () => {
      console.log("Gracefully shutting down...");
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    console.error("Failed to connect to database:", err);
    process.exit(1);
  }
}

start();
