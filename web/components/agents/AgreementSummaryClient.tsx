"use client";

import { Button } from "@/components/ui/Button";

export default function AgreementSummaryClient() {
  return (
    <Button size="sm" onClick={() => window.print()} data-testid="agreement-print">
      Print
    </Button>
  );
}
