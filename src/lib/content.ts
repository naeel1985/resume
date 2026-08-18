/**
 * Single source of truth for everything the marketing page renders.
 *
 * Kept deliberately separate from `public/me/*.txt`, which is what the chat
 * assistant reads. If you change a role or certification here, mirror it there
 * so the page and the assistant agree.
 */

export const profile = {
  name: "Naeel Zuriek",
  role: "Infrastructure & ELV Specialist",
  tagline:
    "Eighteen years designing, deploying and commissioning the low-voltage and ICT systems behind container terminals, airports, oil fields and corporate headquarters.",
  location: "Abu Dhabi, UAE",
  email: "eng.naeel.zuriek@gmail.com",
  phone: "+971 52 284 4000",
  phoneHref: "+971522844000",
  photo: "/me.jpg",
  cv: "/me/cv.pdf",
  certificates: "/me/cer.pdf",
} as const;

export const stats = [
  { value: "18+", label: "Years experience" },
  { value: "100+", label: "Projects delivered" },
  { value: "7", label: "Certifications" },
  { value: "4", label: "Sectors" },
] as const;

/**
 * `year` and `body` are optional — the UI simply omits them when absent, so an
 * unknown award date is never guessed at. Fill them in when you have them.
 */
export type Certification = {
  name: string;
  short: string;
  body?: string;
  year?: string;
};

export const certifications: Certification[] = [
  { name: "Project Management Professional", short: "PMP", body: "PMI", year: "2024" },
  {
    name: "Registered Communications Distribution Designer",
    short: "RCDD",
    body: "BICSI",
    year: "2023",
  },
  // TODO(naeel): add the award year (and confirm the issuing body) for these three.
  {
    name: "Registered Telecommunications Project Manager",
    short: "RTPM",
    body: "BICSI",
    year: "2026",
  },
  {
    name: "Certified Sustainable Project Professional",
    short: "CSPP",
    body: "PMI",
    year: "2026",
  },
  {
    name: "Certified Professional in Managing AI",
    short: "PMP-CPMAI",
    body: "PMI",
    year: "2026",
  },
  { name: "SIRA & ADMCC Security Engineer", short: "SIRA", body: "UAE Government", year: "2024" },
  { name: "Cisco Certified Network Associate", short: "CCNA", body: "Cisco", year: "2017" },
];

export type Experience = {
  title: string;
  company: string;
  duration: string;
  location: string;
  year: string;
  current?: boolean;
  points: string[];
};

export const experience: Experience[] = [
  {
    title: "Infrastructure & Network Specialist",
    company: "CMA Terminals — Khalifa Port",
    duration: "Apr 2024 — Present",
    location: "Abu Dhabi, UAE",
    year: "2024",
    current: true,
    points: [
      "Lead network infrastructure and security systems across the terminal",
      "Monitor performance, capacity and fault resolution on live operations",
      "Coordinate with operations, IT and vendor teams on change delivery",
    ],
  },
  {
    title: "ELV / ICT Project Manager",
    company: "Maqta Gateway — Abu Dhabi Ports",
    duration: "Mar 2023 — Apr 2024",
    location: "Abu Dhabi, UAE",
    year: "2023",
    points: [
      "Owned ELV project lifecycles from design review to handover",
      "Managed budgets, procurement and contractor schedules",
      "Ran quality assurance and commissioning sign-off",
    ],
  },
  {
    title: "Engineering Manager",
    company: "Transtel Communication Networks",
    duration: "Jul 2022 — Mar 2023",
    location: "Dubai, UAE",
    year: "2022",
    points: [
      "Evaluated smart-building and ICT technologies for tender response",
      "Negotiated terms with major infrastructure vendors",
      "Led multidisciplinary design and delivery teams",
    ],
  },
];

export type Project = {
  title: string;
  company: string;
  description: string;
  technologies: string[];
  year: string;
  sector: string;
};

export const projects: Project[] = [
  {
    title: "CMA Terminals, Khalifa Port",
    company: "CMA Terminals",
    description:
      "Tier 3 data centre and disaster-recovery site, 20 racks, supporting live container terminal operations.",
    technologies: ["Data centre", "Network infrastructure", "Disaster recovery"],
    year: "2024",
    sector: "Ports",
  },
  {
    title: "Sharjah Airport expansion",
    company: "e& AI&IoT",
    description:
      "Huawei Tier 3 data centre deployment across 108 racks as part of the airport expansion programme.",
    technologies: ["Huawei", "Data centre", "Airport systems"],
    year: "2023",
    sector: "Aviation",
  },
  {
    title: "VISA CEMEA headquarters",
    company: "WASEELA",
    description:
      "End-to-end CCTV and access-control design and implementation for the regional headquarters.",
    technologies: ["CCTV", "Access control", "Security systems"],
    year: "2021",
    sector: "Corporate",
  },
  {
    title: "Al-Zubair, Badra CPF & Majnoon fields",
    company: "IVS Technology",
    description:
      "Telecommunications and fibre systems for three producing oil and gas fields in Iraq.",
    technologies: ["Telecommunications", "Fibre optics", "Industrial networks"],
    year: "2015",
    sector: "Oil & gas",
  },
];

export type SkillGroup = { category: string; items: { name: string; level: number }[] };

export const skills: SkillGroup[] = [
  {
    category: "Technical",
    items: [
      { name: "ELV systems design", level: 95 },
      { name: "Network architecture", level: 90 },
      { name: "ICT infrastructure", level: 88 },
      { name: "Fibre optics", level: 87 },
      { name: "CCTV & security systems", level: 85 },
    ],
  },
  {
    category: "Management",
    items: [
      { name: "Project management", level: 92 },
      { name: "Team leadership", level: 90 },
      { name: "Budget planning", level: 89 },
    ],
  },
];

export const navigation = [
  { id: "about", label: "About", index: "01" },
  { id: "experience", label: "Experience", index: "02" },
  { id: "projects", label: "Projects", index: "03" },
  { id: "skills", label: "Skills", index: "04" },
] as const;

export const chatSuggestions = [
  "Tell me about the Khalifa Port data centre project.",
  "What is your experience with Huawei infrastructure?",
  "Walk me through the Sharjah Airport expansion.",
  "Which ELV certifications do you hold?",
] as const;
