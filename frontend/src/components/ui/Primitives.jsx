import { Link } from "react-router-dom";
import { Activity, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { translateNode, useTranslation } from "../../i18n";

export function Page({ title, description, actions, children, eyebrow }) {
  const t = useTranslation();
  return (
    <main className="app-page">
      <header className="page-heading">
        <div>
          {eyebrow && <span className="page-eyebrow">{t(eyebrow)}</span>}
          <h1>{t(title)}</h1>
          {description && <p>{t(description)}</p>}
        </div>
        {actions && (
          <div className="page-actions">
            {translateNode(actions, t.language)}
          </div>
        )}
      </header>
      {translateNode(children, t.language)}
    </main>
  );
}

export function Button({ children, variant = "primary", ...props }) {
  const t = useTranslation();
  return (
    <button className={`sw-button ${variant}`} {...props}>
      {translateNode(children, t.language)}
    </button>
  );
}

export function Input({ label, error, hint, className = "", ...props }) {
  const t = useTranslation();
  return (
    <label className={`sw-field ${className}`}>
      {label && (
        <span>
          {typeof label === "string"
            ? t(label)
            : translateNode(label, t.language)}
        </span>
      )}
      <input className={error ? "invalid" : ""} {...props} />
      {hint && !error && (
        <small className="field-hint">
          {typeof hint === "string" ? t(hint) : translateNode(hint, t.language)}
        </small>
      )}
      {error && <small className="field-error">{t(error)}</small>}
    </label>
  );
}

export function Select({ label, children, ...props }) {
  const t = useTranslation();
  return (
    <label className="sw-field">
      {label && <span>{t(label)}</span>}
      <select {...props}>{translateNode(children, t.language)}</select>
    </label>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
  id,
}) {
  const t = useTranslation();
  return (
    <section id={id} className={`sw-panel ${className}`}>
      {(title || actions) && (
        <div className="sw-panel-heading">
          <div>
            {title && <h2>{t(title)}</h2>}
            {subtitle && <p>{t(subtitle)}</p>}
          </div>
          {actions}
        </div>
      )}
      {translateNode(children, t.language)}
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
  const t = useTranslation();
  return (
    <article className="sw-metric">
      <span className={`sw-metric-icon ${tone}`}>
        <Icon size={17} />
      </span>
      <span className="sw-metric-label">{t(label)}</span>
      <strong>{value ?? "—"}</strong>
      {note && <small>{t(note)}</small>}
    </article>
  );
}

export function Status({ value }) {
  const t = useTranslation();
  const status = String(value || "unknown").toLowerCase();
  return (
    <span className={`sw-status ${status}`}>
      <i />
      {t(
        value
          ? `${String(value).charAt(0).toUpperCase()}${String(value).slice(1)}`
          : "Unknown",
      )}
    </span>
  );
}

export function Empty({ title = "Nothing here yet", children, action }) {
  const t = useTranslation();
  return (
    <div className="sw-empty">
      <span>
        <CheckCircle2 size={20} />
      </span>
      <b>{t(title)}</b>
      {children && <p>{translateNode(children, t.language)}</p>}
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
  const t = useTranslation();
  return (
    <div className="sw-table-wrap">
      <table className="sw-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{t(col.label)}</th>
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
                <Empty>{t(empty)}</Empty>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Notice({ children, tone = "info" }) {
  const t = useTranslation();
  return (
    <div className={`sw-notice ${tone}`}>
      {translateNode(children, t.language)}
    </div>
  );
}

export function AuthShell({
  title,
  description,
  children,
  footer,
  backTo = "/login",
  compact = false,
}) {
  const t = useTranslation();
  return (
    <main className={`auth-page ${compact ? "compact" : ""}`}>
      <div className="auth-aside">
        <Link className="auth-brand" to="/">
          <Activity size={25} />
          <span>SiteWatch</span>
        </Link>
        <div className="auth-pitch">
          <span className="auth-kicker">SITEWATCH MONITORING</span>
          <h1>
            {t("Your websites.")}
            <br />
            {t("Always in sight.")}
          </h1>
          <p>{t("Clear, timely signals for every service you depend on.")}</p>
          <div className="auth-proof">
            <i />
            <span>{t("Monitoring systems are operational")}</span>
          </div>
        </div>
        <small className="auth-aside-foot">
          {t("Reliable checks. Clear answers.")}
        </small>
      </div>
      <section className="auth-content">
        <div className="auth-card">
          <Link className="auth-back" to={backTo}>
            <ArrowLeft size={14} /> {t("Back")}
          </Link>
          <h2>{t(title)}</h2>
          {description && <p className="auth-description">{t(description)}</p>}
          {translateNode(children, t.language)}
          {footer && (
            <div className="auth-footer">
              {translateNode(footer, t.language)}
            </div>
          )}
        </div>
        <small className="auth-legal">
          © {new Date().getFullYear()} SiteWatch · Secure website monitoring
        </small>
      </section>
    </main>
  );
}

export function FormActions({ children, backTo }) {
  const t = useTranslation();
  return (
    <div className="form-actions">
      {children}
      {backTo && (
        <Link to={backTo} className="text-link">
          {t("Back")} <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}
