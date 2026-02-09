type Primitive = string | number | boolean | null;

export type UntypedQueryResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

export type UntypedQuerySingleResult<T> = {
  data: T | null;
  error: { message?: string } | null;
};

export type UntypedQuery<T = Record<string, unknown>> = {
  select: (columns: string) => UntypedQuery<T>;
  update: (values: Record<string, unknown>) => UntypedQuery<T>;
  delete: () => UntypedQuery<T>;
  upsert: (values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) => UntypedQuery<T>;
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => UntypedQuery<T>;
  eq: (column: string, value: Primitive) => UntypedQuery<T>;
  in: (column: string, values: Primitive[]) => UntypedQuery<T>;
  gte: (column: string, value: Primitive) => UntypedQuery<T>;
  lte: (column: string, value: Primitive) => UntypedQuery<T>;
  lt: (column: string, value: Primitive) => UntypedQuery<T>;
  not: (column: string, operator: string, value: Primitive) => UntypedQuery<T>;
  ilike: (column: string, pattern: string) => UntypedQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery<T>;
  range: (from: number, to: number) => UntypedQuery<T>;
  maybeSingle: () => Promise<UntypedQuerySingleResult<T>>;
  then: PromiseLike<UntypedQueryResult<T>>["then"];
};

export type UntypedAdminClient = {
  from: <T = Record<string, unknown>>(table: string) => UntypedQuery<T>;
};
