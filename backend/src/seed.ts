import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pool, q } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const force = process.argv.includes("--force");

  // 1) apply schema
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
  console.log("✓ schema applied");

  // 2) seed loads (skip if already populated, unless --force)
  const existing = await q("select count(*)::int as n from loads");
  if (existing[0].n > 0 && !force) {
    console.log(`• loads table already has ${existing[0].n} rows — skipping seed (use --force to reseed)`);
    await pool.end();
    return;
  }
  if (force) {
    await q("delete from loads where source = 'manual'");
    console.log("• --force: cleared existing manual loads");
  }

  const seed: any[] = JSON.parse(readFileSync(join(__dirname, "..", "seed-data.json"), "utf8"));
  let n = 0;
  for (const l of seed) {
    await q(
      `insert into loads (date, broker, rate, miles, rpm, driver, unit, pay, fuel, dispatch, repair, dh, status, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'manual')`,
      [
        l.date || null, l.broker || null, l.rate, l.miles, l.rpm,
        l.driver || null, l.unit || null, l.pay, l.fuel,
        l.dispatch ?? null, l.repair ?? null, l.dh ?? null,
        l.status || "Delivered",
      ]
    );
    n++;
  }
  console.log(`✓ seeded ${n} historical loads`);
  await pool.end();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
