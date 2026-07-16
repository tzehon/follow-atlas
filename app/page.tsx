import type { Metadata } from "next";
import { FollowAtlasApp } from "./follow-atlas-app";

export const metadata: Metadata = {
  title: "Follow Atlas",
  description:
    "Turn your Instagram following list into a searchable, tagged personal directory.",
};

export default function Home() {
  return <FollowAtlasApp />;
}
