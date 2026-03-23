import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ButtonLink } from "@/components/ui/ButtonLink";

void test("ButtonLink renders a styled anchor without nesting a button", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      ButtonLink,
      {
        href: "/properties",
        size: "sm",
        variant: "secondary",
      },
      "Browse homes"
    )
  );

  assert.match(html, /^<a\b/);
  assert.match(html, /Browse homes/);
  assert.doesNotMatch(html, /<button\b/);
});
