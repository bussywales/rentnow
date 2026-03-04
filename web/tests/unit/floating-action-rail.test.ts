import test from "node:test";
import assert from "node:assert/strict";
import {
  FLOATING_ACTION_RAIL_BASE_BOTTOM_OFFSET_PX,
  FLOATING_ACTION_RAIL_OVERLAP_GAP_PX,
  resolveFloatingActionRailBottomOffsetPx,
  resolveFloatingActionRailOverlapLift,
  resolveFloatingActionRailVisibility,
} from "@/components/ui/FloatingActionRail";

function makeRect(input: { left: number; top: number; width: number; height: number }): DOMRect {
  const right = input.left + input.width;
  const bottom = input.top + input.height;
  return {
    x: input.left,
    y: input.top,
    left: input.left,
    top: input.top,
    width: input.width,
    height: input.height,
    right,
    bottom,
    toJSON: () => ({}),
  } as DOMRect;
}

void test("floating action rail visibility hides when form focus is active", () => {
  assert.equal(
    resolveFloatingActionRailVisibility({
      hidden: false,
      hideWhenFormFocused: true,
      isFormFocused: false,
    }),
    true
  );
  assert.equal(
    resolveFloatingActionRailVisibility({
      hidden: false,
      hideWhenFormFocused: true,
      isFormFocused: true,
    }),
    false
  );
  assert.equal(
    resolveFloatingActionRailVisibility({
      hidden: true,
      hideWhenFormFocused: false,
      isFormFocused: false,
    }),
    false
  );
});

void test("floating action rail overlap lift pushes rail above avoid rect", () => {
  const railRect = makeRect({ left: 320, top: 680, width: 44, height: 44 });
  const avoidRect = makeRect({ left: 300, top: 660, width: 80, height: 60 });

  const liftPx = resolveFloatingActionRailOverlapLift({
    railRect,
    avoidRect,
    gapPx: FLOATING_ACTION_RAIL_OVERLAP_GAP_PX,
  });
  assert.equal(liftPx > 0, true);

  const farAvoidRect = makeRect({ left: 20, top: 100, width: 120, height: 80 });
  assert.equal(
    resolveFloatingActionRailOverlapLift({
      railRect,
      avoidRect: farAvoidRect,
      gapPx: FLOATING_ACTION_RAIL_OVERLAP_GAP_PX,
    }),
    0
  );
});

void test("floating action rail bottom offset preserves dock safe-zone baseline", () => {
  assert.equal(
    resolveFloatingActionRailBottomOffsetPx({
      baseBottomOffsetPx: FLOATING_ACTION_RAIL_BASE_BOTTOM_OFFSET_PX,
      overlapLiftPx: 0,
    }),
    FLOATING_ACTION_RAIL_BASE_BOTTOM_OFFSET_PX
  );
  assert.equal(
    resolveFloatingActionRailBottomOffsetPx({
      baseBottomOffsetPx: FLOATING_ACTION_RAIL_BASE_BOTTOM_OFFSET_PX,
      overlapLiftPx: 24.7,
    }),
    FLOATING_ACTION_RAIL_BASE_BOTTOM_OFFSET_PX + 25
  );
});
