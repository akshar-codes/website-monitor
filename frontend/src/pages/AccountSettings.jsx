import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Save, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card } from "../components/ui/Card";
import Button from "../components/ui/Button";
import { FormField, Input, Textarea } from "../components/ui/Input";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "../components/ui/Modal";
import { useAuth } from "../hooks/useAuth";
import * as accountApi from "../services/api/account";

const accountSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  bio: z
    .string()
    .trim()
    .max(500, "Bio cannot exceed 500 characters")
    .optional(),
  location: z
    .string()
    .trim()
    .max(120, "Location cannot exceed 120 characters")
    .optional(),
  website: z
    .string()
    .trim()
    .max(200, "Website URL cannot exceed 200 characters")
    .refine((value) => {
      if (!value) return true;
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }, "Website must be a valid HTTP or HTTPS URL")
    .optional(),
  phone: z
    .string()
    .trim()
    .max(30, "Phone number cannot exceed 30 characters")
    .regex(/^[+]?([\d\s\-().]*)$/, "Enter a valid phone number")
    .optional(),
});

const dateLabel = (value) =>
  value ? new Date(value).toLocaleString() : "Not available";

export default function AccountSettings() {
  const { refetchUser } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", bio: "", location: "", website: "", phone: "" },
  });

  useEffect(() => {
    let alive = true;
    accountApi
      .getAccountSettings()
      .then(({ data }) => {
        if (!alive) return;
        setAccount(data);
        reset({
          name: data.name || "",
          bio: data.bio || "",
          location: data.location || "",
          website: data.website || "",
          phone: data.phone || "",
        });
      })
      .catch((error) => {
        toast.error(
          error.response?.data?.message || "Could not load account settings",
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reset]);

  const onSave = async (values) => {
    setSaving(true);
    try {
      const { data, message } = await accountApi.updateAccountSettings(values);
      setAccount(data);
      reset({
        name: data.name || "",
        bio: data.bio || "",
        location: data.location || "",
        website: data.website || "",
        phone: data.phone || "",
      });
      await refetchUser();
      toast.success(message || "Account settings saved");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not save account settings",
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (event) => {
    event.preventDefault();
    setDeleting(true);
    try {
      await accountApi.deleteAccount(confirmationEmail);
      toast.success("Your account has been deleted");
      await refetchUser();
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete account");
    } finally {
      setDeleting(false);
    }
  };

  if (loading)
    return (
      <div className="space-y-4">
        <div className="h-64 animate-pulse rounded-xl bg-bg-overlay" />
        <div className="h-40 animate-pulse rounded-xl bg-bg-overlay" />
      </div>
    );

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-5">
          <h2 className="text-base font-semibold text-white">
            Account information
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Update the information associated with your account.
          </p>
        </div>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4" noValidate>
          <FormField label="Full name" required error={errors.name?.message}>
            <Input
              {...register("name")}
              error={!!errors.name}
              autoComplete="name"
            />
          </FormField>
          <FormField
            label="Email address"
            hint="Email changes require a separate verification workflow."
          >
            <Input value={account?.email || ""} disabled aria-readonly="true" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Phone" error={errors.phone?.message}>
              <Input
                {...register("phone")}
                error={!!errors.phone}
                autoComplete="tel"
              />
            </FormField>
            <FormField label="Location" error={errors.location?.message}>
              <Input
                {...register("location")}
                error={!!errors.location}
                autoComplete="address-level2"
              />
            </FormField>
          </div>
          <FormField label="Website" error={errors.website?.message}>
            <Input
              {...register("website")}
              error={!!errors.website}
              placeholder="https://example.com"
            />
          </FormField>
          <FormField label="Bio" error={errors.bio?.message}>
            <Textarea
              {...register("bio")}
              error={!!errors.bio}
              rows={3}
              maxLength={500}
            />
          </FormField>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-4">
            <Button
              type="button"
              icon={RotateCcw}
              disabled={!isDirty || saving}
              onClick={() => reset()}
            >
              Reset
            </Button>
            <Button
              type="submit"
              variant="primary"
              icon={Save}
              loading={saving}
              disabled={!isDirty || saving}
            >
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck size={17} className="text-emerald-400" />
          <h2 className="text-base font-semibold text-white">
            Account status &amp; metadata
          </h2>
        </div>
        <dl className="grid gap-x-6 sm:grid-cols-2">
          <div className="border-b border-border-subtle py-3">
            <dt className="text-xs text-text-muted">Status</dt>
            <dd className="mt-1 text-sm text-white">
              {account?.active ? "Active" : "Suspended"}
            </dd>
          </div>
          <div className="border-b border-border-subtle py-3">
            <dt className="text-xs text-text-muted">Email verification</dt>
            <dd className="mt-1 text-sm text-white">
              {account?.emailVerified ? "Verified" : "Not verified"}
            </dd>
          </div>
          <div className="border-b border-border-subtle py-3">
            <dt className="text-xs text-text-muted">Account type</dt>
            <dd className="mt-1 text-sm capitalize text-white">
              {account?.role || "User"}
            </dd>
          </div>
          <div className="border-b border-border-subtle py-3">
            <dt className="text-xs text-text-muted">Plan</dt>
            <dd className="mt-1 text-sm capitalize text-white">
              {account?.planStatus === "active"
                ? account?.plan
                : `${account?.plan} · ${account?.planStatus}`}
            </dd>
          </div>
          <div className="py-3">
            <dt className="text-xs text-text-muted">Member since</dt>
            <dd className="mt-1 text-sm text-white">
              {dateLabel(account?.createdAt)}
            </dd>
          </div>
          <div className="py-3">
            <dt className="text-xs text-text-muted">Last sign in</dt>
            <dd className="mt-1 text-sm text-white">
              {dateLabel(account?.lastLoginAt)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="border-red-500/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-red-300">
              Delete account
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-muted">
              Permanently delete your account and associated monitor data,
              history, preferences, and sessions.
            </p>
          </div>
          <Button
            variant="danger"
            icon={AlertTriangle}
            onClick={() => setDeleteOpen(true)}
          >
            Delete account
          </Button>
        </div>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
            setConfirmationEmail("");
          }
        }}
        maxWidthClassName="max-w-md"
      >
        <ModalHeader
          title="Permanently delete your account?"
          description="This action cannot be undone."
          onClose={() => setDeleteOpen(false)}
        />
        <form onSubmit={onDelete}>
          <ModalBody className="space-y-4">
            <p className="text-sm leading-relaxed text-text-muted">
              All monitors, monitoring history, incidents, preferences, and
              active sessions associated with this account will be deleted.
            </p>
            <FormField label="Type your account email to confirm" required>
              <Input
                type="email"
                value={confirmationEmail}
                onChange={(event) => setConfirmationEmail(event.target.value)}
                autoComplete="email"
              />
            </FormField>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={deleting}
              disabled={
                confirmationEmail.toLowerCase() !==
                account?.email?.toLowerCase()
              }
            >
              Delete permanently
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
