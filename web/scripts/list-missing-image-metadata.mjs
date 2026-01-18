#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Cannot run backfill.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false } });

async function main() {
  const { data, error } = await supabase
    .from("property_images")
    .select("id, property_id, image_url")
    .or("width.is.null,height.is.null")
    .limit(50);
  if (error) {
    console.error("Failed to list images needing metadata", error);
    process.exit(1);
  }
  if (!data || !data.length) {
    console.log("No images found with missing width/height.");
    return;
  }
  console.log(`Found ${data.length} images missing metadata (showing first 50):`);
  data.forEach((row) => {
    console.log(`${row.id} | property ${row.property_id} | ${row.image_url}`);
  });
  console.log("Populate width/height by reuploading or manually updating these rows.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
