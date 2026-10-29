import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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

  return null;
}
