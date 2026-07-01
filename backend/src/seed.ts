import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pool, q } from "./db.js";
import { hashPassword } from "./auth.js";
import { DEFAULT_ORG_ID } from "./plans.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure Joe's original org exists with a fixed id, then adopt any orphaned
// (pre-multi-tenant) rows into it. Idempotent — safe to run repeatedly.
async function ensureDefaultOrg() {
  await q(
    `insert into orgs (id, name, slug, plan, plan_status, truck_limit)
     values ($1, 'Loaded Logistics', 'loaded-logistics', 'fleet', 'active', -1)
     on conflict (id) do nothing`,
    [DEFAULT_ORG_ID],
  );

  // Owner account for Joe. Password comes from OWNER_PASSWORD, else BOARD_PASSWORD,
  // else the shared default. Joe can also keep using the legacy shared-password login.
  const ownerEmail = (process.env.OWNER_EMAIL || "hawkinsonjh@gmail.com").toLowerCase();
  const ownerPw = process.env.OWNER_PASSWORD || process.env.BOARD_PASSWORD || "loaded";
  const existingUser = await q("select id from users where lower(email)=$1", [ownerEmail]);
  if (!existingUser.length) {
    await q(
      `insert into users (org_id, email, name, password_hash, role)
       values ($1,$2,'Joseph Hawkinson',$3,'owner')`,
      [DEFAULT_ORG_ID, ownerEmail, hashPassword(ownerPw)],
    );
    console.log(`✓ created owner account ${ownerEmail}`);
  }

  // Backfill: any tenant row without an org_id belonged to Joe (pre-multi-tenant data).
  for (const t of ["loads", "messages", "emails", "candidates", "digests"]) {
    await q(`update ${t} set org_id=$1 where org_id is null`, [DEFAULT_ORG_ID]);
  }
  console.log("✓ default org ensured + orphaned rows adopted");
}

async function main() {
  const force = process.argv.includes("--force");

  // 1) apply schema
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
  console.log("✓ schema applied");

  // 2) default org + owner + backfill
  await ensureDefaultOrg();

  // 3) seed loads (skip if already populated, unless --force)
  const existing = await q("select count(*)::int as n from loads");
  if (existing[0].n > 0 && !force) {
    console.log(`• loads table already has ${existing[0].n} rows — skipping seed (use --force to reseed)`);
    await pool.end();
    return;
  }
  if (force) {
    await q("delete from loads where source = 'manual' and org_id = $1", [DEFAULT_ORG_ID]);
    console.log("• --force: cleared existing manual loads for default org");
  }

  const seed: any[] = JSON.parse(readFileSync(join(__dirname, "..", "seed-data.json"), "utf8"));
  let n = 0;
  for (const l of seed) {
    await q(
      `insert into loads (org_id, date, broker, rate, miles, rpm, driver, unit, pay, fuel, dispatch, repair, dh, status, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'manual')`,
      [
        DEFAULT_ORG_ID,
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
