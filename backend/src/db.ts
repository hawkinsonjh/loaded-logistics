import pg from "pg";

const { Pool } = pg;

// Postgres `numeric` (type OID 1700) is returned as a STRING by node-pg to preserve
// arbitrary precision. The board does math on these columns (rpm.toFixed, rate-pay-...),
// and calling .toFixed() on a string throws — which blanks the whole UI. Parse numerics
// as JS floats so rate/rpm/pay/fuel/dispatch/repair arrive as numbers, like the board expects.
pg.types.setTypeParser(1700, (v) => (v == null ? null : parseFloat(v)));

// Neon requires SSL. The DATABASE_URL from Neon already includes ?sslmode=require,
// but we set ssl here too so it works regardless of how the URL is pasted.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

export async function q(text: string, params: any[] = []) {
  const res = await pool.query(text, params);
  return res.rows;
}
