export type TopicDetail = { id: string; name: string; summary: string; subtopics: string[] };
export type SubjectEntry = { name: string; topics: string[]; details: TopicDetail[] };

const toTopic = (t: any): string =>
  typeof t === "string" ? t : t?.name ?? t?.title ?? t?.topic ?? t?.topic_name ?? "";

const toDetails = (arr: any): TopicDetail[] =>
  (Array.isArray(arr) ? arr : [])
    .map((t: any, i: number) => ({
      id: (typeof t === "object" && (t?.topic_id ?? t?.id)) || `top_${i + 1}`,
      name: toTopic(t),
      summary: (typeof t === "object" && (t?.summary ?? t?.description)) || "",
      subtopics:
        typeof t === "object" && Array.isArray(t?.subtopics) ? t.subtopics.map(String) : [],
    }))
    .filter((d: TopicDetail) => d.name);

const makeEntry = (name: string, rawTopics: any): SubjectEntry => {
  const details = toDetails(rawTopics);
  return { name, details, topics: details.map((d) => d.name) };
};

export function normalizeSubjects(raw: any): SubjectEntry[] {
  const list = Array.isArray(raw) ? raw : raw?.subjects ?? raw;

  if (Array.isArray(list)) {
    return list
      .map((s: any) =>
        makeEntry(
          typeof s === "string" ? s : s?.subject ?? s?.name ?? s?.title ?? "",
          s?.topics
        )
      )
      .filter((s) => s.name);
  }
  if (list && typeof list === "object") {
    return Object.entries(list).map(([name, topics]) => makeEntry(name, topics));
  }
  return [];
}   