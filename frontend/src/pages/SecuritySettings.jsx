import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Laptop, Monitor, Smartphone } from "lucide-react";
import { formatDateTime } from "../utils/format";
import { useAuth } from "../hooks/useAuth";
import * as authApi from "../services/api/auth";
import { Page, Panel, Button } from "../components/ui/Primitives";
import { Eye, EyeOff, ShieldCheck, LogOut } from "lucide-react";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[0-9]/, "Include a number")
      .regex(/[^A-Za-z0-9]/, "Include a special character"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((values) => values.password !== values.currentPassword, {
    path: ["password"],
    message: "Choose a password different from the current one",
  });

const requirements = [
  ["length", "At least 8 characters", (value) => value.length >= 8],
  ["uppercase", "One uppercase letter", (value) => /[A-Z]/.test(value)],
  ["number", "One number", (value) => /[0-9]/.test(value)],
  ["special", "One special character", (value) => /[^A-Za-z0-9]/.test(value)],
];

function deviceLabel(userAgent = "") {
  if (/iphone|android.*mobile/i.test(userAgent))
    return { label: "Mobile device", icon: Smartphone };
  if (/ipad|tablet/i.test(userAgent)) return { label: "Tablet", icon: Monitor };
  if (/windows|macintosh|linux/i.test(userAgent))
    return { label: "Desktop device", icon: Laptop };
  return { label: "Unknown device", icon: Monitor };
}

export default function SecuritySettings() {
  const navigate = useNavigate();
  const { refetchUser } = useAuth();
  const [security, setSecurity] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [visible, setVisible] = useState({});
  const [selectedSession, setSelectedSession] = useState(null);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });
  const newPassword = useWatch({ control, name: "password", defaultValue: "" });

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const result = await authApi.getSessions();
      setSessions(result.data || []);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([authApi.getSecuritySettings(), authApi.getSessions()])
      .then(([securityResult, sessionsResult]) => {
        if (!active) return;
        setSecurity(securityResult.data);
        setSessions(sessionsResult.data || []);
      })
      .catch(() => {
        if (active) toast.error("Could not load security settings");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setSessionsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const onChangePassword = async (values) => {
    setSavingPassword(true);
    try {
      const result = await authApi.changePassword(values);
      toast.success(
        result.message || "Password changed. Please sign in again.",
      );
      reset();
      await refetchUser();
      navigate("/login", { replace: true });
    } catch {
      // The API interceptor displays the server's validation/auth error.
    } finally {
      setSavingPassword(false);
    }
  };

  const revokeSelectedSession = async () => {
    if (!selectedSession) return;
    setRevoking(true);
    try {
      await authApi.revokeSession(selectedSession.id);
      toast.success("Session revoked");
      setSelectedSession(null);
      await refreshSessions();
    } catch {
      // The API interceptor displays the server error.
    } finally {
      setRevoking(false);
    }
  };

  const logoutAll = async () => {
    setLoggingOutAll(true);
    try {
      const result = await authApi.logoutAll();
      toast.success(result.message || "Signed out from all devices");
      await refetchUser();
      navigate("/login", { replace: true });
    } catch {
      // The API interceptor displays the server error.
    } finally {
      setLoggingOutAll(false);
    }
  };

  const otherSessions = useMemo(
    () => sessions.filter((session) => !session.current),
    [sessions],
  );
  const displayedSessions = [
    ...sessions.filter((session) => session.current),
    ...otherSessions,
  ];
  const providerLabel = (provider) =>
    provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <Page
      title="Security"
      description="Manage password strength and active sign-in sessions."
      eyebrow="SETTINGS"
    >
      <div className="settings-layout">
        <aside className="settings-intro">
          <span className="settings-avatar">
            <ShieldCheck size={24} />
          </span>
          <b>Account security</b>
          <small>
            {security?.twoFactorEnabled
              ? "Two-factor authentication enabled"
              : "Protect your account"}
          </small>
          <p>Change your password regularly and review devices with access.</p>
        </aside>
        <div>
          <Panel
            title="Change password"
            subtitle="Your new password must meet all requirements"
          >
            <form
              className="settings-form"
              onSubmit={handleSubmit(onChangePassword)}
            >
              <label className="sw-field">
                Current password
                <div className="password-field">
                  <input
                    type={visible.current ? "text" : "password"}
                    autoComplete="current-password"
                    {...register("currentPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setVisible((v) => ({ ...v, current: !v }))}
                  >
                    {visible.current ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.currentPassword && (
                  <small className="field-error">
                    {errors.currentPassword.message}
                  </small>
                )}
              </label>
              <label className="sw-field">
                New password
                <div className="password-field">
                  <input
                    type={visible.password ? "text" : "password"}
                    autoComplete="new-password"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setVisible((v) => ({ ...v, password: !v }))}
                  >
                    {visible.password ? (
                      <EyeOff size={15} />
                    ) : (
                      <Eye size={15} />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <small className="field-error">
                    {errors.password.message}
                  </small>
                )}
              </label>
              <div className="password-requirements">
                {requirements.map(([key, label, test]) => (
                  <span
                    key={key}
                    className={test(newPassword || "") ? "met" : ""}
                  >
                    {test(newPassword || "") ? "✓" : "○"} {label}
                  </span>
                ))}
              </div>
              <label className="sw-field">
                Confirm new password
                <input
                  type="password"
                  autoComplete="new-password"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <small className="field-error">
                    {errors.confirmPassword.message}
                  </small>
                )}
              </label>
              <Button disabled={savingPassword}>
                {savingPassword ? "Updating…" : "Update password"}
              </Button>
            </form>
          </Panel>
          <Panel
            title="Signed-in devices"
            subtitle="Revoke sessions you no longer recognize"
            actions={
              <Button
                variant="secondary"
                onClick={() => setLogoutAllOpen(true)}
              >
                <LogOut size={14} /> Sign out everywhere
              </Button>
            }
          >
            {loading || sessionsLoading ? (
              <div className="sw-loading">Loading sessions…</div>
            ) : (
              <div className="session-list">
                {displayedSessions.map((session) => {
                  const device = deviceLabel(session.userAgent);
                  const DeviceIcon = device.icon;
                  return (
                    <article className="session-row" key={session.id}>
                      <span className="session-device">
                        <DeviceIcon size={17} />
                      </span>
                      <div>
                        <b>
                          {device.label}{" "}
                          {session.current && (
                            <span className="current-tag">Current</span>
                          )}
                        </b>
                        <p>
                          {session.ipAddress || session.ip || "IP unavailable"}{" "}
                          · {providerLabel(session.provider || "password")}
                        </p>
                        <small>
                          Last active{" "}
                          {formatDateTime(
                            session.lastActiveAt || session.createdAt,
                          )}
                        </small>
                      </div>
                      {!session.current && (
                        <Button
                          variant="secondary"
                          disabled={revoking}
                          onClick={() => setSelectedSession(session)}
                        >
                          Revoke
                        </Button>
                      )}
                    </article>
                  );
                })}
                {!sessions.length && (
                  <div className="sw-empty">
                    <b>No session details available</b>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>
      {(selectedSession || logoutAllOpen) && (
        <div className="modal-backdrop">
          <section className="form-modal">
            <h2>
              {selectedSession
                ? "Revoke this session?"
                : "Sign out of all devices?"}
            </h2>
            <p className="muted-copy">
              {selectedSession
                ? "This device will need to sign in again."
                : "You will need to sign in again on every device."}
            </p>
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedSession(null);
                  setLogoutAllOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={revoking || loggingOutAll}
                onClick={selectedSession ? revokeSelectedSession : logoutAll}
              >
                {selectedSession ? "Revoke session" : "Sign out everywhere"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}
