const { createClient } = require("@supabase/supabase-js");

// Load environment variables based on NODE_ENV
const nodeEnv = process.env.NODE_ENV || "development";
if (nodeEnv === "test") {
  require("dotenv").config({ path: ".env.test" });
} else {
  // Development i production používají .env
  require("dotenv").config({ path: ".env" });
}

let supabase = null;

const connectDB = async () => {
  try {
    const supabaseUrl =
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
      process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY in .env"
      );
    }

    console.log("🔌 Attempting Supabase connection to:", supabaseUrl);

    supabase = createClient(supabaseUrl, supabaseKey);

    // Test connection
    const { data, error } = await supabase
      .from("games")
      .select("count")
      .limit(1);

    if (error && error.code !== "PGRST116") {
      // PGRST116 = table doesn't exist yet (expected on first run)
      throw error;
    }

    console.log("✅ Supabase připojeno:", supabaseUrl);

    // Note: Migrations need to be run manually in Supabase SQL Editor
    // Run `npm run migrations:show` to see migration SQL statements

    return supabase;
  } catch (error) {
    console.error("❌ Supabase chyba připojení:", error.message);
    console.error("Stack:", error.stack);
    throw error; // Re-throw to stop app
  }
};

const getSupabase = () => {
  if (!supabase) {
    throw new Error("Supabase client not initialized. Call connectDB() first.");
  }
  return supabase;
};

module.exports = { connectDB, getSupabase };
