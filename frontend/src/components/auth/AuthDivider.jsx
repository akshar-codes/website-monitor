export default function AuthDivider({ label = "Or continue with" }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-border-subtle" />
      <span className="text-[11px] font-medium uppercase tracking-wider text-text-disabled">
        {label}
      </span>
      <div className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}
