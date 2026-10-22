import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";
import { FormField, Input, Textarea } from "../../components/ui/Input";
import Button from "../../components/ui/Button";

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name cannot exceed 120 characters"),
  bio: z.string().trim().max(500, "Bio cannot exceed 500 characters"),
  location: z.string().trim().max(120, "Location cannot exceed 120 characters"),
  website: z
    .string()
    .trim()
    .max(200, "Website URL cannot exceed 200 characters")
    .refine(
      (v) => {
        if (!v) return true;
        try {
          return ["http:", "https:"].includes(new URL(v).protocol);
        } catch {
          return false;
        }
      },
      { message: "Must be a valid HTTP or HTTPS URL" },
    ),
  phone: z
    .string()
    .trim()
    .max(30, "Phone number cannot exceed 30 characters")
    .regex(/^[+]?[\d\s\-().]*$/, "Enter a valid phone number"),
});

export default function ProfileForm({ profile, onSubmit, submitting }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      bio: "",
      location: "",
      website: "",
      phone: "",
    },
  });

  // Reset the form whenever a fresh profile loads (initial fetch, or after
  // a successful save), so unsaved edits from a prior render never linger.
  useEffect(() => {
    if (!profile) return;
    reset({
      name: profile.name || "",
      bio: profile.bio || "",
      location: profile.location || "",
      website: profile.website || "",
      phone: profile.phone || "",
    });
  }, [profile, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField label="Full name" error={errors.name?.message} required>
        <Input
          {...register("name")}
          placeholder="Your full name"
          error={!!errors.name}
        />
      </FormField>

      <FormField
        label="Bio"
        error={errors.bio?.message}
        hint="A short description shown on your public profile."
      >
        <Textarea
          {...register("bio")}
          rows={3}
          maxLength={500}
          placeholder="Tell us a bit about yourself"
          error={!!errors.bio}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Location" error={errors.location?.message}>
          <Input
            {...register("location")}
            placeholder="City, Country"
            error={!!errors.location}
          />
        </FormField>

        <FormField label="Phone number" error={errors.phone?.message}>
          <Input
            {...register("phone")}
            placeholder="+1 555 123 4567"
            error={!!errors.phone}
          />
        </FormField>
      </div>

      <FormField label="Website" error={errors.website?.message}>
        <Input
          {...register("website")}
          placeholder="https://example.com"
          error={!!errors.website}
        />
      </FormField>

      <div className="flex justify-end border-t border-border-subtle pt-4">
        <Button
          type="submit"
          variant="primary"
          icon={Save}
          loading={submitting}
          disabled={submitting || !isDirty}
        >
          Save changes
        </Button>
      </div>
    </form>
  );
}
