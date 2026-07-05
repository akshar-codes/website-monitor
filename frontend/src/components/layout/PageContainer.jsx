import { memo } from "react";

function PageContainer({ children }) {
  return (
    <div
      id="page-container"
      className="w-full mx-auto"
      style={{ maxWidth: "var(--container-max)" }}
    >
      {children}
    </div>
  );
}

export default memo(PageContainer);
