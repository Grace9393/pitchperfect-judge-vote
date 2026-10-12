import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Gavel, Send } from "lucide-react";
import { useT } from "@/lib/i18n";
import { RoleGuide, ScoringReference } from "@/components/RoleGuide";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { eventName, useActiveEvent } from "@/lib/events";

export const Route = createFileRoute("/guide")({
  head: () => ({ meta: [
    { title: "Judge & Team Guide — Event Judging Hub" },
    { name: "description", content: "Quick event-day guidance for judges and teams: submissions, pitches, scoring and audience voting." },
    { property: "og:title", content: "Judge & Team Guide — Event Judging Hub" },
    { property: "og:description", content: "A short guide to submitting projects, judging pitches and voting fairly." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: GuidePage,
});

function GuidePage() {
  const { lang } = useT(); const zh = lang === "zh"; const event = useActiveEvent();
  return <main className="mx-auto max-w-3xl px-4 py-8">
    <BookOpen className="mb-3 h-7 w-7 text-primary" />
    <p className="text-sm text-muted-foreground">{eventName(event, lang)}</p>
    <h1 className="mt-1 text-3xl font-semibold">{zh ? "評審與隊伍指南" : "Judge & team guide"}</h1>
    <Tabs defaultValue="team" className="mt-6">
      <TabsList><TabsTrigger value="team"><Send className="mr-2 h-4 w-4" />{zh ? "參賽隊伍" : "Teams"}</TabsTrigger><TabsTrigger value="judge"><Gavel className="mr-2 h-4 w-4" />{zh ? "評審" : "Judges"}</TabsTrigger></TabsList>
      <TabsContent value="team" className="pt-5"><RoleGuide role="team" /><Button className="mt-6" asChild><Link to="/submit">{zh ? "提交作品" : "Submit project"}</Link></Button></TabsContent>
      <TabsContent value="judge" className="pt-5"><RoleGuide role="judge" /><Button className="mt-6" asChild><Link to="/judge">{zh ? "前往評審" : "Open Judge"}</Link></Button></TabsContent>
    </Tabs>
    <ScoringReference />
  </main>;
}