import { memo, useCallback } from "react";
import MuiPagination from "@mui/material/Pagination";
import { formatNumber } from "../../utils/formatters";

function Pagination({ page, totalPages, onPageChange, total }) {
  const handleChange = useCallback(
    (_event, value) => {
      onPageChange(value);
    },
    [onPageChange],
  );

  if (!totalPages || totalPages <= 1) return null;

  return (
    <div
      id="pagination-controls"
      className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4"
    >
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Showing page{" "}
        <span
          className="font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {page}
        </span>{" "}
        of{" "}
        <span
          className="font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {totalPages}
        </span>
        {total != null && (
          <>
            {" "}
            —{" "}
            <span
              className="font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {formatNumber(total)}
            </span>{" "}
            total items
          </>
        )}
      </p>

      <MuiPagination
        count={totalPages}
        page={page}
        onChange={handleChange}
        shape="rounded"
        size="medium"
        siblingCount={1}
        boundaryCount={1}
        sx={{
          "& .MuiPaginationItem-root": {
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            borderColor: "var(--border)",
            borderRadius: "var(--radius-md)",
            transition: "all var(--transition-fast)",
            "&:hover": {
              backgroundColor: "var(--primary-light)",
              color: "var(--primary)",
              borderColor: "var(--primary)",
            },
            "&.Mui-selected": {
              backgroundColor: "var(--primary)",
              color: "#fff",
              borderColor: "var(--primary)",
              "&:hover": {
                backgroundColor: "var(--primary-hover)",
              },
            },
            "&.Mui-disabled": {
              opacity: 0.4,
            },
          },
        }}
      />
    </div>
  );
}

export default memo(Pagination);
