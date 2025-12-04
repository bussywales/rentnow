export function setToastQuery(params: URLSearchParams, message: string, type: "success" | "info" | "warning" = "info") {
  if (type === "success") {
    params.set("success", message);
  } else {
    params.set("notice", message);
  }
  return params;
}
