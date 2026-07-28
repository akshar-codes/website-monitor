import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, Loader2, User } from "lucide-react";
import Button from "../ui/Button";
import { cn } from "../../utils/cn";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function getInitials(name) {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * `avatarUrl` is a server-relative path ("/uploads/avatars/...") or an
 * external OAuth-provider URL — both render fine as a plain <img src>.
 * `onUpload` must return a Promise (see hooks/useProfile.js#uploadAvatar).
 */
export default function AvatarUpload({
  avatarUrl,
  name,
  onUpload,
  onDelete,
  uploading = false,
}) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState("");

  // Revoke the object URL whenever it's replaced/unmounted so we don't
  // leak blob references.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const displayUrl = previewUrl || avatarUrl;
  const initials = getInitials(name);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file consecutively
    if (!file) return;

    setError("");

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("Image must be smaller than 2MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    onUpload(file).finally(() => {
      setPreviewUrl(null);
    });
  };

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border-default bg-bg-elevated">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={name || "Profile avatar"}
              className="h-full w-full object-cover"
            />
          ) : initials ? (
            <span className="text-xl font-bold text-emerald-400">
              {initials}
            </span>
          ) : (
            <User size={28} className="text-text-disabled" />
          )}

          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
              <Loader2 size={20} className="animate-spin text-white" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border-default bg-bg-elevated text-text-secondary shadow-sm transition-colors hover:bg-bg-overlay hover:text-white disabled:pointer-events-none disabled:opacity-50"
          aria-label="Change avatar"
        >
          <Camera size={13} />
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div>
          <p className="text-sm font-semibold text-white">Profile photo</p>
          <p className="text-xs text-text-muted">
            Shown on your dashboard and on your public profile.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Camera}
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {avatarUrl ? "Change photo" : "Upload photo"}
          </Button>
          {avatarUrl && (
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={onDelete}
              disabled={uploading}
              className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              Remove
            </Button>
          )}
        </div>

        <p className={cn("text-[11px] text-text-muted", error && "text-red-400")}>
          {error || "JPEG, PNG, or WebP. Max 2MB."}
        </p>
      </div>
    </div>
  );
}
