"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const clampToNonNegative = (value: string) => {
  if (value.trim() === "") return value;
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return num < 0 ? "0" : value;
};

export function QuickSearchForm() {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const fields = ["minPrice", "maxPrice", "bedrooms"];
    fields.forEach((field) => {
      const element = form.elements.namedItem(field);
      if (element instanceof HTMLInputElement) {
        element.value = clampToNonNegative(element.value);
      }
    });
  };

  return (
    <form className="space-y-3" action="/properties" method="get" onSubmit={handleSubmit}>
      <Input name="city" placeholder="City or neighbourhood" />
      <div className="grid grid-cols-2 gap-3">
        <Input name="minPrice" type="number" min={0} step={1} placeholder="Min price" />
        <Input name="maxPrice" type="number" min={0} step={1} placeholder="Max price" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select name="rentalType" defaultValue="">
          <option value="">Any rental type</option>
          <option value="short_let">Short-let</option>
          <option value="long_term">Long-term</option>
        </Select>
        <Input name="bedrooms" type="number" min={0} step={1} placeholder="Bedrooms" />
      </div>
      <Button type="submit" className="w-full">
        Search rentals
      </Button>
    </form>
  );
}
