import pg from "pg";

const { Pool } = pg;

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
