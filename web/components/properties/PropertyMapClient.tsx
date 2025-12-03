"use client";

import dynamic from "next/dynamic";
import type { Property } from "@/lib/types";

const PropertyMap = dynamic(() => import("./PropertyMap"), { ssr: false });

type Props = {
  properties: Property[];
  height?: string;
};

export function PropertyMapClient({ properties, height }: Props) {
  return <PropertyMap properties={properties} height={height} />;
}
