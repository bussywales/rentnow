"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_VERIFICATION_REQUIREMENTS,
  normalizeVerificationRequirements,
  type VerificationRequirements,
} from "@/lib/trust-markers";

let cachedRequirements: VerificationRequirements | null = null;
let inflightRequirementsRequest: Promise<VerificationRequirements> | null = null;

async function fetchVerificationRequirementsFromApi(): Promise<VerificationRequirements> {
  const response = await fetch("/api/settings/verification-requirements", {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) return DEFAULT_VERIFICATION_REQUIREMENTS;
  const payload = (await response.json().catch(() => ({}))) as {
    requirements?: Partial<VerificationRequirements> | null;
  };
  return normalizeVerificationRequirements(payload?.requirements ?? null);
}

export function useVerificationRequirements(): VerificationRequirements {
  const [requirements, setRequirements] = useState<VerificationRequirements>(
    cachedRequirements ?? DEFAULT_VERIFICATION_REQUIREMENTS
  );

  useEffect(() => {
    let active = true;
    if (cachedRequirements) {
      return () => {
        active = false;
      };
    }
    if (!inflightRequirementsRequest) {
      inflightRequirementsRequest = fetchVerificationRequirementsFromApi()
        .then((resolved) => {
          cachedRequirements = resolved;
          return resolved;
        })
        .catch(() => DEFAULT_VERIFICATION_REQUIREMENTS)
        .finally(() => {
          inflightRequirementsRequest = null;
        });
    }

    void inflightRequirementsRequest.then((resolved) => {
      if (!active) return;
      setRequirements(resolved);
    });

    return () => {
      active = false;
    };
  }, []);

  return requirements;
}
