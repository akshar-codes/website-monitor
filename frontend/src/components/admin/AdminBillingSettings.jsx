import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Save } from "lucide-react";
import { Button, Input, Notice, Panel, Select } from "../ui/Primitives";
import {
  getAdminBillingSettings,
  updateAdminBillingSettings,
} from "../../services/api/admin";

const DEFAULTS = {
  mode: "request",
  currency: "USD",
  prices: {
    free: { monthly: 0, yearly: 0 },
    pro: { monthly: 12, yearly: 120 },
    unlimited: { monthly: 49, yearly: 490 },
  },
};

export default function AdminBillingSettings({ onSaved }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [paymentReady, setPaymentReady] = useState(false);
  const [webhookReady, setWebhookReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getAdminBillingSettings()
      .then((value) => {
        if (!active || !value) return;
        setSettings({
          mode: value.mode,
          currency: value.currency,
          prices: value.prices,
        });
        setPaymentReady(Boolean(value.paymentReady));
        setWebhookReady(Boolean(value.webhookReady));
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const setPrice = (plan, period, value) =>
    setSettings((old) => ({
      ...old,
      prices: {
        ...old.prices,
        [plan]: {
          ...old.prices[plan],
          [period]: value === "" ? "" : Number(value),
        },
      },
    }));
  const save = async () => {
    setSaving(true);
    try {
      const value = await updateAdminBillingSettings(settings);
      setSettings({
        mode: value.mode,
        currency: value.currency,
        prices: value.prices,
      });
      setPaymentReady(Boolean(value.paymentReady));
      setWebhookReady(Boolean(value.webhookReady));
      onSaved?.();
      toast.success("Billing settings saved");
    } catch {
      /* API interceptor shows server validation errors. */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Checkout and pricing"
      subtitle="Choose how upgrades work and set published plan prices."
      actions={
        <Button disabled={loading || saving} onClick={save}>
          <Save size={14} /> {saving ? "Saving…" : "Save billing settings"}
        </Button>
      }
    >
      {!paymentReady && (
        <Notice tone="warning">
          Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the backend environment
          to enable direct checkout. The secret is never sent to the browser.
        </Notice>
      )}
      {paymentReady && !webhookReady && (
        <Notice tone="warning">
          Recommended: set RAZORPAY_WEBHOOK_SECRET and register{" "}
          <code>/api/payments/webhook</code> in Razorpay for the{" "}
          <code>payment.captured</code> event.
        </Notice>
      )}
      {settings.mode === "payment" && settings.currency !== "INR" && (
        <Notice tone="warning">
          Razorpay checkout requires INR. Change the currency to INR before
          saving this mode.
        </Notice>
      )}
      <div className="sw-form billing-settings-form">
        <Select
          label="Upgrade flow"
          value={settings.mode}
          onChange={(e) =>
            setSettings((old) => ({ ...old, mode: e.target.value }))
          }
        >
          <option value="request">Request review</option>
          <option value="payment" disabled={!paymentReady}>
            Direct Razorpay payment
          </option>
        </Select>
        <Select
          label="Plan currency"
          value={settings.currency}
          onChange={(e) =>
            setSettings((old) => ({ ...old, currency: e.target.value }))
          }
        >
          <option value="USD">USD</option>
          <option value="INR">INR</option>
        </Select>
        <div className="billing-price-heading">
          <CreditCard size={16} /> Public prices
        </div>
        <div className="billing-price-grid">
          {[
            ["pro", "Pro"],
            ["unlimited", "Enterprise"],
          ].map(([id, name]) => (
            <fieldset key={id}>
              <legend>{name}</legend>
              <Input
                type="number"
                min="0"
                step="0.01"
                label="Monthly"
                value={settings.prices[id]?.monthly ?? ""}
                onChange={(e) => setPrice(id, "monthly", e.target.value)}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                label="Yearly"
                value={settings.prices[id]?.yearly ?? ""}
                onChange={(e) => setPrice(id, "yearly", e.target.value)}
              />
            </fieldset>
          ))}
        </div>
      </div>
    </Panel>
  );
}
