
import express from "express";
import pg from "pg";

const app = express();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.get("/api/health", async (req,res)=>{
  try {
    await pool.query("SELECT 1");
    res.json({status:"ok"});
  } catch(e) {
    res.status(500).json({error:e.message});
  }
});

app.listen(process.env.PORT || 3000, ()=>{
  console.log("API started");
});
