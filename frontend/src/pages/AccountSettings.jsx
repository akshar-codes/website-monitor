import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import * as accountApi from "../services/api/account";
import {
  Page,
  Panel,
  Button,
  Input,
  Notice,
} from "../components/ui/Primitives";
import { Save, Trash2, UserRound } from "lucide-react";

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

export default function AccountSettings() {
  const { refetchUser } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [_loading, setLoading] = useState(true);
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

  return (
    <Page
      title="Account settings"
      description="Update your account details and manage account lifecycle."
      eyebrow="SETTINGS"
    >
      <div className="settings-layout">
        <aside className="settings-intro">
          <span className="settings-avatar">
            <UserRound size={24} />
          </span>
          <b>{account?.name || "Your account"}</b>
          <small>{account?.email}</small>
          <p>
            These details are used for account communication and your profile.
          </p>
        </aside>
        <div>
          <Panel
            title="Personal information"
            subtitle="Keep your account details current"
          >
            <form className="settings-form" onSubmit={handleSubmit(onSave)}>
              <label className="sw-field">
                Name
                <input placeholder="e.g. Jane Doe" {...register("name")} />
                {errors.name && (
                  <small className="field-error">{errors.name.message}</small>
                )}
              </label>
              <label className="sw-field">
                Bio
                <textarea
                  rows="3"
                  placeholder="Tell us a little about yourself or your team..."
                  {...register("bio")}
                />
                {errors.bio && (
                  <small className="field-error">{errors.bio.message}</small>
                )}
              </label>
              <label className="sw-field">
                Location
                <input
                  placeholder="e.g. San Francisco, CA or Remote"
                  {...register("location")}
                />
                {errors.location && (
                  <small className="field-error">
                    {errors.location.message}
                  </small>
                )}
              </label>
              <label className="sw-field">
                Website
                <input
                  type="url"
                  placeholder="https://example.com"
                  {...register("website")}
                />
                {errors.website && (
                  <small className="field-error">
                    {errors.website.message}
                  </small>
                )}
              </label>
              <label className="sw-field">
                Phone
                <input
                  type="tel"
                  placeholder="e.g. +1 (555) 000-0000"
                  {...register("phone")}
                />
                {errors.phone && (
                  <small className="field-error">{errors.phone.message}</small>
                )}
              </label>
              <div className="form-actions">
                <Button disabled={saving || !isDirty}>
                  <Save size={14} />
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </Panel>
          <Panel
            title="Danger zone"
            subtitle="Permanently delete your account and associated data"
          >
            <Notice tone="warning">
              Account deletion is permanent and cannot be undone.
            </Notice>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={14} /> Delete account
            </Button>
          </Panel>
        </div>
      </div>
      {deleteOpen && (
        <div className="modal-backdrop">
          <section className="form-modal">
            <h2>Delete your account?</h2>
            <p className="muted-copy">
              Confirm your email address to permanently delete this account.
            </p>
            <form className="sw-form" onSubmit={onDelete}>
              <Input
                label="Account email"
                type="email"
                placeholder="you@company.com"
                value={confirmationEmail}
                onChange={(e) => setConfirmationEmail(e.target.value)}
                required
              />
              <div className="modal-actions">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setDeleteOpen(false)}
                >
                  Cancel
                </Button>
                <Button variant="danger" disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete account permanently"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </Page>
  );
}
