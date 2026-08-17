"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 5;

function useFilteredPagination<T>({
  items,
  pageSize = DEFAULT_PAGE_SIZE,
  filterFn,
}: {
  items: T[];
  pageSize?: number;
  filterFn: (item: T, query: string) => boolean;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => filterFn(item, normalized));
  }, [filterFn, items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1);

  useEffect(() => {
    setPage(1);
  }, [query, items.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return {
    query,
    setQuery,
    page,
    setPage,
    totalPages,
    pageItems,
    filteredCount: filtered.length,
    totalCount: items.length,
  };
}

function AdminListSearch({
  query,
  onQueryChange,
  placeholder = "Buscar…",
  resultLabel,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  resultLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <SearchInput
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onClear={() => onQueryChange("")}
        placeholder={placeholder}
        aria-label={placeholder}
        className="sm:max-w-md"
      />
      {resultLabel ? (
        <p className="text-sm text-blue-gray sm:ml-auto">{resultLabel}</p>
      ) : null}
    </div>
  );
}

function AdminListPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-center gap-1 border-t border-white/10 pt-4"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Anterior
      </Button>
      {pages.map((number) => (
        <Button
          key={number}
          type="button"
          size="icon-sm"
          variant={number === page ? "outline" : "ghost"}
          aria-current={number === page ? "page" : undefined}
          className={cn(
            number === page &&
              "border-cyan-electric/40 bg-cyan-electric/10 text-cyan-electric",
          )}
          onClick={() => onPageChange(number)}
        >
          {number}
        </Button>
      ))}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Próxima
      </Button>
    </nav>
  );
}

/** @deprecated Prefer AdminListSearch + AdminListPagination */
function AdminListToolbar({
  query,
  onQueryChange,
  placeholder = "Buscar…",
  page,
  totalPages,
  onPageChange,
  resultLabel,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  resultLabel?: string;
}) {
  return (
    <div className="space-y-3">
      <AdminListSearch
        query={query}
        onQueryChange={onQueryChange}
        placeholder={placeholder}
        resultLabel={resultLabel}
      />
      <AdminListPagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}

export {
  AdminListToolbar,
  AdminListSearch,
  AdminListPagination,
  useFilteredPagination,
  DEFAULT_PAGE_SIZE,
};
