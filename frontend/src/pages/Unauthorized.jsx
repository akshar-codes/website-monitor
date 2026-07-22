import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import Button from "../components/ui/Button";
import { ROUTES } from "../constants/routes";

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 items-center justify-center bg-bg-base px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
          <ShieldAlert size={26} className="text-red-400" />
        </div>
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-white">
          Access denied
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-text-secondary">
          You don&apos;t have permission to view this page. If you believe
          this is a mistake, contact an administrator.
        </p>
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate(ROUTES.DASHBOARD)}
        >
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
