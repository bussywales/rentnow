type ShortletPaginationInput = {
  page: number;
  pageSize: number;
  limitParam: string | null;
  cursorParam: string | null;
  defaultLimit?: number;
  maxLimit?: number;
};

export type ShortletPagination = {
  mode: "cursor" | "page";
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
  cursor: string | null;
};

export type ShortletPaginationResult<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  nextCursor: string | null;
};

function parsePositiveInt(value: string | null | undefined): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : null;
}

export function resolveShortletPagination(input: ShortletPaginationInput): ShortletPagination {
  const defaultLimit = input.defaultLimit ?? input.pageSize;
  const maxLimit = input.maxLimit ?? 80;
  const requestedLimit = parsePositiveInt(input.limitParam) ?? defaultLimit;
  const limit = Math.max(1, Math.min(maxLimit, requestedLimit));
  const cursorOffset = parsePositiveInt(input.cursorParam);

  if (cursorOffset !== null) {
    return {
      mode: "cursor",
      page: Math.max(1, input.page),
      pageSize: Math.max(1, input.pageSize),
      limit,
      offset: Math.max(0, cursorOffset),
      cursor: String(cursorOffset),
    };
  }

  const page = Math.max(1, input.page);
  const pageSize = Math.max(1, input.pageSize);
  const offset = (page - 1) * pageSize;
  return {
    mode: "page",
    page,
    pageSize,
    limit: pageSize,
    offset,
    cursor: null,
  };
}

export function paginateShortletRows<T>(
  rows: T[],
  pagination: ShortletPagination
): ShortletPaginationResult<T> {
  const total = rows.length;
  const offset = Math.max(0, pagination.offset);
  const limit = Math.max(1, pagination.limit);
  const items = rows.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return {
    items,
    total,
    offset,
    limit,
    nextCursor: nextOffset < total ? String(nextOffset) : null,
  };
}
