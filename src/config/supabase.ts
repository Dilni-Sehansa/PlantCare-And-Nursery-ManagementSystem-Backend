
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Supabase environment variables are missing");
}

export const supabase = createClient(
    supabaseUrl,
    supabaseSecretKey
);

export const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "product-image";
