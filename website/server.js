import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Serves the static marketing site in ./public. Railway sets PORT at runtime.
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(join(__dirname, "public")));

app.listen(PORT, () => console.log("Loaded Logistics website on :" + PORT));
