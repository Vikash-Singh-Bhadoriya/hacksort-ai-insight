import { CATEGORIES, CLUSTERS, isHiddenGem, overallSignal, type Submission } from "./data";

export function byCategory(subs: Submission[]) {
  return CATEGORIES.map((c) => ({
    category: c,
    count: subs.filter((s) => s.category === c).length,
  })).filter((d) => d.count > 0);
}

export function innovationDistribution(subs: Submission[]) {
  const buckets = [
    { range: "50-59", min: 50, max: 59 },
    { range: "60-69", min: 60, max: 69 },
    { range: "70-79", min: 70, max: 79 },
    { range: "80-89", min: 80, max: 89 },
    { range: "90-100", min: 90, max: 100 },
  ];
  return buckets.map((b) => ({
    range: b.range,
    count: subs.filter((s) => s.scores.innovation >= b.min && s.scores.innovation <= b.max).length,
  }));
}

export function clusterSizes(subs: Submission[]) {
  return CLUSTERS.map((c) => ({
    name: c.name,
    count: subs.filter((s) => s.cluster === c.id).length,
    similarity: c.similarity,
  }));
}

export function saturation(subs: Submission[]) {
  return byCategory(subs)
    .map((d) => ({
      ...d,
      saturation: Math.min(100, Math.round((d.count / Math.max(subs.length, 1)) * 320)),
    }))
    .sort((a, b) => b.saturation - a.saturation);
}

export function gemCount(subs: Submission[]) {
  return subs.filter((s) => isHiddenGem(s.scores)).length;
}

export function signalSpread(subs: Submission[]) {
  return subs
    .map((s) => ({
      name: s.name,
      signal: overallSignal(s.scores),
      presentation: s.scores.presentation,
    }))
    .sort((a, b) => b.signal - a.signal);
}
