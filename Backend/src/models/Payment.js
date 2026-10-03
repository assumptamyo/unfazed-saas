import mongoose from "mongoose";

// One online payment: either a single session, or a package bought together with
// its first session. While status is "created" the payment also holds the slot
// (until holdExpiresAt) so nobody else can book it during checkout. The client,
// session (and package) are only created once the payment succeeds.
const paymentSchema = new mongoose.Schema(
  {
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Therapist",
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
    kind: {
      type: String,
      enum: ["session", "package"],
      default: "session",
    },
    // For kind "package": what is being bought, copied from the therapist's offer
    packagePurchase: {
      package: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
      sessionCount: { type: Number },
      pricePerSession: { type: Number },
      validityDays: { type: Number },
    },
    clientPackage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientPackage",
    },
    amount: {
      type: Number, // in paise (₹1 = 100), what the client pays
      required: true,
      min: 100,
    },
    // Unfazed's commission and what the therapist receives (amount - platformFee)
    platformFee: {
      type: Number,
      default: 0,
    },
    netAmount: {
      type: Number,
    },
    // Invoice tax details, fixed at the time of payment
    tax: {
      gstin: { type: String, default: "" },
      rate: { type: Number, default: 0 },
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      // created -> processing -> paid -> refunded
      //        \-> failed / expired / released
      type: String,
      enum: ["created", "processing", "paid", "failed", "expired", "released", "refunded"],
      default: "created",
    },
    holdExpiresAt: {
      type: Date,
    },
    // What the client entered in the booking form, used to create the booking after payment
    booking: {
      clientName: { type: String, required: true },
      clientEmail: { type: String, required: true },
      clientPhone: { type: String, default: "" },
      whatsappOptIn: { type: Boolean, default: true },
      date: { type: Date, required: true },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      notes: { type: String, default: "" },
      age: { type: Number },
      gender: { type: String, default: "" },
      occupation: { type: String, default: "" },
      presentingConcern: { type: String, default: "" },
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
    },
    // The gateway transaction id
    razorpayPaymentId: {
      type: String,
      alias: "gatewayTransactionId",
    },
    method: {
      type: String, // upi, card, netbanking, wallet…
      default: "",
    },
    paidAt: {
      type: Date,
    },
    // Invoice number, e.g. UNF-2026-00012
    receiptNumber: {
      type: String,
    },
    // Unguessable token so the client can open their receipt from the email without logging in
    receiptToken: {
      type: String,
      index: true,
    },
    failureReason: {
      type: String,
      default: "",
    },
    refund: {
      razorpayRefundId: { type: String },
      amount: { type: Number },
      reason: { type: String, default: "" },
      createdAt: { type: Date },
    },
  },
  { timestamps: true }
);

paymentSchema.index({ therapist: 1, status: 1, holdExpiresAt: 1 });
paymentSchema.index({ therapist: 1, createdAt: -1 });
paymentSchema.index({ session: 1 });

export default mongoose.model("Payment", paymentSchema);
