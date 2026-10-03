import { useState } from "react";
import { updateInvoiceSettings } from "../../api/billingApi";
import { apiError } from "../appointments/appointmentUtils";
import { useToast } from "../../context/toastContext";

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// GST details printed on the invoices clients receive
const InvoiceSettingsCard = ({ invoice, platformFeePercent }) => {
  const { notify } = useToast();
  const [gstin, setGstin] = useState(invoice?.gstin || "");
  const [gstRate, setGstRate] = useState(invoice?.gstRate || 0);
  const [saved, setSaved] = useState({
    gstin: invoice?.gstin || "",
    gstRate: invoice?.gstRate || 0,
  });
  const [saving, setSaving] = useState(false);

  const cleanGstin = gstin.trim().toUpperCase();
  const invalid = cleanGstin && !GSTIN_PATTERN.test(cleanGstin);
  const dirty = cleanGstin !== saved.gstin || gstRate !== saved.gstRate;

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateInvoiceSettings({ gstin: cleanGstin, gstRate });
      setSaved(res.data.invoice);
      setGstin(res.data.invoice.gstin);
      notify(res.data.message);
    } catch (err) {
      notify(apiError(err), { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-[#EFE6DA] rounded-3xl p-5 sm:p-6 flex flex-col">
      <h2 className="font-serif text-lg text-[#2B221E] mb-1">Invoices</h2>
      <p className="text-sm text-[#8A7A6D] mb-4">
        Clients get a GST-style invoice by email after every payment. Prices you
        set already include GST.
      </p>

      <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <label className="text-[11px] font-medium text-[#8A7A6D]">
            GSTIN <span className="font-normal">(optional)</span>
            <input
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              maxLength={15}
              placeholder="e.g. 27ABCDE1234F1Z5"
              className="mt-1 w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-xl px-3 py-2 text-sm tracking-wide text-[#2B221E] focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40 focus:border-[#FF9E4C] transition"
            />
          </label>
          {invalid && (
            <p className="text-xs text-[#9C3B2E] mt-1">
              A GSTIN has 15 characters, like 27ABCDE1234F1Z5.
            </p>
          )}
        </div>

        <div>
          <p className="text-[11px] font-medium text-[#8A7A6D] mb-1.5">
            GST on sessions
          </p>
          <div
            className="flex gap-1 p-1 bg-[#F3EBDF]/70 rounded-2xl w-fit"
            role="group"
            aria-label="GST rate"
          >
            {[
              [0, "Not charged"],
              [18, "18% (CGST + SGST)"],
            ].map(([rate, label]) => (
              <button
                key={rate}
                onClick={() => setGstRate(rate)}
                disabled={rate > 0 && !cleanGstin}
                aria-pressed={gstRate === rate}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition disabled:opacity-40 ${
                  gstRate === rate
                    ? "bg-white text-[#2B221E] shadow-sm"
                    : "text-[#6B5B52] hover:text-[#2B221E]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#A89C8F] mt-1.5">
            Most therapy services don't charge GST. Check with your accountant.
          </p>
        </div>
      </div>

      {dirty && (
        <button
          onClick={save}
          disabled={saving || invalid}
          className="mt-4 self-start text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#211A16] text-white hover:bg-[#3A2E27] transition disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      )}

      <p className="text-xs text-[#8A7A6D] mt-auto pt-5 border-t border-[#F3EBDF]">
        Unfazed keeps a{" "}
        <strong className="text-[#2B221E]">
          {platformFeePercent}% platform fee
        </strong>{" "}
        on each online payment on your plan; the rest is yours.
      </p>
    </div>
  );
};

export default InvoiceSettingsCard;
