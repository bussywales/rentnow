export const HOST_FIX_REQUEST_COPY = {
  panel: {
    title: "Fix requested",
    subtitle: "An admin reviewed your listing and asked for a few updates before it can go live.",
    dismiss: "Dismiss for now",
    lastReviewed: "Last reviewed",
    adminMessageTitle: "Admin message",
    resubmitButton: "Resubmit for approval",
    resubmitHelper: "Send your updates back to the review desk.",
    confirmTitle: "Resubmit for approval?",
    confirmBody: "This will send the listing back to the review desk for review.",
    confirmSubmit: "Resubmit",
    confirmCancel: "Cancel",
    successToast: "Sent for review.",
    invalidState: "Nothing to resubmit. This listing isn’t currently in “Changes requested”.",
  },
  actions: {
    photos: "Go to photos",
    location: "Fix location",
    video: "Review video",
    details: "Review details",
  },
  reasons: {
    needs_location: "Improve location details (add area/region/postcode).",
    adjust_pin: "Adjust the pinned area to match your listing.",
    needs_photos: "Add more photos to your gallery.",
    needs_cover: "Set a cover photo.",
    weak_cover: "Replace the cover with a clearer landscape image.",
    video_issue: "Review or replace the video.",
    improve_copy: "Improve the title or description.",
    pricing_issue: "Review your pricing details.",
    fallback: "Review listing details.",
  },
};

export type HostFixReasonCode = keyof typeof HOST_FIX_REQUEST_COPY.reasons;
