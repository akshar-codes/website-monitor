import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FormField, Input } from "../ui/Input";

export default function PasswordField({
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  autoComplete,
  disabled,
  required = true,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField label={label} error={error} required={required}>
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          error={!!error}
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-secondary focus:outline-none"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </FormField>
  );
}
