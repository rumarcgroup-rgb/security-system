import { BriefcaseBusiness, Shield, ShieldCheck, UserRound } from "lucide-react";
import secIcon from "../../assets/sec-icon.jpg";
import janIcon from "../../assets/jan-icon.jpg";
import cgroupIcon from "../../assets/cgroup2.png";

export const selectorItems = [
  { key: "cgroup-access", titleClass: "login-selector__card-title--cgroup", copy: "Access CGroup Portal" },
  { key: "security-guard", titleClass: "login-selector__card-title--security", copy: "Access Guard Portal" },
  { key: "janitor", titleClass: "login-selector__card-title--janitor", copy: "Access Janitor Portal" },
];

export const portalConfigs = {
  "cgroup-access": {
    title: "CGroup Access",
    subtitle: "CGroup Access Portal",
    loginTitle: "CGroup Access Login",
    resetHeading: "Reset CGroup Access Password",
    accentClass: "from-[#f4b400] to-[#d99100]",
    buttonClass: "bg-[#f4b400] hover:bg-[#d89f13]",
    badgeClass: "bg-[#fff4cc] text-[#153f91]",
    image: cgroupIcon,
    icon: Shield,
    theme: {
      accentStart: "#f4b400",
      accentEnd: "#d99100",
      buttonColor: "#f4b400",
      buttonHover: "#d89f13",
    },
  },
  "security-guard": {
    title: "Security Guard",
    subtitle: "Security Guard Portal",
    loginTitle: "Security Guard Login",
    resetHeading: "Reset Security Guard Password",
    accentClass: "from-[#0d4dc4] to-[#08347d]",
    buttonClass: "bg-[#0d4dc4] hover:bg-[#0a3fa1]",
    badgeClass: "bg-[#e8f0ff] text-[#0d4dc4]",
    image: secIcon,
    icon: ShieldCheck,
    theme: {
      accentStart: "#0d4dc4",
      accentEnd: "#08347d",
      buttonColor: "#0d4dc4",
      buttonHover: "#0a3fa1",
    },
  },
  janitor: {
    title: "Janitor",
    subtitle: "Janitor Portal",
    loginTitle: "Janitor Login",
    resetHeading: "Reset Janitor Password",
    accentClass: "from-[#0c8b4d] to-[#0b5f37]",
    buttonClass: "bg-[#0c8b4d] hover:bg-[#0a733f]",
    badgeClass: "bg-[#e6fff1] text-[#0c8b4d]",
    image: janIcon,
    icon: UserRound,
    theme: {
      accentStart: "#0c8b4d",
      accentEnd: "#0b5f37",
      buttonColor: "#0c8b4d",
      buttonHover: "#0a733f",
    },
  },
  admin: {
    title: "Admin",
    subtitle: "Admin Portal",
    loginTitle: "Admin Login",
    resetHeading: "Reset Admin Password",
    accentClass: "from-[#123c94] to-[#0f2459]",
    buttonClass: "bg-[#123c94] hover:bg-[#0f2f74]",
    badgeClass: "bg-[#edf2ff] text-[#123c94]",
    icon: BriefcaseBusiness,
    theme: {
      accentStart: "#123c94",
      accentEnd: "#0f2459",
      buttonColor: "#123c94",
      buttonHover: "#0f2f74",
    },
  },
};

export function getPortalConfig(portalType) {
  if (!portalType) return null;
  return portalConfigs[portalType] ?? portalConfigs.admin;
}
