import type { SupabaseClient } from "@supabase/supabase-js";

type DataQualitySample = {
  id: string;
  title: string | null;
  created_at: string | null;
};

export type DataQualitySnapshot = {
  counts: {
    total: number;
    missingCountryCode: number;
    countryCodeMissingCountry: number;
    depositMissingCurrency: number;
    currencyMissingDeposit: number;
    sizeMissingUnit: number;
    unitMissingSize: number;
    listingTypeMissing: number;
    yearBuiltOutOfRange: number;
    bathroomTypeMissing: number;
    missingPhotos: number | null;
  };
  samples: {
    missingCountryCode: Array<{
      id: string;
      title: string | null;
      country: string | null;
      city: string | null;
      created_at: string | null;
    }>;
    missingDepositCurrency: Array<{
      id: string;
      title: string | null;
      deposit_amount: number | null;
      currency: string | null;
      created_at: string | null;
    }>;
    missingPhotos: DataQualitySample[] | null;
  };
};

type CountResult = { count: number | null; error: { message: string } | null };

const toCount = (result: CountResult) => result.count ?? 0;

export async function buildDataQualitySnapshot(adminClient: SupabaseClient) {
  const currentYear = new Date().getFullYear();
  const errors: string[] = [];

  const collectError = (label: string, result: CountResult) => {
    if (result.error) errors.push(`${label}: ${result.error.message}`);
  };

  const [
    totalProps,
    missingCountryCode,
    countryCodeMissingCountry,
    depositMissingCurrency,
    currencyMissingDeposit,
    sizeMissingUnit,
    unitMissingSize,
    listingTypeMissing,
    yearBuiltOutOfRange,
    bathroomTypeMissing,
    withPhotos,
  ] = await Promise.all([
    adminClient.from("properties").select("id", { count: "exact", head: true }),
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .is("country_code", null)
      .not("country", "is", null),
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .is("country", null)
      .not("country_code", "is", null),
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .is("deposit_currency", null)
      .not("deposit_amount", "is", null),
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .is("deposit_amount", null)
      .not("deposit_currency", "is", null),
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .is("size_unit", null)
      .not("size_value", "is", null),
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .is("size_value", null)
      .not("size_unit", "is", null),
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .is("listing_type", null),
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .not("year_built", "is", null)
      .or(`year_built.lt.1800,year_built.gt.${currentYear + 1}`),
    adminClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .is("bathroom_type", null)
      .gt("bathrooms", 0),
    // Derived from property_images table (existing schema source).
    adminClient
      .from("properties")
      .select("id, property_images!inner(id)", { count: "exact", head: true }),
  ]);

  collectError("total", totalProps);
  collectError("missingCountryCode", missingCountryCode);
  collectError("countryCodeMissingCountry", countryCodeMissingCountry);
  collectError("depositMissingCurrency", depositMissingCurrency);
  collectError("currencyMissingDeposit", currencyMissingDeposit);
  collectError("sizeMissingUnit", sizeMissingUnit);
  collectError("unitMissingSize", unitMissingSize);
  collectError("listingTypeMissing", listingTypeMissing);
  collectError("yearBuiltOutOfRange", yearBuiltOutOfRange);
  collectError("bathroomTypeMissing", bathroomTypeMissing);
  collectError("withPhotos", withPhotos);

  const missingPhotos =
    typeof totalProps.count === "number" && typeof withPhotos.count === "number"
      ? Math.max(totalProps.count - withPhotos.count, 0)
      : null;

  const [missingCountrySample, missingDepositSample, photosSample] = await Promise.all([
    adminClient
      .from("properties")
      .select("id, title, country, city, created_at")
      .is("country_code", null)
      .not("country", "is", null)
      .order("created_at", { ascending: false })
      .limit(10),
    adminClient
      .from("properties")
      .select("id, title, deposit_amount, currency, created_at")
      .is("deposit_currency", null)
      .not("deposit_amount", "is", null)
      .order("created_at", { ascending: false })
      .limit(10),
    missingPhotos === null
      ? Promise.resolve({ data: null, error: null })
      : adminClient
          .from("properties")
          .select("id, title, created_at, property_images(id)")
          .order("created_at", { ascending: false })
          .limit(50),
  ]);

  if (missingCountrySample.error) {
    errors.push(`missingCountrySample: ${missingCountrySample.error.message}`);
  }
  if (missingDepositSample.error) {
    errors.push(`missingDepositSample: ${missingDepositSample.error.message}`);
  }
  if (photosSample.error) {
    errors.push(`missingPhotosSample: ${photosSample.error.message}`);
  }

  const missingPhotosSample =
    missingPhotos === null || !photosSample.data
      ? null
      : photosSample.data
          .filter((row) => !row.property_images || row.property_images.length === 0)
          .slice(0, 10)
          .map((row) => ({
            id: row.id,
            title: row.title ?? null,
            created_at: row.created_at ?? null,
          }));

  return {
    snapshot: {
      counts: {
        total: toCount(totalProps),
        missingCountryCode: toCount(missingCountryCode),
        countryCodeMissingCountry: toCount(countryCodeMissingCountry),
        depositMissingCurrency: toCount(depositMissingCurrency),
        currencyMissingDeposit: toCount(currencyMissingDeposit),
        sizeMissingUnit: toCount(sizeMissingUnit),
        unitMissingSize: toCount(unitMissingSize),
        listingTypeMissing: toCount(listingTypeMissing),
        yearBuiltOutOfRange: toCount(yearBuiltOutOfRange),
        bathroomTypeMissing: toCount(bathroomTypeMissing),
        missingPhotos,
      },
      samples: {
        missingCountryCode: missingCountrySample.data ?? [],
        missingDepositCurrency: missingDepositSample.data ?? [],
        missingPhotos: missingPhotosSample,
      },
    } satisfies DataQualitySnapshot,
    error: errors.length ? errors.join(" | ") : null,
  };
}
