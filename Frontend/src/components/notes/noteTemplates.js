export const TEMPLATES = {
  soap: {
    label: "SOAP",
    description: "Subjective · Objective · Assessment · Plan",
    sections: ["subjective", "objective", "assessment", "plan"],
  },
  dap: {
    label: "DAP",
    description: "Data · Assessment · Plan",
    sections: ["data", "assessment", "plan"],
  },
  free: {
    label: "Free write",
    description: "One open space for your notes",
    sections: ["body"],
  },
};

export const SECTIONS = {
  subjective: {
    letter: "S",
    title: "Subjective",
    hint: "What the client shared — feelings, concerns, events, progress in their own words.",
    placeholder: "Client reports…",
    color: "#D96B00",
  },
  objective: {
    letter: "O",
    title: "Objective",
    hint: "What you observed — affect, appearance, behaviour, engagement.",
    placeholder: "Presented as…",
    color: "#5B7A99",
  },
  data: {
    letter: "D",
    title: "Data",
    hint: "What was said and observed during the session.",
    placeholder: "Client discussed…",
    color: "#D96B00",
  },
  assessment: {
    letter: "A",
    title: "Assessment",
    hint: "Your clinical impressions and progress toward goals.",
    placeholder: "Client appears…",
    color: "#8A5C77",
  },
  plan: {
    letter: "P",
    title: "Plan",
    hint: "Next steps, homework, and focus for the next session.",
    placeholder: "Next session we will…",
    color: "#4F7161",
  },
  body: {
    letter: "✎",
    title: "Notes",
    hint: "Write freely.",
    placeholder: "Start writing…",
    color: "#D96B00",
  },
};

export const emptySections = () => Object.fromEntries(Object.keys(SECTIONS).map((k) => [k, ""]));

export const countWords = (template, sections) =>
  TEMPLATES[template].sections
    .map((k) => sections[k] || "")
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
