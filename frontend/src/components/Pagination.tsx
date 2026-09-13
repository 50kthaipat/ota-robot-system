"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <div className="px-5 py-3 bg-surface-1 border-t border-hairline flex flex-col sm:flex-row items-center justify-between gap-3 text-xs select-none">
      {/* Items Summary */}
      <div className="text-ink-muted font-sans flex items-center gap-1.5">
        <span>Showing</span>
        <span className="font-mono font-medium text-ink">
          {startItem}–{endItem}
        </span>
        <span>of</span>
        <span className="font-mono font-medium text-ink">{totalItems}</span>
        <span>items</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Page Size Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="pagination-page-size" className="text-ink-subtle text-xs">Rows per page:</label>
          <select
            id="pagination-page-size"
            name="pagination-page-size"
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              onPageSizeChange(newSize);
              onPageChange(1);
            }}
            className="min-h-11 px-2 py-2 text-base sm:text-xs font-mono rounded bg-surface-2 border border-hairline text-ink-muted focus:outline-none focus:border-primary-focus transition-colors"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center gap-1.5 font-mono">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={!canPrev}
            title="First Page"
            aria-label="Go to first page"
            className="flex min-h-11 min-w-11 items-center justify-center rounded bg-surface-2 hover:bg-surface-3 border border-hairline text-ink-muted hover:text-ink disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canPrev}
            title="Previous Page"
            aria-label="Go to previous page"
            className="flex min-h-11 min-w-11 items-center justify-center rounded bg-surface-2 hover:bg-surface-3 border border-hairline text-ink-muted hover:text-ink disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="px-2.5 py-1 text-xs text-ink-muted font-medium bg-surface-2/60 rounded border border-hairline">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canNext}
            title="Next Page"
            aria-label="Go to next page"
            className="flex min-h-11 min-w-11 items-center justify-center rounded bg-surface-2 hover:bg-surface-3 border border-hairline text-ink-muted hover:text-ink disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={!canNext}
            title="Last Page"
            aria-label="Go to last page"
            className="flex min-h-11 min-w-11 items-center justify-center rounded bg-surface-2 hover:bg-surface-3 border border-hairline text-ink-muted hover:text-ink disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
