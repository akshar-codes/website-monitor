import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Laptop, Monitor, Smartphone } from "lucide-react";
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

  return null;
}
