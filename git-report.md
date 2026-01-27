# Git Snapshot (main)

## Commands
- `git fetch origin --tags`
- `git log --oneline -20`
- `git show --stat a1cb29f32a74db9858bf726a28e3a2731a470701`
- `git show a1cb29f32a74db9858bf726a28e3a2731a470701 -- app/admin/review/page.tsx`

## git log --oneline -20
```
a1cb29f Harden admin review detail casting
9f4b679 Fix admin review queue select
e75ad47 Fix admin review queue data contract
5e3aef0 Fix admin review queue data contract
07f6557 Use merged queue rows for admin review
1976706 Ensure admin pending queue stays visible
db14b39 Fix admin review desk data source
40333dc fix(admin): review queue service fetch
0e548b5 fix(admin): enum-safe review queue status sets (R16.9b.18)
cb3ad01 fix(admin): union queue + raw REST diagnostics (R16.9b.17)
bf87c15 chore(admin): raw body diagnostics for review queue (R16.9b.16)
7337da0 fix(admin): tighten review OR clause + expose service errors (R16.9b.15)
dfa26c0 fix(admin): admin service schema pin + diagnostics ping (R16.9b.14)
48adc17 fix(admin): normalize supabase url for service queue
c2040ca fix(admin): review queue visibility via service role (R16.9b.12)
088e326 fix(admin): review queue predicate + diagnostics explain (R16.9b.11)
180d261 fix(admin): review queue visibility (R16.9b.10)
607db96 chore(admin): relax pending status typing
3bfc524 fix(admin): diagnostics + pending alignment (R16.9b.9)
325ead5 fix(admin): pending queue robustness (R16.9b.8)
```

## git show --stat a1cb29f32a74db9858bf726a28e3a2731a470701
```
commit a1cb29f32a74db9858bf726a28e3a2731a470701
Author: Busayo Adewale <bussywales@hotmail.com>
Date:   Mon Jan 26 11:26:08 2026 +0000

    Harden admin review detail casting

 web/app/admin/review/page.tsx | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)
```

## git show a1cb29f32a74db9858bf726a28e3a2731a470701 -- app/admin/review/page.tsx
```
commit a1cb29f32a74db9858bf726a28e3a2731a470701
Author: Busayo Adewale <bussywales@hotmail.com>
Date:   Mon Jan 26 11:26:08 2026 +0000

    Harden admin review detail casting

diff --git a/web/app/admin/review/page.tsx b/web/app/admin/review/page.tsx
index cdaa990..0404224 100644
--- a/web/app/admin/review/page.tsx
+++ b/web/app/admin/review/page.tsx
@@ -167,7 +167,8 @@ async function loadReviewListings(
       if (detailError) {
         console.warn("[admin/review] detail fetch error", detailStatus, detailError);
       }
-      detailMap = Object.fromEntries(((details ?? []) as RawProperty[]).map((row) => [row.id, row]));
+      const detailRows = Array.isArray(details) ? (details as unknown as RawProperty[]) : [];
+      detailMap = Object.fromEntries(detailRows.map((row) => [row.id, row]));
       console.log("[admin/review] detail rows", { count: details?.length ?? 0, status: detailStatus });
     }
```

## git show --stat 9f4b679073161dd84577290fdced74b1ac1d4696
```
commit 9f4b679073161dd84577290fdced74b1ac1d4696
Author: Busayo Adewale <bussywales@hotmail.com>
Date:   Mon Jan 26 11:20:31 2026 +0000

    Fix admin review queue select

 web/app/admin/review/page.tsx | 233 ++++++++++++++++++++++++++++++------------
 1 file changed, 165 insertions(+), 68 deletions(-)
```

