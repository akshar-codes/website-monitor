import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  LogOut,
  Monitor,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "../components/ui/Card";
import Button from "../components/ui/Button";
import { FormField, Input } from "../components/ui/Input";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { formatDateTime } from "../utils/format";
import { useAuth } from "../hooks/useAuth";
import * as authApi from "../services/api/auth";

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

function PasswordField({
  label,
  error,
  register,
  name,
  visible,
  onToggle,
  autoComplete,
}) {
  return (
    <FormField label={label} error={error} required>
      <div className="relative">
        <Input
          {...register(name)}
          type={visible ? "text" : "password"}
          error={!!error}
          autoComplete={autoComplete}
          className="pr-11"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-muted hover:text-white"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </FormField>
  );
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

  if (loading)
    return (
      <div className="space-y-4">
        <div className="h-64 animate-pulse rounded-xl bg-bg-overlay" />
        <div className="h-64 animate-pulse rounded-xl bg-bg-overlay" />
      </div>
    );

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
            <KeyRound size={17} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Password</h2>
            <p className="mt-1 text-xs text-text-muted">
              Change your password. You’ll be signed out of every device
              afterward.
            </p>
          </div>
        </div>
        {security?.hasPassword ? (
          <form
            onSubmit={handleSubmit(onChangePassword)}
            className="max-w-xl space-y-4"
          >
            <PasswordField
              label="Current password"
              name="currentPassword"
              register={register}
              error={errors.currentPassword?.message}
              visible={!!visible.current}
              onToggle={() =>
                setVisible((state) => ({ ...state, current: !state.current }))
              }
              autoComplete="current-password"
            />
            <PasswordField
              label="New password"
              name="password"
              register={register}
              error={errors.password?.message}
              visible={!!visible.new}
              onToggle={() =>
                setVisible((state) => ({ ...state, new: !state.new }))
              }
              autoComplete="new-password"
            />
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border-subtle bg-bg-elevated p-3 sm:grid-cols-4">
              {requirements.map(([key, label, test]) => (
                <div
                  key={key}
                  className={`flex items-center gap-1.5 text-[11px] ${test(newPassword) ? "text-emerald-400" : "text-text-muted"}`}
                >
                  <Check size={12} />
                  {label}
                </div>
              ))}
            </div>
            <PasswordField
              label="Confirm new password"
              name="confirmPassword"
              register={register}
              error={errors.confirmPassword?.message}
              visible={!!visible.confirm}
              onToggle={() =>
                setVisible((state) => ({ ...state, confirm: !state.confirm }))
              }
              autoComplete="new-password"
            />
            <div className="flex justify-end border-t border-border-subtle pt-4">
              <Button
                type="submit"
                variant="primary"
                loading={savingPassword}
                disabled={savingPassword}
              >
                Change password
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-lg border border-border-default bg-bg-elevated p-4">
            <p className="text-sm font-medium text-white">
              No local password is set
            </p>
            <p className="mt-1 text-xs text-text-muted">
              This account signs in with{" "}
              {security?.providers?.length
                ? security.providers.map(providerLabel).join(" and ")
                : "an external identity provider"}
              . Use the password reset flow to add a local password.
            </p>
            <Link
              to="/forgot-password"
              className="mt-3 inline-block text-xs font-medium text-emerald-400 hover:text-emerald-300"
            >
              Set a local password
            </Link>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
              <ShieldCheck size={17} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Active sessions
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                Review signed-in devices and revoke sessions you don’t
                recognize.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="danger"
            icon={LogOut}
            disabled={!sessions.length}
            onClick={() => setLogoutAllOpen(true)}
          >
            Log out all devices
          </Button>
        </div>
        {sessionsLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-bg-overlay" />
        ) : sessions.length === 0 ? (
          <p className="rounded-lg border border-border-subtle p-4 text-sm text-text-muted">
            No active sessions found.
          </p>
        ) : (
          <div className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
            {displayedSessions.map((session) => {
              const { label, icon: DeviceIcon } = deviceLabel(
                session.userAgent || "",
              );
              return (
                <div
                  key={session.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-elevated text-text-secondary">
                    <DeviceIcon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white">{label}</p>
                      {session.current && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          This device
                        </span>
                      )}
                    </div>
                    <p className="mt-1 break-all text-xs text-text-muted">
                      {session.userAgent || "Browser details unavailable"}
                    </p>
                    <p className="mt-1 text-[11px] text-text-disabled">
                      {session.ip || "IP unavailable"} · Signed in{" "}
                      {session.loginAt
                        ? formatDateTime(session.loginAt)
                        : "at an unknown time"}
                      {session.expiresAt
                        ? ` · Expires ${formatDateTime(session.expiresAt)}`
                        : ""}
                    </p>
                  </div>
                  {!session.current && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      disabled={revoking}
                      onClick={() => setSelectedSession(session)}
                      className="self-start text-red-400 hover:bg-red-500/10 hover:text-red-300 sm:self-center"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-[11px] text-text-muted">
          Revoked devices will need to sign in again. Expired sessions are
          excluded.
        </p>
      </Card>

      <ConfirmDialog
        open={!!selectedSession}
        onClose={() => {
          if (!revoking) setSelectedSession(null);
        }}
        onConfirm={revokeSelectedSession}
        title="Revoke this session?"
        description="This device will be signed out and must authenticate again to access your account."
        confirmLabel="Revoke session"
        loading={revoking}
      />
      <ConfirmDialog
        open={logoutAllOpen}
        onClose={() => {
          if (!loggingOutAll) setLogoutAllOpen(false);
        }}
        onConfirm={logoutAll}
        title="Log out of all devices?"
        description="This ends every active session, including this one. You’ll need to sign in again."
        confirmLabel="Log out everywhere"
        loading={loggingOutAll}
      />
    </div>
  );
}
