import { Link } from "react-router-dom";
import { Activity, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

export function Page({ title, description, actions, children, eyebrow }) {
  return (
    <main className="app-page">
      <header className="page-heading">
        <div>
          {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      {children}
    </main>
  );
}

export function Button({ children, variant = "primary", ...props }) {
  return (
    <button className={`sw-button ${variant}`} {...props}>
      {children}
    </button>
  );
}

export function Input({ label, error, className = "", ...props }) {
  return (
    <label className={`sw-field ${className}`}>
      {label && <span>{label}</span>}
      <input className={error ? "invalid" : ""} {...props} />
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export function Select({ label, children, ...props }) {
  return (
    <label className="sw-field">
      {label && <span>{label}</span>}
      <select {...props}>{children}</select>
    </label>
  );
}

export function Panel({ title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`sw-panel ${className}`}>
      {(title || actions) && (
        <div className="sw-panel-heading">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  note,
  icon: Icon = Activity,
  tone = "green",
}) {
  return (
    <article className="sw-metric">
      <span className={`sw-metric-icon ${tone}`}>
        <Icon size={17} />
      </span>
      <span className="sw-metric-label">{label}</span>
      <strong>{value ?? "—"}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

export function Status({ value }) {
  const status = String(value || "unknown").toLowerCase();
  return (
    <span className={`sw-status ${status}`}>
      <i />
      {value || "Unknown"}
    </span>
  );
}

export function Empty({ title = "Nothing here yet", children, action }) {
  return (
    <div className="sw-empty">
      <span>
        <CheckCircle2 size={20} />
      </span>
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Table({
  columns,
  rows,
  empty = "No records found",
  onRowClick,
}) {
  return (
    <div className="sw-table-wrap">
      <table className="sw-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, i) => (
              <tr
                key={row.id || row._id || i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render
                      ? col.render(row[col.key], row)
                      : (row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>
                <Empty>{empty}</Empty>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Notice({ children, tone = "info" }) {
  return <div className={`sw-notice ${tone}`}>{children}</div>;
}

export function AuthShell({
  title,
  description,
  children,
  footer,
  backTo = "/login",
  compact = false,
}) {
  return (
    <main className={`auth-page ${compact ? "compact" : ""}`}>
      <div className="auth-aside">
        <Link className="auth-brand" to="/">
          <Activity size={25} />
          <span>SiteWatch</span>
        </Link>
        <div className="auth-pitch">
          <span className="auth-kicker">WEBSITE MONITORING</span>
          <h1>
            Your websites.
            <br />
            Always in sight.
          </h1>
          <p>Clear, timely signals for every service you depend on.</p>
          <div className="auth-proof">
            <i />
            <span>Monitoring systems are operational</span>
          </div>
        </div>
        <small className="auth-aside-foot">
          Reliable checks. Clear answers.
        </small>
      </div>
      <section className="auth-content">
        <div className="auth-card">
          <Link className="auth-back" to={backTo}>
            <ArrowLeft size={14} /> Back
          </Link>
          <h2>{title}</h2>
          {description && <p className="auth-description">{description}</p>}
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
        <small className="auth-legal">
          © {new Date().getFullYear()} SiteWatch · Secure website monitoring
        </small>
      </section>
    </main>
  );
}

export function FormActions({ children, backTo }) {
  return (
    <div className="form-actions">
      {children}
      {backTo && (
        <Link to={backTo} className="text-link">
          Back <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}