## git show 9f4b679073161dd84577290fdced74b1ac1d4696 -- app/admin/review/page.tsx
```
commit 9f4b679073161dd84577290fdced74b1ac1d4696
Author: Busayo Adewale <bussywales@hotmail.com>
Date:   Mon Jan 26 11:20:31 2026 +0000

    Fix admin review queue select

diff --git a/web/app/admin/review/page.tsx b/web/app/admin/review/page.tsx
index b6f15ce..cdaa990 100644
--- a/web/app/admin/review/page.tsx
+++ b/web/app/admin/review/page.tsx
@@ -28,7 +28,7 @@ type Props = {
 
 type RawProperty = {
   id: string;
-  title: string | null;
+  title?: string | null;
   city?: string | null;
   state_region?: string | null;
   country_code?: string | null;
@@ -41,11 +41,6 @@ type RawProperty = {
   approved_at?: string | null;
   rejected_at?: string | null;
   is_active?: boolean | null;
-  cover_image_url?: string | null;
-  photo_count?: number | null;
-  has_cover?: boolean | null;
-  property_images?: Array<{ image_url: string; width?: number | null; height?: number | null }>;
-  property_videos?: Array<{ id: string }>;
   rejection_reason?: string | null;
   admin_area_1?: string | null;
   admin_area_2?: string | null;
@@ -88,34 +83,71 @@ async function loadReviewListings(
   }
   try {
     const serviceClient = viewerRole === "admin" && hasServiceRoleEnv() ? createServiceRoleClient() : null;
+    const queueSelect = [
+      "id",
+      "status",
+      "updated_at",
+      "submitted_at",
+      "is_approved",
+      "approved_at",
+      "rejected_at",
+      "is_active",
+    ].join(",");
+    const detailSelect = [
+      "id",
+      "title",
+      "owner_id",
+      "city",
+      "state_region",
+      "country_code",
+      "admin_area_1",
+      "admin_area_2",
+      "postal_code",
+      "latitude",
+      "longitude",
+      "location_label",
+      "location_place_id",
+      "created_at",
+      "updated_at",
+      "rejection_reason",
+    ].join(",");
     const queueResult = await getAdminReviewQueue({
       userClient: supabase,
       serviceClient,
       viewerRole,
-      select: [
-        "id",
-        "title",
-        "city",
-        "state_region",
-        "country_code",
-        "updated_at",
-        "created_at",
-        "owner_id",
-        "status",
-        "cover_image_url",
-        "photo_count",
-        "has_cover",
-        "submitted_at",
-        "is_approved",
-        "approved_at",
-        "rejected_at",
-        "is_active",
-        "property_images(id,image_url)",
-        "property_videos(id)",
-        "rejection_reason",
-      ].join(","),
+      select: queueSelect,
       view: "pending",
     });
+    const dataIsArray = Array.isArray(queueResult.data);
+    const rowsIsArray = Array.isArray(queueResult.rows);
+    const dataCount = dataIsArray ? queueResult.data.length : null;
+    const rowsCount = rowsIsArray ? queueResult.rows.length : null;
+    console.log("[admin/review] queue meta", {
+      meta: queueResult.meta
+        ? {
+            source: queueResult.meta.source,
+            serviceAttempted: queueResult.meta.serviceAttempted,
+            serviceOk: queueResult.meta.serviceOk,
+            serviceStatus: queueResult.meta.serviceStatus,
+            serviceError: queueResult.meta.serviceError,
+            serviceErrorDetails: (queueResult.meta as { serviceErrorDetails?: string })?.serviceErrorDetails,
+            serviceErrorHint: (queueResult.meta as { serviceErrorHint?: string })?.serviceErrorHint,
+            serviceErrorCode: (queueResult.meta as { serviceErrorCode?: string })?.serviceErrorCode,
+          }
+        : null,
+      serviceRoleError: queueResult.serviceRoleError,
+      serviceRoleStatus: queueResult.serviceRoleStatus,
+    });
+    console.log("[admin/review] queue rows source", {
+      dataIsArray,
+      rowsIsArray,
+      dataCount,
+      rowsCount,
+      preferred: rowsIsArray ? "rows" : dataIsArray ? "data" : "none",
+    });
+    if (queueResult.serviceRoleError) {
+      console.warn("[admin/review] service role error", queueResult.serviceRoleError);
+    }
     console.log("[admin/review] status set", {
       statuses: getStatusesForView("pending"),
       or: buildStatusOrFilter("pending"),
@@ -123,8 +155,79 @@ async function loadReviewListings(
 
     const listings = (queueResult.data ?? []) as RawProperty[];
     console.log("[admin/review] rows", listings.length);
+    const listingIds = Array.from(new Set(listings.map((p) => p.id).filter(Boolean)));
+
+    let detailMap: Record<string, RawProperty> = {};
+    if (listingIds.length) {
+      const detailClient = serviceClient ?? supabase;
+      const { data: details, error: detailError, status: detailStatus } = await detailClient
+        .from("properties")
+        .select(detailSelect)
+        .in("id", listingIds);
+      if (detailError) {
+        console.warn("[admin/review] detail fetch error", detailStatus, detailError);
+      }
+      detailMap = Object.fromEntries(((details ?? []) as RawProperty[]).map((row) => [row.id, row]));
+      console.log("[admin/review] detail rows", { count: details?.length ?? 0, status: detailStatus });
+    }
+
+    let imageMap: Record<string, PropertyImage[]> = {};
+    if (listingIds.length) {
+      const mediaClient = serviceClient ?? supabase;
+      const { data: images, error: imageError, status: imageStatus } = await mediaClient
+        .from("property_images")
+        .select("id,image_url,width,height,property_id,created_at")
+        .in("property_id", listingIds);
+      if (imageError) {
+        console.warn("[admin/review] property_images fetch error", imageStatus, imageError);
+      }
+      imageMap = (images ?? []).reduce((acc, img, idx) => {
+        const propertyId = (img as { property_id?: string | null }).property_id;
+        if (!propertyId) return acc;
+        const list = acc[propertyId] || [];
+        list.push({
+          id: (img as { id?: string }).id || `img-${propertyId}-${list.length}-${idx}`,
+          image_url: (img as { image_url?: string }).image_url || "",
+          width: (img as { width?: number | null }).width ?? undefined,
+          height: (img as { height?: number | null }).height ?? undefined,
+          position: list.length,
+          created_at: (img as { created_at?: string | null }).created_at || undefined,
+        });
+        acc[propertyId] = list;
+        return acc;
+      }, {} as Record<string, PropertyImage[]>);
+      console.log("[admin/review] media rows", { images: images?.length ?? 0, status: imageStatus });
+    }
+
+    let videoCount: Record<string, number> = {};
+    if (listingIds.length) {
+      const mediaClient = serviceClient ?? supabase;
+      const { data: videos, error: videoError, status: videoStatus } = await mediaClient
+        .from("property_videos")
+        .select("id,property_id")
+        .in("property_id", listingIds);
+      if (videoError) {
+        console.warn("[admin/review] property_videos fetch error", videoStatus, videoError);
+      }
+      videoCount = (videos ?? []).reduce((acc, video) => {
+        const propertyId = (video as { property_id?: string | null }).property_id;
+        if (!propertyId) return acc;
+        acc[propertyId] = (acc[propertyId] || 0) + 1;
+        return acc;
+      }, {} as Record<string, number>);
+      console.log("[admin/review] video rows", { videos: videos?.length ?? 0, status: videoStatus });
+    }
 
-    const ownerIds = Array.from(new Set(listings.map((p) => p.owner_id).filter(Boolean))) as string[];
+    const ownerIds = Array.from(
+      new Set(
+        listings
+          .map((p) => {
+            const detail = detailMap[p.id];
+            return detail?.owner_id || p.owner_id;
+          })
+          .filter(Boolean)
+      )
+    ) as string[];
     let owners: Record<string, string> = {};
     if (ownerIds.length) {
       const { data: profiles } = await supabase
@@ -138,57 +241,51 @@ async function loadReviewListings(
     }
 
     const mappedListings = listings.map((p) => {
-      const images: PropertyImage[] = (p.property_images || []).map((img, idx) => ({
-        id: (img as { id?: string }).id || `img-${idx}`,
-        image_url: img.image_url,
-        width: img.width ?? undefined,
-        height: img.height ?? undefined,
-        position: idx,
-        property_id: p.id,
-        created_at: p.created_at || undefined,
-      }));
+      const detail = detailMap[p.id] || {};
+      const merged = { ...detail, ...p, id: p.id } as RawProperty;
+      const images = imageMap[p.id] || [];
       const readinessInput = {
-        ...(p as RawProperty),
+        ...merged,
         images,
       } as Parameters<typeof computeListingReadiness>[0];
       const readiness = computeListingReadiness(readinessInput);
       const locationQuality = computeLocationQuality({
-        latitude: p.latitude ?? null,
-        longitude: p.longitude ?? null,
-        location_label: p.location_label ?? null,
-        location_place_id: p.location_place_id ?? null,
-        country_code: p.country_code ?? null,
-        admin_area_1: p.admin_area_1 ?? p.state_region ?? null,
-        admin_area_2: p.admin_area_2 ?? null,
-        postal_code: p.postal_code ?? null,
-        city: p.city ?? null,
+        latitude: merged.latitude ?? null,
+        longitude: merged.longitude ?? null,
+        location_label: merged.location_label ?? null,
+        location_place_id: merged.location_place_id ?? null,
+        country_code: merged.country_code ?? null,
+        admin_area_1: merged.admin_area_1 ?? merged.state_region ?? null,
+        admin_area_2: merged.admin_area_2 ?? null,
+        postal_code: merged.postal_code ?? null,
+        city: merged.city ?? null,
       });
 
       return {
         id: p.id,
-        title: p.title || "Untitled",
-        hostName: owners[p.owner_id || ""] || "Host",
-        updatedAt: p.updated_at || p.created_at || null,
-        status: normalizeStatus(p.status) ?? "pending",
-        submitted_at: p.submitted_at ?? null,
-        is_approved: p.is_approved ?? null,
-        approved_at: p.approved_at ?? null,
-        rejected_at: p.rejected_at ?? null,
-        is_active: p.is_active ?? null,
-        rejectionReason: p.rejection_reason ?? null,
-        city: p.city ?? null,
-        state_region: p.state_region ?? null,
-        country_code: p.country_code ?? null,
+        title: merged.title || "Untitled",
+        hostName: owners[merged.owner_id || ""] || "Host",
+        updatedAt: merged.updated_at || merged.created_at || null,
+        status: normalizeStatus(merged.status) ?? "pending",
+        submitted_at: merged.submitted_at ?? null,
+        is_approved: merged.is_approved ?? null,
+        approved_at: merged.approved_at ?? null,
+        rejected_at: merged.rejected_at ?? null,
+        is_active: merged.is_active ?? null,
+        rejectionReason: merged.rejection_reason ?? null,
+        city: merged.city ?? null,
+        state_region: merged.state_region ?? null,
+        country_code: merged.country_code ?? null,
         readiness,
         locationQuality: locationQuality.quality,
-        photoCount: typeof p.photo_count === "number" ? p.photo_count : (p.property_images || []).length,
-        hasVideo: Array.isArray(p.property_videos) && p.property_videos.length > 0,
+        photoCount: images.length,
+        hasVideo: (videoCount[p.id] || 0) > 0,
         reviewable: isReviewableRow({
-          status: p.status ?? null,
-          submitted_at: p.submitted_at ?? null,
-          is_approved: p.is_approved ?? null,
-          approved_at: p.approved_at ?? null,
-          rejected_at: p.rejected_at ?? null,
+          status: merged.status ?? null,
+          submitted_at: merged.submitted_at ?? null,
+          is_approved: merged.is_approved ?? null,
+          approved_at: merged.approved_at ?? null,
+          rejected_at: merged.rejected_at ?? null,
         }),
       };
     });
```
