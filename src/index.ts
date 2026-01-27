import "dotenv/config";
import { app } from "./app";
import { checkDbConnection } from "./config/db";

const PORT = Number(process.env.PORT || 4000);

async function start() {
  try {
    await checkDbConnection();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect to database:", err);
    process.exit(1);
  }
}

start();
